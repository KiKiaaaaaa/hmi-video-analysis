# HMI 视频分析 Skill

车机 HMI 竞品分析系统 Skill，实现从视频上传到生成专业分析报告的完整工作流程。

## 安装

### 方式一：复制到 Skills 目录

```bash
# 将 Skill 复制到你的项目 skills 目录
cp -r hmi-video-analysis /path/to/your/project/.coze/skills/
```

### 方式二：直接使用

将 `skill.md` 内容作为 Agent 的参考文档使用。

## 快速开始

### 1. 初始化项目

```bash
# 运行初始化脚本
bash scripts/init-project.sh
```

或手动执行：

```bash
# 初始化 Next.js 项目
coze init ${COZE_WORKSPACE_PATH} --template nextjs

# 安装依赖
pnpm add coze-coding-dev-sdk fluent-ffmpeg docx
pnpm add -D @types/fluent-ffmpeg
```

### 2. 创建 API 路由

参考 `assets/route-template.ts` 创建以下 API：

- `/api/upload-chunk` - 分片上传
- `/api/merge-chunks` - 合并分片
- `/api/extract-audio` - 音频提取
- `/api/transcribe` - 语音识别
- `/api/extract-screenshots` - 截图提取
- `/api/analyze` - AI 分析
- `/api/generate-report` - 报告生成

### 3. 创建前端页面

参考 `assets/page-template.tsx` 创建上传和分析页面。

### 4. 启动开发服务

```bash
coze dev
```

## 目录结构

```
hmi-video-analysis/
├── skill.md                    # Skill 主文档
├── skill.json                  # Skill 配置
├── README.md                   # 使用说明
├── references/                 # 参考文档
│   ├── video-processing.md     # 视频处理规范
│   ├── audio-extraction.md     # 音频提取标准
│   ├── asr-integration.md      # ASR 集成指南
│   ├── report-generation.md    # 报告生成规范
│   └── upload-standards.md     # 上传功能标准
├── scripts/                    # 自动化脚本
│   └── init-project.sh         # 项目初始化脚本
└── assets/                     # 模板文件
    ├── route-template.ts       # API 路由模板
    └── page-template.tsx       # 前端页面模板
```

## 核心功能

| 功能 | 说明 |
|------|------|
| 分片上传 | 支持 1GB 大文件，4MB 分片 |
| 音频提取 | WAV 格式，16kHz，单声道 |
| 语音识别 | ASR 服务，支持时间戳 |
| 截图提取 | LLM 推断关键词位置 |
| AI 分析 | HMI 界面优缺点分析 |
| 报告生成 | Word 格式，包含截图和建议 |

## 注意事项

### ffmpeg 配置

**禁止使用 npm 包**，使用系统 ffmpeg：

```typescript
// ✅ 正确
const ffmpegPath = '/usr/bin/ffmpeg';

// ❌ 错误（与 Turbopack 不兼容）
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
```

### 音频格式

必须符合 ASR 要求：
- 格式：WAV
- 编码：pcm_s16le
- 采样率：16000 Hz
- 声道：单声道

### 文件命名

使用英文命名避免编码问题：

```typescript
// ✅ 正确
fileName: `HMI_Analysis_Report_${timestamp}.docx`

// ❌ 错误
fileName: `分析报告_${timestamp}.docx`
```

## 版本历史

- v1.0.0 - 初始版本，完整工作流程
