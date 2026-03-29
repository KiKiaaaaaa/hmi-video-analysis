'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Video, 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';

// ============================================
// 类型定义
// ============================================

interface UploadProgress {
  percentage: number;
  status: 'idle' | 'uploading' | 'merging' | 'completed' | 'error';
  message: string;
}

interface AnalysisResult {
  screenshots: Array<{
    timestamp: number;
    imageUrl: string;
    triggerText: string;
  }>;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    summary: string;
  };
  transcript: string;
}

// ============================================
// 常量配置
// ============================================

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// ============================================
// 主组件
// ============================================

export default function HMIAnalysisPage() {
  // 状态管理
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    percentage: 0,
    status: 'idle',
    message: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // 文件处理
  // ============================================

  const handleFileSelect = useCallback((selectedFile: File) => {
    // 验证文件类型
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('请上传 MP4、WebM 或 MOV 格式的视频文件');
      return;
    }

    // 验证文件大小
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('视频文件大小不能超过 1GB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setUploadProgress({ percentage: 0, status: 'idle', message: '' });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  // ============================================
  // 分片上传
  // ============================================

  const calculateFileId = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadVideo = async (): Promise<string> => {
    if (!file) throw new Error('没有选择文件');

    const fileId = await calculateFileId(file);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setUploadProgress({
      percentage: 0,
      status: 'uploading',
      message: '正在上传视频...',
    });

    // 上传分片
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

      setUploadProgress({
        percentage: ((index + 1) / totalChunks) * 100,
        status: 'uploading',
        message: `上传中 ${index + 1}/${totalChunks}`,
      });
    }

    // 合并分片
    setUploadProgress({
      percentage: 100,
      status: 'merging',
      message: '正在合并文件...',
    });

    const mergeResponse = await fetch('/api/merge-chunks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        fileName: file.name,
        totalChunks,
      }),
    });

    if (!mergeResponse.ok) {
      throw new Error('合并文件失败');
    }

    const mergeResult = await mergeResponse.json();
    
    setUploadProgress({
      percentage: 100,
      status: 'completed',
      message: '上传完成',
    });

    return mergeResult.videoKey;
  };

  // ============================================
  // 分析流程
  // ============================================

  const startAnalysis = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // 1. 上传视频
      const videoKey = await uploadVideo();

      // 2. 提取音频
      setUploadProgress(prev => ({ ...prev, message: '正在提取音频...' }));
      const audioResponse = await fetch('/api/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoKey }),
      });
      
      if (!audioResponse.ok) {
        const errorData = await audioResponse.json();
        throw new Error(errorData.error || '音频提取失败');
      }
      
      const { audioUrl } = await audioResponse.json();

      // 3. 语音识别
      setUploadProgress(prev => ({ ...prev, message: '正在语音识别...' }));
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
      });
      
      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || '语音识别失败');
      }
      
      const { transcript } = await transcribeResponse.json();

      // 4. 提取截图
      setUploadProgress(prev => ({ ...prev, message: '正在提取截图...' }));
      const screenshotsResponse = await fetch('/api/extract-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoKey, transcript }),
      });
      
      if (!screenshotsResponse.ok) {
        const errorData = await screenshotsResponse.json();
        throw new Error(errorData.error || '截图提取失败');
      }
      
      const { screenshots } = await screenshotsResponse.json();

      // 5. AI 分析
      setUploadProgress(prev => ({ ...prev, message: '正在 AI 分析...' }));
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, screenshots }),
      });
      
      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || 'AI 分析失败');
      }
      
      const { analysis } = await analyzeResponse.json();

      // 6. 保存结果
      setResult({ screenshots, analysis, transcript });
      setUploadProgress(prev => ({ ...prev, message: '分析完成' }));

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : '分析过程出错');
      setUploadProgress(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // 下载报告
  // ============================================

  const downloadReport = async () => {
    if (!result || !file) return;

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshots: result.screenshots,
          analysis: result.analysis,
          videoName: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error('报告生成失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'HMI_Analysis_Report.docx';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('报告下载失败');
    }
  };

  // ============================================
  // 渲染
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto py-8 px-4">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            车机 HMI 竞品分析系统
          </h1>
          <p className="text-muted-foreground">
            上传录制视频，自动识别"截图"触发词，生成专业分析报告
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：上传区域 */}
          <Card className="lg:sticky lg:top-8 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                视频上传
              </CardTitle>
              <CardDescription>
                支持 MP4、WebM、MOV 格式，最大 1GB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 拖拽上传区 */}
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {file ? file.name : '点击或拖拽上传视频'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {file 
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : '支持 MP4、WebM、MOV 等格式'
                  }
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              {/* 进度条 */}
              {uploadProgress.status !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{uploadProgress.message}</span>
                    <span>{uploadProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <Progress value={uploadProgress.percentage} />
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={startAnalysis}
                  disabled={!file || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>
                
                {result && (
                  <Button variant="outline" onClick={downloadReport}>
                    <Download className="w-4 h-4 mr-2" />
                    下载报告
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 右侧：结果展示 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                分析结果
              </CardTitle>
              <CardDescription>
                {result 
                  ? `共识别 ${result.screenshots.length} 个关键截图`
                  : '等待分析完成'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-6">
                  {/* 截图展示 */}
                  <div>
                    <h3 className="font-semibold mb-3">关键截图</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {result.screenshots.map((screenshot, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={screenshot.imageUrl}
                            alt={`截图 ${index + 1}`}
                            className="w-full rounded-lg border"
                          />
                          <Badge className="absolute bottom-2 left-2" variant="secondary">
                            {(screenshot.timestamp / 1000).toFixed(1)}s
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 分析结果 */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2 text-green-600">优点</h3>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {result.analysis.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-red-600">缺点</h3>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {result.analysis.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2 text-blue-600">建议</h3>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {result.analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>上传视频后开始分析</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
