import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2, Globe, Database, Paperclip, StopCircle, ChevronDown } from 'lucide-react';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

const __env = (globalThis as any).__APP_ENV__;
const API_BASE = __env?.BASE_URL ?? '';

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
}

function DirectChat({ chatId, models, onTitleUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [kbEnabled, setKbEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => models[0]?.id ?? '');
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamBufRef = useRef('');
  const reasonBufRef = useRef('');
  const lastParentIdRef = useRef<string | null>(null);
  const isNewConvRef = useRef(true);

  useEffect(() => {
    if (models.length && !selectedModel) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  useEffect(() => {
    isNewConvRef.current = true;
    loadHistory(chatId);
  }, [chatId]);

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
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(gap > 120);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
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
      if (!isNewConvRef.current) {
        payload.conversationId = chatId;
      }
      if (lastParentIdRef.current) {
        payload.parentMessageId = lastParentIdRef.current;
      }
      if (kbEnabled) {
        payload.use_knowledge_base = { personal_knowledge_enabled: true, organization_knowledge_ids: [] };
      }

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
            if (line.startsWith('data: ')) {
              dataStr += line.slice(6);
            } else if (line.startsWith('data:')) {
              dataStr += line.slice(5);
            }
          }
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);

            if (parsed.created) {
              isNewConvRef.current = false;
              continue;
            }

            if (parsed.final) {
              gotFinal = true;
              const respMsg = parsed.responseMessage;
              if (respMsg) {
                lastParentIdRef.current = String(respMsg.messageId ?? respMsg.id);
              }
              const title = parsed.title ?? parsed.conversation?.title;
              if (title && title !== 'New Chat' && onTitleUpdate) {
                onTitleUpdate(chatId, title);
              }
              continue;
            }

            if (parsed.event === 'on_message_delta') {
              const contentArr = parsed.data?.delta?.content ?? [];
              for (const c of contentArr) {
                if (c.type === 'text' && c.text) {
                  if (c.replace) {
                    streamBufRef.current = c.text;
                  } else {
                    streamBufRef.current += c.text;
                  }
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.id === assistantId) {
                      updated[updated.length - 1] = { ...last, content: streamBufRef.current };
                    }
                    return updated;
                  });
                  scrollToBottom();
                }
              }
            } else if (parsed.event === 'on_reasoning_delta') {
              const contentArr = parsed.data?.delta?.content ?? [];
              for (const c of contentArr) {
                if (c.type === 'think' && c.think) {
                  reasonBufRef.current += c.think;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.id === assistantId) {
                      updated[updated.length - 1] = { ...last, reasoning: reasonBufRef.current };
                    }
                    return updated;
                  });
                }
              }
            } else if (parsed.event === 'on_search_result') {
              // search results handled by backend, no special UI needed for now
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      if (!gotFinal) {
        setTimeout(() => fetchTitle(chatId), 2000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.id === assistantId && !last.content) {
            updated[updated.length - 1] = { ...last, content: '抱歉，请求出错，请稍后重试。' };
          }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, selectedModel, searchEnabled, kbEnabled, chatId, scrollToBottom, onTitleUpdate]);

  const fetchTitle = useCallback(async (cid: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/workstation/gen_title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId: cid }),
      });
      const json = await res.json();
      const title = json?.data?.title;
      if (title && title !== 'New Chat' && onTitleUpdate) {
        onTitleUpdate(cid, title);
      }
    } catch { /* ignore */ }
  }, [onTitleUpdate]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-lg text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>回到底部</span>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-navy-800/60 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Toolbar */}
          <div className="flex items-center gap-1.5 mb-2">
            {models.length > 1 && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={streaming}
                className="h-7 px-2 text-xs rounded-lg border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-colors"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
            )}
            <ToggleButton
              active={searchEnabled}
              onClick={() => setSearchEnabled((v) => !v)}
              disabled={streaming}
              icon={<Globe className="h-3.5 w-3.5" />}
              label="联网搜索"
            />
            <ToggleButton
              active={kbEnabled}
              onClick={() => setKbEnabled((v) => !v)}
              disabled={streaming}
              icon={<Database className="h-3.5 w-3.5" />}
              label="知识库"
            />
          </div>
          {/* Input row */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                data-direct-chat-input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                disabled={streaming}
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 dark:border-navy-700 bg-gray-50/50 dark:bg-navy-800/50 px-4 py-3 pr-12 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all min-h-[44px] max-h-[160px] leading-relaxed"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 160) + 'px';
                  t.style.overflow = t.scrollHeight > 160 ? 'auto' : 'hidden';
                }}
              />
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer"
                title="停止生成"
              >
                <StopCircle className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                data-direct-chat-send
                onClick={sendMessage}
                disabled={!input.trim()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-200 dark:disabled:bg-navy-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors cursor-pointer"
                title="发送"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ToggleButton = memo(({ active, onClick, disabled, icon, label }: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
      ${active
        ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
        : 'bg-gray-50 dark:bg-navy-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-navy-700 hover:bg-gray-100 dark:hover:bg-navy-700'
      }
      disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    {icon}
    <span>{label}</span>
  </button>
));

const MessageBubble = memo(({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-cyan-500 text-white text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const hasReasoning = !!message.reasoning;
  const isEmpty = !message.content && !message.reasoning;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] min-w-0">
        {hasReasoning && (
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="mb-1.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
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
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2 prose-headings:my-2 text-gray-800 dark:text-gray-100 leading-relaxed">
            <MarkdownLite content={message.content} />
          </div>
        )}
      </div>
    </div>
  );
});

function stripMetaBlocks(text: string): string {
  return text.replace(/:::thinking\n[\s\S]*?\n:::/g, '').replace(/:::web\n[\s\S]*?\n:::/g, '').trim();
}

function extractReasoning(text: string): string {
  const match = text.match(/:::thinking\n([\s\S]*?)\n:::/);
  return match?.[1]?.trim() ?? '';
}

ToggleButton.displayName = 'ToggleButton';
MessageBubble.displayName = 'MessageBubble';

export default memo(DirectChat);
