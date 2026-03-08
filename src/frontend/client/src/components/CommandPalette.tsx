import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, ListChecks, LayoutGrid, Bell, User,
  Users, Shield, MessageSquarePlus, ArrowRight, Command,
} from 'lucide-react';
import { cn } from '~/utils';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'ai';
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const go = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  const commands: CommandItem[] = [
    { id: 'new-chat', label: '新建 AI 对话', icon: Sparkles, action: () => go('/c/new'), category: 'ai', keywords: ['ai', 'chat', '对话', '新建'] },
    { id: 'assistant', label: 'AI 助手', icon: MessageSquarePlus, action: () => go('/ws-assistant'), category: 'ai', keywords: ['assistant', '助手'] },
    { id: 'task-center', label: '任务中心', icon: ListChecks, action: () => go('/ws-task-center'), category: 'navigation', keywords: ['task', '任务'] },
    { id: 'app-center', label: '应用中心', icon: LayoutGrid, action: () => go('/apps'), category: 'navigation', keywords: ['app', '应用', 'agent'] },
    { id: 'messages', label: '消息中心', icon: Bell, action: () => go('/ws-message-center'), category: 'navigation', keywords: ['message', '消息', '通知'] },
    { id: 'profile', label: '个人中心', icon: User, action: () => go('/ws-profile'), category: 'navigation', keywords: ['profile', '个人', '设置'] },
    { id: 'users', label: '用户管理', icon: Users, action: () => go('/ws-users'), category: 'navigation', keywords: ['user', '用户'] },
    { id: 'roles', label: '角色管理', icon: Shield, action: () => go('/ws-roles'), category: 'navigation', keywords: ['role', '角色'] },
  ];

  const filtered = query.trim()
    ? commands.filter(cmd => {
      const q = query.toLowerCase();
      return cmd.label.toLowerCase().includes(q) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(q));
    })
    : commands;

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-cmd-overlay"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-lg mx-4',
          'bg-white/95 dark:bg-[rgba(10,15,30,0.92)]',
          'backdrop-blur-[40px] saturate-[180%]',
          'border border-slate-200/60 dark:border-white/[0.08]',
          'rounded-2xl shadow-floating overflow-hidden',
          'animate-panel-in',
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-200/60 dark:border-white/[0.06]">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索页面、执行命令..."
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2 px-2">
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              没有找到匹配的结果
            </div>
          )}
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                'transition-colors duration-100 cursor-pointer',
                idx === selectedIndex
                  ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
              )}
            >
              <cmd.icon className="w-4 h-4 flex-shrink-0 opacity-60" />
              <span className="text-sm flex-1">{cmd.label}</span>
              {idx === selectedIndex && (
                <ArrowRight className="w-3.5 h-3.5 opacity-40" />
              )}
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200/60 dark:border-white/[0.06] text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span>↑↓ 导航</span>
            <span>↵ 确认</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K 打开</span>
          </div>
        </div>
      </div>
    </div>
  );
}
