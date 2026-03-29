# 音频提取标准

## 输出规格

音频输出必须符合 ASR 服务要求：

| 参数 | 值 | 说明 |
|------|-----|------|
| 格式 | WAV | 无损格式 |
| 编码 | pcm_s16le | 16-bit PCM |
| 采样率 | 16000 Hz | ASR 常用 |
| 声道 | 1 | 单声道 |

## 提取代码

```typescript
import ffmpeg from 'fluent-ffmpeg';

const ffmpegPath = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

// 音频提取
await new Promise<void>((resolve, reject) => {
  ffmpeg(tempVideoPath)
    .noVideo()
    .audioCodec('pcm_s16le')  // 16-bit PCM
    .audioFrequency(16000)     // 16kHz 采样率
    .audioChannels(1)          // 单声道
    .format('wav')
    .on('start', (commandLine) => {
      console.log('FFmpeg command:', commandLine);
    })
    .on('stderr', (stderrLine) => {
      console.log('FFmpeg stderr:', stderrLine);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      reject(new Error(`音频提取失败: ${err.message}`));
    })
    .on('end', () => {
      console.log('Audio extraction completed');
      resolve();
    })
    .save(tempAudioPath);
});
```

## 错误处理

### 检查音频文件有效性

```typescript
const audioBuffer = await fs.readFile(tempAudioPath);
console.log('Audio extracted, size:', audioBuffer.length);

if (audioBuffer.length < 1000) {
  throw new Error('音频提取失败：生成的音频文件太小，可能视频没有音轨');
}
```

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| spawn ENOENT | ffmpeg 不存在 | 确认 `/usr/bin/ffmpeg` 存在 |
| Invalid data found | 视频格式不支持 | 检查视频文件完整性 |
| 音频文件太小 | 视频无音轨 | 提示用户检查视频 |

## 上传到对象存储

```typescript
import { S3Storage } from 'coze-coding-dev-sdk';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// 上传音频
const audioKey = await storage.uploadFile({
  fileContent: audioBuffer,
  fileName: `hmi-analysis/audios/audio_${timestamp}.wav`,
  contentType: 'audio/wav',
});

// 生成签名 URL
const audioSignedUrl = await storage.generatePresignedUrl({
  key: audioKey,
  expireTime: 86400,
});
```

## 完整 API 路由示例

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';

const ffmpegPath = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

export async function POST(request: NextRequest) {
  const timestamp = Date.now();
  const tempDir = path.join(tmpdir(), `audio_${timestamp}`);

  try {
    const { videoKey } = await request.json();

    if (!videoKey) {
      return NextResponse.json(
        { error: '缺少videoKey参数' },
        { status: 400 }
      );
    }

    console.log('Starting audio extraction for:', videoKey);
    console.log('Using ffmpeg path:', ffmpegPath);

    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });

    // 生成视频 URL 并下载
    const videoUrl = await storage.generatePresignedUrl({
      key: videoKey,
      expireTime: 3600,
    });

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`下载视频失败: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    // 创建临时目录并保存视频
    await fs.mkdir(tempDir, { recursive: true });
    
    const ext = videoKey.toLowerCase().endsWith('.mov') ? 'mov' : 
                videoKey.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
    
    const tempVideoPath = path.join(tempDir, `input.${ext}`);
    const tempAudioPath = path.join(tempDir, 'output.wav');
    await fs.writeFile(tempVideoPath, videoBuffer);

    // 提取音频
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .format('wav')
        .on('error', (err) => reject(new Error(`音频提取失败: ${err.message}`)))
        .on('end', () => resolve())
        .save(tempAudioPath);
    });

    // 验证音频文件
    const audioBuffer = await fs.readFile(tempAudioPath);
    if (audioBuffer.length < 1000) {
      throw new Error('音频提取失败：生成的音频文件太小');
    }

    // 上传音频
    const audioKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `hmi-analysis/audios/audio_${timestamp}.wav`,
      contentType: 'audio/wav',
    });

    const audioSignedUrl = await storage.generatePresignedUrl({
      key: audioKey,
      expireTime: 86400,
    });

    // 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({
      audioKey,
      audioUrl: audioSignedUrl,
    });
  } catch (error) {
    console.error('Extract audio error:', error);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
    return NextResponse.json(
      { error: '音频提取失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
```
