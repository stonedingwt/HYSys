import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Send, Loader2, Globe, Database, StopCircle, ChevronDown,
  Paperclip, Mic, X as XIcon, Copy, Check, Volume2, Pause,
  ThumbsUp, ThumbsDown, FileText,
} from 'lucide-react';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { getLogoUrl } from '~/utils/logoUtils';
import { getVoice2TextApi, textToSpeech } from '~/api';
import { useGetWorkbenchModelsQuery } from '~/data-provider';
import store from '~/store';

const __env = (globalThis as any).__APP_ENV__;
const API_BASE = __env?.BASE_URL ?? '';

interface UploadedFile {
  id: string;
  name: string;
  filepath: string;
  size: number;
}

interface Message {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  createdAt?: string;
  sender?: string;
  files?: any[];
}

interface Props {
  chatId: string;
  models: { id: string; displayName: string }[];
  onTitleUpdate?: (chatId: string, title: string) => void;
  initialMessage?: string | null;
  initialFiles?: UploadedFile[];
  onInitialMessageConsumed?: () => void;
}

// --- WAV encoding (matches working SpeechToText component) ---

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
        const wavBlob = encodeWAV(audioBuffer);
        resolve(wavBlob);
        audioContext.close();
      } catch (err) {
        reject(new Error('Audio decoding failed: ' + (err as Error).message));
        audioContext.close();
      }
    };
    fileReader.onerror = () => reject(new Error('Failed to read audio file'));
    fileReader.readAsArrayBuffer(blob);
  });
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// --- Main Component ---

function DirectChat({ chatId, models, onTitleUpdate, initialMessage, initialFiles, onInitialMessageConsumed }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [kbEnabled, setKbEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => models[0]?.id ?? '');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const streamBufRef = useRef('');
  const reasonBufRef = useRef('');
  const lastParentIdRef = useRef<string | null>(null);
  const isNewConvRef = useRef(true);
  const initialMsgSentRef = useRef(false);
  const user = useRecoilValue(store.user);

  useEffect(() => {
    if (models.length && !selectedModel) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  useEffect(() => {
    isNewConvRef.current = true;
    initialMsgSentRef.current = false;
    loadHistory(chatId);
  }, [chatId]);

  useEffect(() => {
    if (initialMessage && !initialMsgSentRef.current && !loading) {
      initialMsgSentRef.current = true;
      setInput(initialMessage);
      if (initialFiles?.length) setUploadedFiles(initialFiles);
      onInitialMessageConsumed?.();
      setTimeout(() => {
        const btn = document.querySelector<HTMLButtonElement>('[data-direct-chat-send]');
        btn?.click();
      }, 100);
    }
  }, [initialMessage, loading, onInitialMessageConsumed, initialFiles]);

  const loadHistory = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/workstation/messages/${cid}`, { credentials: 'include' });
      const json = await res.json();
      const list: any[] = json?.data ?? json ?? [];
      if (list.length > 0) {
        isNewConvRef.current = false;
        const mapped: Message[] = list.map((m) => ({
          id: m.messageId ?? m.id,
          role: m.isCreatedByUser ? 'user' as const : 'assistant' as const,
          content: stripMetaBlocks(m.text ?? ''),
          reasoning: extractReasoning(m.text ?? ''),
          createdAt: m.createdAt,
          sender: m.sender,
        }));
        setMessages(mapped);
        const lastAssistant = [...list].reverse().find((m) => !m.isCreatedByUser);
        if (lastAssistant) lastParentIdRef.current = String(lastAssistant.messageId ?? lastAssistant.id);
      } else {
        setMessages([]);
        lastParentIdRef.current = null;
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

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

  // --- Voice recording using FileReader-based WAV conversion ---
  const cleanupVoice = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  const handleVoiceToggle = useCallback(async () => {
    setVoiceError('');
    if (isRecording) {
      if (mediaRecorderRef.current) {
        setVoiceProcessing(true);
        mediaRecorderRef.current.stop();
      }
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
      if (!mimeType) {
        setVoiceError('浏览器不支持录音');
        return;
      }

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
          if (text) {
            setInput((prev) => prev + text);
          } else {
            setVoiceError('未识别到语音内容');
            setTimeout(() => setVoiceError(''), 3000);
          }
        } catch (err) {
          console.error('Voice recognition error:', err);
          setVoiceError('语音识别失败');
          setTimeout(() => setVoiceError(''), 3000);
        } finally {
          cleanupVoice();
          setVoiceProcessing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      setVoiceError('无法访问麦克风');
      setTimeout(() => setVoiceError(''), 3000);
      cleanupVoice();
      setVoiceProcessing(false);
    }
  }, [isRecording, cleanupVoice]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setStreaming(true);
    streamBufRef.current = '';
    reasonBufRef.current = '';

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', reasoning: '' }]);
    requestAnimationFrame(() => scrollToBottom());

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload: any = {
        clientTimestamp: new Date().toISOString(),
        model: selectedModel,
        text,
        search_enabled: searchEnabled,
      };
      if (filesToSend.length > 0) payload.files = filesToSend.map((f) => ({ filepath: f.filepath, name: f.name }));
      if (!isNewConvRef.current) payload.conversationId = chatId;
      if (lastParentIdRef.current) payload.parentMessageId = lastParentIdRef.current;
      if (kbEnabled) payload.use_knowledge_base = { personal_knowledge_enabled: true, organization_knowledge_ids: [] };

      const response = await fetch(`${API_BASE}/api/v1/workstation/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotFinal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('data: ')) dataStr += line.slice(6);
            else if (line.startsWith('data:')) dataStr += line.slice(5);
          }
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.created) { isNewConvRef.current = false; continue; }
            if (parsed.final) {
              gotFinal = true;
              const respMsg = parsed.responseMessage;
              if (respMsg) lastParentIdRef.current = String(respMsg.messageId ?? respMsg.id);
              const title = parsed.title ?? parsed.conversation?.title;
              if (title && title !== 'New Chat' && onTitleUpdate) onTitleUpdate(chatId, title);
              continue;
            }
            if (parsed.event === 'on_message_delta') {
              for (const c of (parsed.data?.delta?.content ?? [])) {
                if (c.type === 'text' && c.text) {
                  if (c.replace) streamBufRef.current = c.text;
                  else streamBufRef.current += c.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.id === assistantId) updated[updated.length - 1] = { ...last, content: streamBufRef.current };
                    return updated;
                  });
                  scrollToBottom();
                }
              }
            } else if (parsed.event === 'on_reasoning_delta') {
              for (const c of (parsed.data?.delta?.content ?? [])) {
                if (c.type === 'think' && c.think) {
                  reasonBufRef.current += c.think;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.id === assistantId) updated[updated.length - 1] = { ...last, reasoning: reasonBufRef.current };
                    return updated;
                  });
                }
              }
            }
          } catch { /* skip */ }
        }
      }
      if (!gotFinal) setTimeout(() => fetchTitle(chatId), 2000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.id === assistantId && !last.content) updated[updated.length - 1] = { ...last, content: '抱歉，请求出错，请稍后重试。' };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, selectedModel, searchEnabled, kbEnabled, chatId, scrollToBottom, onTitleUpdate, uploadedFiles]);

  const fetchTitle = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workstation/gen_title`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ conversationId: cid }),
      });
      const json = await res.json();
      const title = json?.data?.title;
      if (title && title !== 'New Chat' && onTitleUpdate) onTitleUpdate(cid, title);
    } catch { /* ignore */ }
  }, [onTitleUpdate]);

  const handleStop = useCallback(() => { abortRef.current?.abort(); }, []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  return (
    <div className="relative flex flex-col h-full pb-[60px] md:pb-[88px]">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth">
        <div className="max-w-3xl mx-auto py-6 space-y-5">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} userName={user?.name || user?.username} />
          ))}
        </div>
      </div>

      {showScrollBtn && (
        <div className="absolute bottom-[132px] md:bottom-[160px] left-1/2 -translate-x-1/2 z-10">
          <button type="button" onClick={() => scrollToBottom()} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-lg text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer">
            <ChevronDown className="h-3.5 w-3.5" /><span>回到底部</span>
          </button>
        </div>
      )}

      <div className="flex-shrink-0 px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-1.5 mb-2">
            {models.length > 1 && (
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={streaming}
                className="h-7 px-2 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-colors">
                {models.map((m) => (<option key={m.id} value={m.id}>{m.displayName}</option>))}
              </select>
            )}
            <ToggleButton active={searchEnabled} onClick={() => setSearchEnabled((v) => !v)} disabled={streaming} icon={<Globe className="h-3.5 w-3.5" />} label="联网搜索" />
            <ToggleButton active={kbEnabled} onClick={() => setKbEnabled((v) => !v)} disabled={streaming} icon={<Database className="h-3.5 w-3.5" />} label="知识库" />
          </div>
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
              ref={inputRef} data-direct-chat-input value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="输入消息..." disabled={streaming} rows={2}
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
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={streaming || uploading}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-cyan-500 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="上传附件">
                  {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Paperclip className="h-4.5 w-4.5" />}
                </button>
                <button type="button" onClick={handleVoiceToggle} disabled={streaming || voiceProcessing}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRecording ? 'bg-red-500 text-white animate-pulse'
                      : voiceProcessing ? 'text-cyan-500'
                      : 'text-gray-400 dark:text-gray-500 hover:text-cyan-500 hover:bg-gray-100 dark:hover:bg-navy-700'
                  }`}
                  title={isRecording ? '停止录音' : voiceProcessing ? '识别中...' : '语音输入'}>
                  {voiceProcessing ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mic className="h-4.5 w-4.5" />}
                </button>
              </div>
              {streaming ? (
                <button type="button" onClick={handleStop} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer" title="停止生成">
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" data-direct-chat-send onClick={sendMessage} disabled={!input.trim() && uploadedFiles.length === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-200 dark:disabled:bg-navy-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors cursor-pointer" title="发送">
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

const ToggleButton = memo(({ active, onClick, disabled, icon, label }: {
  active: boolean; onClick: () => void; disabled: boolean; icon: React.ReactNode; label: string;
}) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
      ${active
        ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
        : 'bg-gray-50 dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-700 hover:bg-gray-100 dark:hover:bg-navy-700'
      } disabled:opacity-50 disabled:cursor-not-allowed`}>
    {icon}<span>{label}</span>
  </button>
));
ToggleButton.displayName = 'ToggleButton';

const AiAvatar = memo(() => (
  <div className="flex-shrink-0 w-8 h-8">
    <img src={getLogoUrl('login-logo-small')} alt="AI" className="w-8 h-8 object-contain dark:hidden" />
    <img src={getLogoUrl('logo-small-dark')} alt="AI" className="w-8 h-8 object-contain hidden dark:block" />
  </div>
));
AiAvatar.displayName = 'AiAvatar';

const UserAvatar = memo(({ name }: { name?: string }) => {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-white text-sm font-semibold">
      {initial}
    </div>
  );
});
UserAvatar.displayName = 'UserAvatar';

// --- File attachment display in messages ---
const FileAttachments = memo(({ files, isUser }: { files: any[]; isUser: boolean }) => (
  <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : ''}`}>
    {files.map((f: any) => (
      <div key={f.id || f.name}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
          isUser
            ? 'bg-cyan-600/80 text-white/90'
            : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-navy-700'
        }`}>
        <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
        <span className="font-medium truncate max-w-[160px]">{f.name}</span>
      </div>
    ))}
  </div>
));
FileAttachments.displayName = 'FileAttachments';

// --- Message Actions Bar ---

const MessageActions = memo(({ message }: { message: Message }) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<null | 'up' | 'down'>(null);
  const [showDislikeForm, setShowDislikeForm] = useState(false);
  const [dislikeReason, setDislikeReason] = useState('');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: modelData } = useGetWorkbenchModelsQuery();
  const hasTts = !!modelData?.tts_model?.id;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const handleTts = useCallback(async () => {
    if (ttsPlaying) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
      setTtsPlaying(false);
      return;
    }
    setTtsLoading(true);
    try {
      if (hasTts) {
        const res = await textToSpeech(message.content);
        let audioPath = '';
        if (typeof res === 'string') audioPath = res;
        else if (res?.data) audioPath = typeof res.data === 'string' ? res.data : res.data?.data || '';
        if (audioPath) {
          const url = `${API_BASE}${audioPath}`;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { setTtsPlaying(false); audioRef.current = null; };
          audio.onerror = () => { setTtsPlaying(false); audioRef.current = null; };
          await audio.play();
          setTtsPlaying(true);
          return;
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const plainText = message.content.replace(/[#*`>\-\[\]()!_~|]/g, '');
        const utter = new SpeechSynthesisUtterance(plainText);
        utter.lang = 'zh-CN';
        utter.rate = 1.0;
        utter.onend = () => setTtsPlaying(false);
        utter.onerror = () => setTtsPlaying(false);
        window.speechSynthesis.speak(utter);
        setTtsPlaying(true);
      }
    } catch { /* ignore */ } finally {
      setTtsLoading(false);
    }
  }, [message.content, ttsPlaying, hasTts]);

  const handleLike = useCallback(() => {
    setLiked((v) => v === 'up' ? null : 'up');
    setShowDislikeForm(false);
  }, []);

  const handleDislike = useCallback(() => {
    if (liked === 'down') { setLiked(null); setShowDislikeForm(false); }
    else setShowDislikeForm(true);
  }, [liked]);

  const submitDislike = useCallback(() => {
    setLiked('down');
    setShowDislikeForm(false);
    setDislikeReason('');
  }, [dislikeReason]);

  const btnCls = 'p-1.5 rounded-lg transition-colors cursor-pointer';
  const iconCls = 'h-3.5 w-3.5';

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={handleCopy} className={`${btnCls} text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400`} title="复制">
          {copied ? <Check className={`${iconCls} text-green-500`} /> : <Copy className={iconCls} />}
        </button>
        <button type="button" onClick={handleTts} disabled={ttsLoading} className={`${btnCls} ${ttsPlaying ? 'text-cyan-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'} disabled:opacity-50`} title={ttsPlaying ? '停止播放' : '朗读'}>
          {ttsLoading ? <Loader2 className={`${iconCls} animate-spin`} /> : ttsPlaying ? <Pause className={iconCls} /> : <Volume2 className={iconCls} />}
        </button>
        <button type="button" onClick={handleLike} className={`${btnCls} ${liked === 'up' ? 'text-cyan-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`} title="有帮助">
          <ThumbsUp className={iconCls} />
        </button>
        <button type="button" onClick={handleDislike} className={`${btnCls} ${liked === 'down' ? 'text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`} title="没帮助">
          <ThumbsDown className={iconCls} />
        </button>
      </div>
      {showDislikeForm && (
        <div className="mt-2 flex items-center gap-2">
          <input type="text" value={dislikeReason} onChange={(e) => setDislikeReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitDislike(); }}
            placeholder="请简述不满意的原因..."
            className="flex-1 h-8 px-3 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-300"
            autoFocus />
          <button type="button" onClick={submitDislike} className="h-8 px-3 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer">提交</button>
          <button type="button" onClick={() => setShowDislikeForm(false)} className="h-8 px-3 text-xs rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer">取消</button>
        </div>
      )}
    </div>
  );
});
MessageActions.displayName = 'MessageActions';

// --- Message Bubble ---

const MessageBubble = memo(({ message, userName }: { message: Message; userName?: string }) => {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[80%] flex flex-col items-end">
          {message.files && message.files.length > 0 && (
            <FileAttachments files={message.files} isUser />
          )}
          <div className="px-4 py-2.5 rounded-2xl rounded-br-md bg-cyan-500 text-white text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
        <UserAvatar name={userName} />
      </div>
    );
  }

  const hasReasoning = !!message.reasoning;
  const isEmpty = !message.content && !message.reasoning;

  return (
    <div className="flex justify-start gap-3">
      <AiAvatar />
      <div className="max-w-[85%] min-w-0 flex-1">
        {hasReasoning && (
          <button type="button" onClick={() => setShowReasoning((v) => !v)}
            className="mb-1.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{showReasoning ? '收起思考过程' : '查看思考过程'}</span>
          </button>
        )}
        {showReasoning && message.reasoning && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-amber-50/80 dark:bg-amber-900/10 border-l-2 border-amber-300 dark:border-amber-600 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
              <MarkdownLite content={message.reasoning} codeExecution={false} />
            </div>
          </div>
        )}
        {isEmpty ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400">正在思考...</span>
          </div>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2 prose-headings:my-2 text-gray-800 dark:text-gray-100 leading-relaxed">
              <MarkdownLite content={message.content} />
            </div>
            <MessageActions message={message} />
          </>
        )}
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// --- Utility ---

function stripMetaBlocks(text: string): string {
  return text.replace(/:::thinking\n[\s\S]*?\n:::/g, '').replace(/:::web\n[\s\S]*?\n:::/g, '').trim();
}

function extractReasoning(text: string): string {
  const match = text.match(/:::thinking\n([\s\S]*?)\n:::/);
  return match?.[1]?.trim() ?? '';
}

export default memo(DirectChat);
