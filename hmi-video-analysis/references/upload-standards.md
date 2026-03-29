# 上传功能标准

## 分片上传方案

### 背景

由于公网负载均衡器存在请求体大小限制，需要实现分片上传绕过限制。

### 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 分片大小 | 4 MB | 每个分片的最大大小 |
| 最大文件 | 1 GB | 整个文件的最大大小 |
| 支持格式 | MP4, WebM, MOV | 视频格式 |

## 分片上传流程

```
1. 前端计算文件 MD5 作为唯一标识
2. 将文件分割为 4MB 的分片
3. 逐个上传分片到 /api/upload-chunk
4. 全部分片上传完成后调用 /api/merge-chunks
5. 后端合并分片并上传到对象存储
```

## 前端代码

```typescript
// 分片大小：4MB
const CHUNK_SIZE = 4 * 1024 * 1024;

async function uploadVideo(file: File): Promise<string> {
  // 计算文件唯一标识
  const fileId = await calculateMD5(file);
  
  // 计算分片数量
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // 逐个上传分片
  for (let index = 0; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('fileId', fileId);
    formData.append('chunkIndex', index.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileName', file.name);
    
    const response = await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`分片 ${index + 1}/${totalChunks} 上传失败`);
    }
    
    // 更新进度
    const progress = ((index + 1) / totalChunks) * 100;
    console.log(`上传进度: ${progress.toFixed(1)}%`);
  }
  
  // 合并分片
  const mergeResponse = await fetch('/api/merge-chunks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId,
      fileName: file.name,
      totalChunks,
    }),
  });
  
  const result = await mergeResponse.json();
  return result.videoKey;
}

// 计算 MD5
async function calculateMD5(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## 后端 API

### /api/upload-chunk

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const fileId = formData.get('fileId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileName = formData.get('fileName') as string;

    if (!chunk || !fileId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 创建临时目录存储分片
    const chunkDir = path.join(tmpdir(), `upload_${fileId}`);
    await fs.mkdir(chunkDir, { recursive: true });

    // 保存分片
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(chunkPath, chunkBuffer);

    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} saved`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      message: `分片 ${chunkIndex + 1}/${totalChunks} 上传成功`,
    });
  } catch (error) {
    console.error('Upload chunk error:', error);
    return NextResponse.json(
      { error: '分片上传失败' },
      { status: 500 }
    );
  }
}
```

### /api/merge-chunks

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  try {
    const { fileId, fileName, totalChunks } = await request.json();

    if (!fileId || !fileName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const chunkDir = path.join(tmpdir(), `upload_${fileId}`);
    const timestamp = Date.now();

    // 合并分片
    const mergedPath = path.join(tmpdir(), `merged_${timestamp}`);
    const writeStream = await fs.open(mergedPath, 'w');

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      const chunkData = await fs.readFile(chunkPath);
      await writeStream.appendFile(chunkData);
    }

    await writeStream.close();

    // 读取合并后的文件
    const fileBuffer = await fs.readFile(mergedPath);
    console.log('Merged file size:', fileBuffer.length);

    // 上传到对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    const ext = fileName.toLowerCase().endsWith('.mov') ? 'mov' : 
                fileName.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';

    const videoKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: `hmi-analysis/videos/${timestamp}_${fileId.substring(0, 8)}.${ext}`,
      contentType: ext === 'mov' ? 'video/quicktime' : 
                   ext === 'webm' ? 'video/webm' : 'video/mp4',
    });

    // 清理临时文件
    await fs.rm(chunkDir, { recursive: true, force: true });
    await fs.unlink(mergedPath);

    console.log('Video uploaded:', videoKey);

    return NextResponse.json({
      success: true,
      videoKey,
      fileName,
      size: fileBuffer.length,
    });
  } catch (error) {
    console.error('Merge chunks error:', error);
    return NextResponse.json(
      { error: '合并分片失败' },
      { status: 500 }
    );
  }
}
```

## 对象存储配置

```typescript
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',  // SDK 自动处理
  secretKey: '',  // SDK 自动处理
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});
```

## 文件命名规范

```typescript
// 视频文件
`hmi-analysis/videos/${timestamp}_${fileId}.${ext}`

// 音频文件
`hmi-analysis/audios/audio_${timestamp}.wav`

// 截图文件
`hmi-analysis/screenshots/${timestamp}_${index}.jpg`

// 报告文件
`hmi-analysis/reports/${timestamp}.docx`
```

## 错误处理

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| 分片上传失败 | 网络中断 | 支持断点续传 |
| 合并失败 | 分片丢失 | 检查分片完整性 |
| 上传超时 | 文件太大 | 提示用户压缩视频 |

### 断点续传

```typescript
// 检查已上传的分片
const uploadedChunks = await checkUploadedChunks(fileId);

// 只上传未完成的分片
for (let index = 0; index < totalChunks; index++) {
  if (uploadedChunks.includes(index)) continue;
  
  // 上传分片...
}
```

## 进度显示

```typescript
interface UploadProgress {
  fileId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number;
  percentage: number;
  status: 'uploading' | 'merging' | 'completed' | 'error';
}

function updateProgress(progress: UploadProgress) {
  console.log(`[${progress.fileName}] ${progress.percentage.toFixed(1)}%`);
}
```
