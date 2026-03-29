/**
 * API 路由模板 - 音频提取
 * 
 * 此模板展示了音频提取 API 的标准实现
 * 可根据需要修改用于其他 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import ffmpeg from 'fluent-ffmpeg';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';

// ============================================
// 配置区
// ============================================

// 使用系统 ffmpeg 路径（禁止使用 npm 包）
const FFMPEG_PATH = '/usr/bin/ffmpeg';
ffmpeg.setFfmpegPath(FFMPEG_PATH);

// 音频输出规格
const AUDIO_CONFIG = {
  codec: 'pcm_s16le',    // 16-bit PCM
  sampleRate: 16000,     // 16kHz
  channels: 1,           // 单声道
  format: 'wav',         // WAV 格式
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取视频文件扩展名
 */
function getVideoExtension(videoKey: string): string {
  const lower = videoKey.toLowerCase();
  if (lower.endsWith('.mov')) return 'mov';
  if (lower.endsWith('.webm')) return 'webm';
  return 'mp4';
}

/**
 * 初始化对象存储客户端
 */
function initStorage(): S3Storage {
  return new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });
}

// ============================================
// 主处理函数
// ============================================

export async function POST(request: NextRequest) {
  const timestamp = Date.now();
  const tempDir = path.join(tmpdir(), `audio_${timestamp}`);

  try {
    // 1. 解析请求参数
    const { videoKey } = await request.json();

    if (!videoKey) {
      return NextResponse.json(
        { error: '缺少 videoKey 参数' },
        { status: 400 }
      );
    }

    console.log('[Extract Audio] Starting for:', videoKey);
    console.log('[Extract Audio] Using ffmpeg:', FFMPEG_PATH);

    // 2. 初始化存储并下载视频
    const storage = initStorage();
    const videoUrl = await storage.generatePresignedUrl({
      key: videoKey,
      expireTime: 3600,
    });

    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`下载视频失败: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    console.log('[Extract Audio] Video downloaded, size:', videoBuffer.length);

    // 3. 创建临时目录并保存视频
    await fs.mkdir(tempDir, { recursive: true });
    
    const ext = getVideoExtension(videoKey);
    const tempVideoPath = path.join(tempDir, `input.${ext}`);
    const tempAudioPath = path.join(tempDir, 'output.wav');
    
    await fs.writeFile(tempVideoPath, videoBuffer);

    // 4. 使用 ffmpeg 提取音频
    console.log(`[Extract Audio] Processing ${ext} file...`);
    
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .noVideo()
        .audioCodec(AUDIO_CONFIG.codec)
        .audioFrequency(AUDIO_CONFIG.sampleRate)
        .audioChannels(AUDIO_CONFIG.channels)
        .format(AUDIO_CONFIG.format)
        .on('start', (cmd) => console.log('[FFmpeg] Command:', cmd))
        .on('stderr', (line) => console.log('[FFmpeg]', line))
        .on('error', (err) => {
          console.error('[FFmpeg] Error:', err);
          reject(new Error(`音频提取失败: ${err.message}`));
        })
        .on('end', () => {
          console.log('[FFmpeg] Completed');
          resolve();
        })
        .save(tempAudioPath);
    });

    // 5. 验证音频文件
    const audioBuffer = await fs.readFile(tempAudioPath);
    console.log('[Extract Audio] Audio size:', audioBuffer.length);

    if (audioBuffer.length < 1000) {
      throw new Error('音频文件太小，可能视频没有音轨');
    }

    // 6. 上传音频到对象存储
    const audioKey = await storage.uploadFile({
      fileContent: audioBuffer,
      fileName: `hmi-analysis/audios/audio_${timestamp}.wav`,
      contentType: 'audio/wav',
    });

    const audioSignedUrl = await storage.generatePresignedUrl({
      key: audioKey,
      expireTime: 86400,
    });

    console.log('[Extract Audio] Upload completed');

    // 7. 清理临时文件
    await fs.rm(tempDir, { recursive: true, force: true });

    // 8. 返回结果
    return NextResponse.json({
      audioKey,
      audioUrl: audioSignedUrl,
    });

  } catch (error) {
    console.error('[Extract Audio] Error:', error);
    
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    
    return NextResponse.json(
      { error: '音频提取失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
