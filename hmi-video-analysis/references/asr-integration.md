# ASR 集成指南

## 概述

使用 `coze-coding-dev-sdk` 提供的 ASR 服务进行语音识别。

## 音频要求

| 参数 | 要求 |
|------|------|
| 格式 | WAV |
| 编码 | PCM |
| 采样率 | 16000 Hz |
| 声道 | 单声道 |

## ASR 调用代码

```typescript
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: '缺少audioUrl参数' },
        { status: 400 }
      );
    }

    console.log('Starting transcription for:', audioUrl);

    // 初始化 ASR 客户端
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const asrClient = new ASRClient(config, customHeaders);

    // 调用 ASR 服务
    const result = await asrClient.recognize({
      audioUrl: audioUrl,
      format: 'wav',
      sampleRate: 16000,
    });

    console.log('ASR result:', result);

    // 提取转录文本和词级时间戳
    const transcript = result.text || '';
    const utterances = result.utterances || [];

    return NextResponse.json({
      transcript,
      utterances,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: '语音识别失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
```

## 响应格式

```typescript
interface ASRResponse {
  transcript: string;      // 完整转录文本
  utterances: Utterance[]; // 词级时间戳
  duration: number;        // 音频时长（秒）
}

interface Utterance {
  text: string;        // 文本内容
  start_time: number;  // 开始时间（毫秒）
  end_time: number;    // 结束时间（毫秒）
}
```

## 处理无时间戳的情况

当 ASR 不返回时间戳时，使用 LLM 推断关键词位置：

```typescript
async function inferKeywordTimestamps(
  transcript: string,
  keyword: string,
  videoDuration: number,
  requestHeaders: Headers
): Promise<number[]> {
  const config = new Config();
  const customHeaders = HeaderUtils.extractForwardHeaders(requestHeaders);
  const llmClient = new LLMClient(config, customHeaders);

  const prompt = `你是一个视频分析助手。根据以下转录文本，找出所有包含"${keyword}"关键词的句子，并推断它们在视频中的大致时间位置。

转录文本：
"${transcript}"

视频总时长：${videoDuration}秒

请分析文本，找出所有提到"${keyword}"的位置。根据文本内容的逻辑顺序和篇幅分布，推断每个"${keyword}"关键词出现的大致时间点（秒）。

要求：
1. 找出所有包含"${keyword}"关键词的位置
2. 根据文本在整体转录中的位置比例，推断对应的时间
3. 如果文本很短只有一处"${keyword}"，时间设为视频中间位置
4. 返回格式：只返回时间点数字，用逗号分隔，例如：5.5,12.3,25.8

请直接返回时间点，不要有任何解释：`;

  try {
    const response = await llmClient.invoke([
      { role: 'user', content: prompt }
    ], { temperature: 0.3 });

    const content = response.content.trim();
    console.log('LLM inferred timestamps:', content);

    const timestamps = content.split(',')
      .map((s: string) => parseFloat(s.trim()))
      .filter((t: number) => !isNaN(t) && t >= 0 && t <= videoDuration);

    return timestamps.length > 0 ? timestamps : [videoDuration / 2];
  } catch (error) {
    console.error('LLM inference error:', error);
    return [videoDuration / 2];
  }
}
```

## 错误处理

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| audio convert failed | 音频格式不符合要求 | 确保输出 WAV 格式 |
| timeout | 音频太长 | 检查音频时长限制 |
| invalid audio URL | URL 无效 | 检查签名 URL 是否过期 |

### 音频转换失败排查

```typescript
// 确保音频格式正确
console.log('Audio format check:', {
  codec: 'pcm_s16le',
  sampleRate: 16000,
  channels: 1,
  format: 'wav'
});
```

## 完整 API 路由

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: '缺少audioUrl参数' },
        { status: 400 }
      );
    }

    console.log('Starting transcription for:', audioUrl);

    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const asrClient = new ASRClient(config, customHeaders);

    const result = await asrClient.recognize({
      audioUrl: audioUrl,
      format: 'wav',
      sampleRate: 16000,
    });

    const transcript = result.text || '';
    const utterances = result.utterances || [];

    console.log('Transcript length:', transcript.length);
    console.log('Utterances count:', utterances.length);

    return NextResponse.json({
      transcript,
      utterances,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: '语音识别失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
```
