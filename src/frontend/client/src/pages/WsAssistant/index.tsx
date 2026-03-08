import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, PanelLeftClose, PanelLeft, Sparkles, Send, Paperclip, Mic, Loader2 } from 'lucide-react';
import ConversationList from './ConversationList';
import DirectChat from './DirectChat';
import AppChat from '~/pages/appChat';

const __env = (globalThis as any).__APP_ENV__;
const API_BASE = __env?.BASE_URL ?? '';

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
  const [chatId, setChatId] = useState<string | null>(() => {
    return sessionStorage.getItem('ws-assistant-chat-id') || null;
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

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

  const startChatWithText = useCallback((text: string) => {
    const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingMessage(text);
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
                onStarterClick={startChatWithText}
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
                onInitialMessageConsumed={() => setPendingMessage(null)}
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
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    onSend(text);
  }, [input, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full pb-[68px] md:pb-[92px]">
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
      <div className="flex-shrink-0 border-t border-gray-100/80 dark:border-navy-800/60 bg-white/90 dark:bg-navy-900/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息开始对话..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-200 dark:border-navy-700 bg-gray-50/50 dark:bg-navy-800/50 px-4 py-3 pr-12 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/50 transition-all min-h-[44px] max-h-[120px] leading-relaxed"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                  t.style.overflow = t.scrollHeight > 120 ? 'auto' : 'hidden';
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-200 dark:disabled:bg-navy-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 transition-colors cursor-pointer"
              title="发送"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
