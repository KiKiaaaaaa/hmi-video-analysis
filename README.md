## 简介
HMI 视频分析 Skill 是一个专为车机 HMI（Human-Machine Interface）竞品分析设计的自动化工具。它能够：

1. **上传录制视频** - 支持大文件分片上传（最大 1GB）
2. **自动识别触发词** - 识别视频中的"截图"关键词
3. **智能截图提取** - 自动截取关键界面画面
4. **AI 深度分析** - 分析 HMI 界面的优缺点
5. **生成专业报告** - 输出 Word 格式分析报告


## 适用场景

- 🚗 车机 HMI 竞品调研分析
- 📱 移动应用界面评测

## 前置要求

- Node.js 20+
- pnpm 包管理器
- FFmpeg（系统安装）

## 注意事项

## ⚠️ FFmpeg 兼容性
**禁止使用以下 npm 包**（与 Next.js Turbopack 不兼容）：
- `@ffmpeg-installer/ffmpeg`
- `@ffprobe-installer/ffprobe`
- `ffmpeg-static`
请使用系统安装的 FFmpeg（`/usr/bin/ffmpeg`）。

## ⚠️ 音频格式要求
| 参数  | 值          |
| --- | ---------- |
| 格式  | WAV        |
| 编码  | pcm\_s16le |
| 采样率 | 16000 Hz   |
| 声道  | 单声道        |

## ⚠️ 文件命名规范
使用英文命名避免编码问题

## ⚠️ 分片上传配置
| 参数   | 值              | 说明         |
| ---- | -------------- | ---------- |
| 分片大小 | 4MB            | 绕过公网负载均衡限制 |
| 最大文件 | 1GB            | 建议不超过此限制   |
| 支持格式 | MP4, WebM, MOV | 常见视频格式     |

## 线上查看
https://2qx4fxnxg8.coze.site/

## 作者
噢呜酱/KiKi
