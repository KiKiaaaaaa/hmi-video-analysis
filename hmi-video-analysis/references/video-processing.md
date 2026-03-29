# 视频处理规范

## FFmpeg 配置

### 系统要求

- ffmpeg 版本：6.1.1 或更高
- 安装路径：`/usr/bin/ffmpeg`

### 检查 ffmpeg 可用性

```bash
# 检查版本
ffmpeg -version

# 检查路径
which ffmpeg
```

### 代码中使用

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 使用系统 ffmpeg 路径
const ffmpegPath = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

console.log('Using system ffmpeg:', ffmpegPath);
```

## 视频格式支持

| 格式 | 扩展名 | MIME 类型 | 说明 |
|------|--------|----------|------|
| MP4 | .mp4 | video/mp4 | 主要格式 |
| WebM | .webm | video/webm | 网页格式 |
| MOV | .mov | video/quicktime | Apple 格式 |

## 格式识别代码

```typescript
function getVideoExtension(videoKey: string): string {
  const lower = videoKey.toLowerCase();
  if (lower.endsWith('.mov')) return 'mov';
  if (lower.endsWith('.webm')) return 'webm';
  return 'mp4';
}
```

## 视频时长获取

由于不使用 ffprobe，使用 ffmpeg 命令获取时长：

```typescript
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `"${ffmpegPath}" -i "${videoPath}" 2>&1 | grep -oP 'Duration: \\K[0-9:.]+'`
    );
    const durationStr = stdout.trim();
    if (durationStr) {
      const parts = durationStr.split(':').map(parseFloat);
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  } catch {
    // 忽略错误，返回默认值
  }
  return 30; // 默认 30 秒
}
```

## 视频截图提取

```typescript
await new Promise<void>((resolve, reject) => {
  ffmpeg(tempVideoPath)
    .screenshots({
      timestamps: [screenshotTime],
      filename: `screenshot_${i}.jpg`,
      folder: tempDir,
      size: '1280x720',
    })
    .on('error', (err) => {
      console.error(`Screenshot error:`, err);
      reject(err);
    })
    .on('end', () => {
      resolve();
    });
});
```

## 临时文件处理

### 创建临时目录

```typescript
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';

const timestamp = Date.now();
const tempDir = path.join(tmpdir(), `video_${timestamp}`);
await fs.mkdir(tempDir, { recursive: true });
```

### 清理临时文件

```typescript
// 成功后清理
await fs.rm(tempDir, { recursive: true, force: true });

// 错误处理中也要清理
try {
  await fs.rm(tempDir, { recursive: true, force: true });
} catch (e) {
  // ignore
}
```

## 禁止事项

### ❌ 禁止使用的 npm 包

以下包与 Next.js Turbopack 不兼容：

```typescript
// ❌ 禁止
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
```

**原因**：这些包包含 README.md 等静态文件，Turbopack 无法正确解析。

### ❌ 禁止硬编码路径

```typescript
// ❌ 错误
const tempPath = '/workspace/projects/temp/';

// ✅ 正确
const tempPath = path.join(tmpdir(), `video_${timestamp}`);
```
