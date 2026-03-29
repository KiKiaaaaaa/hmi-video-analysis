# HMI 视频分析 Skill

## Skill 职责

本 Skill 专注于构建**车机 HMI 竞品分析系统**，实现从视频上传到生成专业分析报告的完整工作流程。

核心能力：
- 大文件分片上传（支持 1GB 视频）
- 视频音频提取与处理
- 语音识别与转录
- AI 智能分析 HMI 界面优缺点
- 自动生成 Word 格式报告

## 触发场景

当用户需求包含以下关键词时触发：
- "车机 HMI 分析"
- "竞品分析系统"
- "视频分析报告"
- "HMI 截图识别"
- "视频转报告"
- "车载界面分析"

或当用户描述需求为：
- 上传录制视频，自动识别触发词
- 分析车机界面优缺点
- 生成 HMI 分析报告

## 技术栈规范

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Next.js 16 (App Router) | 使用 Turbopack |
| 前端 | React 19 + TypeScript 5 | - |
| UI | shadcn/ui + Tailwind CSS 4 | - |
| 视频处理 | ffmpeg (系统路径) | 禁用 npm 包 |
| 报告生成 | docx | Word 文档 |
| AI 能力 | coze-coding-dev-sdk | ASR、LLM、对象存储 |

## 执行步骤

### Step 1: 项目初始化

```bash
coze init ${COZE_WORKSPACE_PATH} --template nextjs
```

初始化后检查并创建必要目录：
- `src/app/api/` - API 路由
- `src/lib/` - 工具函数
- `src/components/` - UI 组件

### Step 2: 安装依赖

```bash
pnpm add coze-coding-dev-sdk fluent-ffmpeg docx
pnpm add -D @types/fluent-ffmpeg
```

**重要**：禁止安装 `@ffmpeg-installer/ffmpeg` 和 `@ffprobe-installer/ffprobe`，它们与 Next.js Turbopack 不兼容。

### Step 3: 创建核心 API 路由

按顺序创建以下 API：

1. **`/api/upload-chunk`** - 分片上传
   - 4MB 分片大小
   - 支持断点续传
   - 返回 videoKey

2. **`/api/extract-audio`** - 音频提取
   - 使用系统 ffmpeg：`/usr/bin/ffmpeg`
   - 输出 WAV 格式（pcm_s16le, 16kHz, 单声道）
   - 支持 MP4/WebM/MOV 格式

3. **`/api/transcribe`** - 语音识别
   - 调用 ASR 服务
   - 返回转录文本

4. **`/api/extract-screenshots`** - 截图提取
   - LLM 推断"截图"关键词时间位置
   - 使用 ffmpeg 截取视频帧

5. **`/api/analyze`** - AI 分析
   - 分析 HMI 界面优缺点
   - 返回结构化分析结果

6. **`/api/generate-report`** - 报告生成
   - 生成 Word 文档
   - 包含截图和分析内容

### Step 4: 创建前端页面

创建上传页面和分析结果展示页面，参考 `assets/page-template.tsx`。

### Step 5: 配置构建脚本

更新 `scripts/build.sh` 和 `scripts/start.sh`，确保 ffmpeg 可用。

### Step 6: 验证测试

```bash
# 类型检查
npx tsc --noEmit

# 服务存活检查
curl -I http://localhost:5000

# API 冒烟测试
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"videoKey":"test"}' \
  http://localhost:5000/api/extract-audio
```

## 输出标准

### 文件结构

```
src/
├── app/
│   ├── api/
│   │   ├── upload-chunk/route.ts
│   │   ├── merge-chunks/route.ts
│   │   ├── extract-audio/route.ts
│   │   ├── transcribe/route.ts
│   │   ├── extract-screenshots/route.ts
│   │   ├── analyze/route.ts
│   │   └── generate-report/route.ts
│   ├── page.tsx
│   └── layout.tsx
├── lib/
│   └── utils.ts
└── components/
    └── ui/  (shadcn 组件)
```

### API 响应格式

所有 API 返回统一格式：

```typescript
// 成功响应
{
  "success": true,
  "data": { ... }
}

// 错误响应
{
  "error": "错误描述信息"
}
```

### 报告输出格式

Word 文档包含：
1. 封面（项目名称、分析日期）
2. 目录
3. 分析概述
4. 截图展示（带时间戳和说明）
5. 优点分析
6. 缺点分析
7. 改进建议
8. 总结

## 注意事项

### ffmpeg 使用规范

```typescript
// ✅ 正确：使用系统 ffmpeg
const ffmpegPath = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

// ❌ 错误：使用 npm 包（与 Turbopack 不兼容）
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
```

### 视频格式识别

根据文件扩展名识别格式：

```typescript
const ext = videoKey.toLowerCase().endsWith('.mov') ? 'mov' : 
            videoKey.toLowerCase().endsWith('.webm') ? 'webm' : 'mp4';
```

### 音频输出规格

WAV 格式参数：
- 编码：pcm_s16le（16-bit PCM）
- 采样率：16000 Hz（ASR 常用）
- 声道：1（单声道）

### 分片上传配置

- 分片大小：4MB
- 支持格式：MP4、WebM、MOV
- 最大文件：1GB

## 参考资料

- `references/video-processing.md` - 视频处理详细规范
- `references/audio-extraction.md` - 音频提取标准
- `references/asr-integration.md` - ASR 集成指南
- `references/report-generation.md` - 报告生成规范
- `references/upload-standards.md` - 上传功能标准

## 模板文件

- `assets/route-template.ts` - API 路由模板
- `assets/page-template.tsx` - 前端页面模板
