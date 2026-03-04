import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, History } from 'lucide-react';
import ConversationList from './ConversationList';
import AppChat from '~/pages/appChat';

const __env = (globalThis as any).__APP_ENV__;
const API_BASE = __env?.BASE_URL ?? '';

const STARTERS = [
  '帮我查询最近的销售订单',
  '查询客户列表信息',
  '公司有哪些供应商？',
  '帮我搜索知识库文档',
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
    if (chatId) {
      sessionStorage.setItem('ws-assistant-chat-id', chatId);
    }
  }, [chatId]);

  const handleSelectConversation = useCallback((id: string) => {
    setChatId(id);
  }, []);

  const handleNewConversation = useCallback(() => {
    const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setChatId(newId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleStarterClick = useCallback((text: string) => {
    const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setChatId(newId);
    setTimeout(() => {
      const input = document.getElementById('bs-send-input') as HTMLTextAreaElement | null;
      const btn = document.getElementById('bs-send-btn') as HTMLButtonElement | null;
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        nativeSetter?.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => btn?.click(), 100);
      }
    }, 500);
  }, []);

  const flowId = config?.dailyChatFlowId;

  const showWelcome = !chatId;

  return (
    <div className="flex flex-col h-full overflow-hidden relative bg-gradient-to-b from-slate-50/80 via-white to-slate-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`flex-shrink-0 bg-white/50 dark:bg-gray-900/50 border-r border-gray-200/60 dark:border-gray-800/60 transition-all duration-300 ease-in-out overflow-hidden ${
            historyOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <div className="h-full flex flex-col w-64">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/50 dark:border-gray-800/50">
              <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">对话记录</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                currentId={chatId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                refreshKey={refreshKey}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header */}
          <header className="flex-shrink-0 h-12 flex items-center justify-between px-5 bg-transparent z-10">
            <div className="flex items-center">
              {!historyOpen && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="显示历史"
                >
                  <History className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNewConversation}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
                title="新对话"
              >
                <Plus className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              {historyOpen && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-blue-500 bg-blue-50 dark:bg-blue-900/30 active:scale-95 transition-all"
                  title="隐藏历史"
                >
                  <History className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </header>

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            {showWelcome ? (
              <div className="flex flex-col items-center justify-center h-full px-6 animate-in fade-in duration-500">
                <div className="max-w-lg w-full flex flex-col items-center text-center">
                  <h1 className="text-[28px] font-semibold tracking-tight leading-tight mb-3 bg-gradient-to-br from-gray-800 to-gray-500 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                    {config?.welcomeMessage || '您好，请问有什么可以帮您？'}
                  </h1>
                  <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-10 leading-relaxed max-w-sm">
                    {config?.functionDescription || '智能业务助手 · 为您提供销售订单、客户信息、知识库等专业数据查询与分析服务'}
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStarterClick(s)}
                        className="group px-4 py-3.5 rounded-2xl text-left transition-all duration-200
                          bg-white dark:bg-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800
                          border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600
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
            ) : config === null ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中...</div>
            ) : flowId ? (
              <AppChat
                key={chatId}
                chatId={chatId!}
                flowId={flowId}
                flowType="10"
                embedded
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                <div className="text-center">
                  <p className="mb-2">未配置助手工作流</p>
                  <p className="text-xs text-gray-300">请在系统设置中配置 dailyChatFlowId</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
