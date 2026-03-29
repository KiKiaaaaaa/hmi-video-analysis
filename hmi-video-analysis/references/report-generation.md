# 报告生成规范

## Word 文档结构

使用 `docx` 库生成 Word 文档，结构如下：

```
1. 封面
   - 项目标题
   - 分析日期
   - 分析师信息

2. 目录

3. 分析概述
   - 视频来源
   - 分析范围
   - 方法说明

4. 截图展示
   - 时间戳
   - 截图图片
   - 场景说明

5. 优点分析
   - 界面设计
   - 交互体验
   - 功能完整性

6. 缺点分析
   - 可用性问题
   - 设计缺陷
   - 功能缺失

7. 改进建议
   - 短期优化
   - 长期规划

8. 总结
```

## 报告生成代码

```typescript
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  Packer,
} from 'docx';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';

interface Screenshot {
  timestamp: number;
  imageUrl: string;
  triggerText: string;
}

interface Analysis {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
}

export async function generateReport(
  screenshots: Screenshot[],
  analysis: Analysis,
  videoName: string
): Promise<Buffer> {
  const date = new Date().toLocaleDateString('zh-CN');

  // 创建文档
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // 封面标题
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 2000, after: 400 },
            children: [
              new TextRun({
                text: '车机 HMI 竞品分析报告',
                bold: true,
                size: 56,
              }),
            ],
          }),
          
          // 视频名称
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `视频：${videoName}`,
                size: 28,
              }),
            ],
          }),
          
          // 日期
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `分析日期：${date}`,
                size: 24,
                color: '666666',
              }),
            ],
          }),

          // 分割线
          new Paragraph({
            spacing: { before: 400, after: 400 },
            border: {
              bottom: { style: 'single', size: 1, color: 'CCCCCC' },
            },
            children: [],
          }),

          // 分析概述
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('一、分析概述')],
          }),
          
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `本报告对视频内容进行了深度分析，识别了 ${screenshots.length} 个关键界面截图，并从界面设计、交互体验、功能完整性等维度进行了综合评估。`,
                size: 22,
              }),
            ],
          }),

          // 截图展示
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('二、关键界面截图')],
          }),
          
          ...screenshots.flatMap((screenshot, index) => [
            new Paragraph({
              spacing: { before: 200, after: 100 },
              children: [
                new TextRun({
                  text: `截图 ${index + 1} - 时间：${formatTime(screenshot.timestamp)}`,
                  bold: true,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: screenshot.triggerText,
                  size: 20,
                  color: '666666',
                }),
              ],
            }),
          ]),

          // 优点分析
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('三、优点分析')],
          }),
          
          ...analysis.strengths.map((strength, index) =>
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `${index + 1}. ${strength}`,
                  size: 22,
                }),
              ],
            })
          ),

          // 缺点分析
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('四、缺点分析')],
          }),
          
          ...analysis.weaknesses.map((weakness, index) =>
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `${index + 1}. ${weakness}`,
                  size: 22,
                }),
              ],
            })
          ),

          // 改进建议
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('五、改进建议')],
          }),
          
          ...analysis.suggestions.map((suggestion, index) =>
            new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: `${index + 1}. ${suggestion}`,
                  size: 22,
                }),
              ],
            })
          ),

          // 总结
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('六、总结')],
          }),
          
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: analysis.summary,
                size: 22,
              }),
            ],
          }),
        ],
      },
    ],
  });

  // 生成 Buffer
  return await Packer.toBuffer(doc);
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
```

## 文件命名规范

```typescript
// 使用英文命名避免编码问题
const fileName = `HMI_Analysis_Report_${Date.now()}.docx`;
```

## 下载响应

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { screenshots, analysis, videoName } = await request.json();

    // 生成报告
    const reportBuffer = await generateReport(screenshots, analysis, videoName);

    // 返回文件
    return new NextResponse(reportBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="HMI_Analysis_Report.docx"`,
        'Content-Length': reportBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json(
      { error: '报告生成失败' },
      { status: 500 }
    );
  }
}
```

## 注意事项

### 文件名编码

```typescript
// ❌ 错误：中文文件名可能导致编码问题
'Content-Disposition': `attachment; filename="分析报告.docx"`

// ✅ 正确：使用英文文件名
'Content-Disposition': `attachment; filename="HMI_Analysis_Report.docx"`
```

### 图片嵌入

如需嵌入截图图片：

```typescript
import { ImageRun } from 'docx';

const imageRun = new ImageRun({
  data: imageBuffer,
  transformation: {
    width: 400,
    height: 300,
  },
});

new Paragraph({
  children: [imageRun],
});
```

### 样式配置

```typescript
// 文本样式
new TextRun({
  text: '文本内容',
  bold: true,      // 粗体
  size: 28,        // 字号（半磅）
  color: '333333', // 颜色
  font: '微软雅黑', // 字体
});

// 段落样式
new Paragraph({
  alignment: AlignmentType.CENTER, // 对齐方式
  spacing: { before: 200, after: 100 }, // 间距
  border: {
    bottom: { style: 'single', size: 1, color: 'CCCCCC' },
  },
});
```
