import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, PanelLeftClose, PanelLeft, Sparkles, Send, Paperclip, Mic, Loader2, X as XIcon, FileText } from 'lucide-react';
import ConversationList from './ConversationList';
import DirectChat from './DirectChat';
import AppChat from '~/pages/appChat';
import { getVoice2TextApi } from '~/api';

const __env = (globalThis as any).__APP_ENV__;
const API_BASE = __env?.BASE_URL ?? '';

function encodeWAV(audioBuffer: AudioBuffer): Blob {
  const sampleRate = audioBuffer.sampleRate;
  let samples = audioBuffer.getChannelData(0);
  if (audioBuffer.numberOfChannels > 1) {
    const mono = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) sum += audioBuffer.getChannelData(c)[i];
      mono[i] = sum / audioBuffer.numberOfChannels;
    }
    samples = mono;
  }
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([v], { type: 'audio/wav' });
}

function convertBlobToWav(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    const fileReader = new FileReader();
    fileReader.onload = async () => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(fileReader.result as ArrayBuffer);
        resolve(encodeWAV(audioBuffer));
        audioContext.close();
      } catch (err) {
        reject(new Error('Audio decoding failed'));
        audioContext.close();
      }
    };
    fileReader.onerror = () => reject(new Error('Failed to read audio'));
    fileReader.readAsArrayBuffer(blob);
  });
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
  return '';
}

interface UploadedFile {
  id: string;
  name: string;
  filepath: string;
  size: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const STARTERS = [
  '帮我查看今日待处理任务',
  '公司有哪些客户和供应商？',
  '帮我搜索知识库文档',
  '数据库有哪些业务表？',
];

interface WsConfig {
  models?: { id: string; displayName: string }[];
  welcomeMessage?: string;
  functionDescription?: string;
  dailyChatFlowId?: string;
}

export default function WsAssistant() {
  const [config, setConfig] = useState<WsConfig | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/workstation/config`, { credentials: 'include' })
      .then((r) => r.json())
      .then((r) => {
        const raw = r?.data;
        if (typeof raw === 'string') {
          try { setConfig(JSON.parse(raw)); } catch { setConfig({}); }
        } else {
          setConfig(raw ?? {});
        }
      })
      .catch(() => setConfig({}));
  }, []);

  useEffect(() => {
    if (chatId) sessionStorage.setItem('ws-assistant-chat-id', chatId);
  }, [chatId]);

  const handleSelectConversation = useCallback((id: string) => {
    setChatId(id);
    if (window.innerWidth < 768) setHistoryOpen(false);
  }, []);

  const handleNewConversation = useCallback(() => {
    setChatId(null);
    sessionStorage.removeItem('ws-assistant-chat-id');
  }, []);

  const startChatWithText = useCallback((text: string, files?: UploadedFile[]) => {
    const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingMessage(text);
    if (files?.length) setPendingFiles(files);
    setChatId(newId);
  }, []);

  const handleTitleUpdate = useCallback((_chatId: string, _title: string) => {
    setRefreshKey((k) => k + 1);
  }, []);

  const flowId = config?.dailyChatFlowId;
  const models = config?.models ?? [];
  const showWelcome = !chatId;

  return (
    <div className="flex flex-col h-full overflow-hidden relative bg-gradient-to-b from-slate-50/80 via-white to-slate-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`flex-shrink-0 bg-white/50 dark:bg-navy-900/50 border-r border-gray-200/60 dark:border-navy-800/60 transition-all duration-300 ease-in-out overflow-hidden ${
            historyOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <div className="h-full flex flex-col w-64">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/50 dark:border-navy-800/50">
              <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">对话记录</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                title="收起侧栏"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                currentId={chatId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                refreshKey={refreshKey}
                useDirectMode={!flowId}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="flex-shrink-0 h-12 flex items-center px-5 bg-transparent z-10">
            <div className="flex items-center gap-1">
              {!historyOpen && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                  title="展开侧栏"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleNewConversation}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 active:scale-95 transition-all cursor-pointer"
                title="新对话"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              {chatId && (
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-medium">嘉恒智能助手</span>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-hidden">
            {showWelcome ? (
              <WelcomeScreen
                config={config}
                onStarterClick={(text) => startChatWithText(text)}
                onSend={startChatWithText}
              />
            ) : config === null ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中...</div>
            ) : flowId ? (
              <AppChat key={chatId} chatId={chatId!} flowId={flowId} flowType="10" embedded />
            ) : (
              <DirectChat
                key={chatId}
                chatId={chatId!}
                models={models}
                onTitleUpdate={handleTitleUpdate}
                initialMessage={pendingMessage}
                initialFiles={pendingFiles.length > 0 ? pendingFiles : undefined}
                onInitialMessageConsumed={() => { setPendingMessage(null); setPendingFiles([]); }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ config, onStarterClick, onSend }: {
  config: WsConfig | null;
  onStarterClick: (text: string) => void;
  onSend: (text: string, files?: UploadedFile[]) => void;
}) {
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && uploadedFiles.length === 0) return;
    const files = uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;
    setInput('');
    setUploadedFiles([]);
    onSend(text || '请查看附件', files);
  }, [input, onSend, uploadedFiles]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/api/v1/knowledge/upload`, {
          method: 'POST', credentials: 'include', body: formData,
        });
        const json = await res.json();
        if (json?.data) {
          setUploadedFiles((prev) => [...prev, {
            id: json.data.id || json.data.file_id || String(Date.now()),
            name: file.name,
            filepath: json.data.filepath || json.data.file_path || '',
            size: file.size,
          }]);
        }
      }
    } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const cleanupVoice = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const handleVoiceToggle = useCallback(async () => {
    setVoiceError('');
    if (isRecording) {
      if (mediaRecorderRef.current) { setVoiceProcessing(true); mediaRecorderRef.current.stop(); }
      setIsRecording(false);
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVoiceError('语音功能需要 HTTPS 安全连接');
        setTimeout(() => setVoiceError(''), 4000);
        return;
      }
      audioChunksRef.current = [];
      const mimeType = getSupportedMimeType();
      if (!mimeType) { setVoiceError('浏览器不支持录音'); return; }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        try {
          const rawBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const wavBlob = await convertBlobToWav(rawBlob);
          const formData = new FormData();
          formData.append('file', wavBlob, 'recording.wav');
          const res = await getVoice2TextApi(formData);
          const text = res?.data || '';
          if (text) { setInput((prev) => prev + text); }
          else { setVoiceError('未识别到语音内容'); setTimeout(() => setVoiceError(''), 3000); }
        } catch {
          setVoiceError('语音识别失败'); setTimeout(() => setVoiceError(''), 3000);
        } finally { cleanupVoice(); setVoiceProcessing(false); }
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError('无法访问麦克风'); setTimeout(() => setVoiceError(''), 3000);
      cleanupVoice(); setVoiceProcessing(false);
    }
  }, [isRecording, cleanupVoice]);

  return (
    <div className="flex flex-col h-full pb-[60px] md:pb-[88px]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 animate-in fade-in duration-500">
        <div className="max-w-lg w-full flex flex-col items-center text-center">
          <div className="w-14 h-14 mb-5 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight mb-3 bg-gradient-to-br from-gray-800 to-gray-500 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            {config?.welcomeMessage || '您好，我是嘉恒智能助手'}
          </h1>
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-8 leading-relaxed max-w-sm">
            {config?.functionDescription || '航运智能业务系统 · 支持任务管理、客户查询、知识检索、数据分析等全方位服务'}
          </p>
          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStarterClick(s)}
                className="group px-4 py-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer
                  bg-white dark:bg-navy-800/60 hover:bg-gray-50 dark:hover:bg-navy-800
                  border border-gray-100 dark:border-navy-700/50 hover:border-gray-200 dark:hover:border-navy-600
                  shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
              >
                <span className="text-[13px] text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 font-medium leading-snug transition-colors">
                  {s}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Welcome input */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-gray-200/80 dark:border-navy-700/60 bg-white dark:bg-navy-800/60 shadow-sm focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all overflow-hidden">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {uploadedFiles.map((f) => (
                  <div key={f.id} className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-navy-800/80 border border-gray-200 dark:border-navy-700 hover:border-gray-300 dark:hover:border-navy-600 transition-colors">
                    <FileText className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate max-w-[140px]">{f.name}</div>
                      <div className="text-[10px] text-gray-400">{formatFileSize(f.size)}</div>
                    </div>
                    <button type="button" onClick={() => removeFile(f.id)} className="ml-1 p-0.5 rounded text-gray-300 hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {voiceError && (
              <div className="mx-4 mt-3 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                {voiceError}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息开始对话..."
              rows={2}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none min-h-[72px] max-h-[160px] leading-relaxed"
              style={{ overflow: 'hidden' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 160) + 'px';
                t.style.overflow = t.scrollHeight > 160 ? 'auto' : 'hidden';
              }}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="*" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-cyan-500 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="上传附件">
                  {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Paperclip className="h-4.5 w-4.5" />}
                </button>
                <button type="button" onClick={handleVoiceToggle} disabled={voiceProcessing}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRecording ? 'bg-red-500 text-white animate-pulse'
                      : voiceProcessing ? 'text-cyan-500'
                      : 'text-gray-400 dark:text-gray-500 hover:text-cyan-500 hover:bg-gray-100 dark:hover:bg-navy-700'
                  }`}
                  title={isRecording ? '停止录音' : voiceProcessing ? '识别中...' : '语音输入'}>
                  {voiceProcessing ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mic className="h-4.5 w-4.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() && uploadedFiles.length === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-200 dark:disabled:bg-navy-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors cursor-pointer"
                title="发送"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
