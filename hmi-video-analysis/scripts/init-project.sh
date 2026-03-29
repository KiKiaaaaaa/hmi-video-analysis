#!/bin/bash
# HMI 视频分析项目初始化脚本

set -Eeuo pipefail

WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

echo "=========================================="
echo "HMI 视频分析项目初始化"
echo "=========================================="

# 检查是否已初始化
if [ -d "${WORKSPACE_PATH}/src" ]; then
    echo "项目已存在，跳过初始化"
    exit 0
fi

# Step 1: 初始化 Next.js 项目
echo ""
echo "[1/5] 初始化 Next.js 项目..."
coze init "${WORKSPACE_PATH}" --template nextjs

# Step 2: 安装依赖
echo ""
echo "[2/5] 安装项目依赖..."
cd "${WORKSPACE_PATH}"
pnpm add coze-coding-dev-sdk fluent-ffmpeg docx
pnpm add -D @types/fluent-ffmpeg

# Step 3: 创建目录结构
echo ""
echo "[3/5] 创建目录结构..."
mkdir -p src/app/api/{upload-chunk,merge-chunks,extract-audio,transcribe,extract-screenshots,analyze,generate-report}
mkdir -p src/lib
mkdir -p src/components/analysis
mkdir -p scripts

# Step 4: 创建构建脚本
echo ""
echo "[4/5] 创建构建脚本..."

# build.sh
cat > scripts/build.sh << 'EOF'
#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
EOF

# start.sh
cat > scripts/start.sh << 'EOF'
#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT="${DEPLOY_RUN_PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

# 检查 ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "WARNING: ffmpeg not found, video processing may fail"
fi

echo "Starting HTTP service on port ${PORT}..."
PORT=${PORT} node dist/server.js
EOF

chmod +x scripts/build.sh scripts/start.sh

# Step 5: 验证 ffmpeg
echo ""
echo "[5/5] 验证 ffmpeg..."
if command -v ffmpeg &> /dev/null; then
    echo "✓ ffmpeg is available: $(which ffmpeg)"
    echo "  Version: $(ffmpeg -version 2>&1 | head -1)"
else
    echo "✗ ffmpeg not found - video processing will fail"
fi

echo ""
echo "=========================================="
echo "初始化完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 创建 API 路由文件 (参考 skill.md)"
echo "2. 创建前端页面"
echo "3. 运行 'coze dev' 启动开发服务"
echo ""
