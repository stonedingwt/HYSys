import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import type { Task } from './types';

const AppChat = lazy(() => import('~/pages/appChat'));

class ChatErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TaskChat] render error:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F7F7F7] dark:bg-transparent">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 mb-3">
            <Bot className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">对话加载失败</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 text-center max-w-xs">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  task: Task;
}

export default function TaskChat({ task }: Props) {
  if (!task.chat_id || !task.agent_id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F7F7F7] dark:bg-gray-900">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
          <Bot className="w-8 h-8 text-blue-400" />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">未关联客服智能体</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          请在数据字典中配置 task_type_agent 分类，将任务类型与智能体关联后即可对话
        </p>
      </div>
    );
  }

  return (
    <ChatErrorBoundary>
      <div className="flex-1 overflow-hidden flex flex-col bg-[#F7F7F7] dark:bg-transparent">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm bg-[#F7F7F7] dark:bg-transparent">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent mb-3" />
                <span>加载智能体对话...</span>
              </div>
            </div>
          }
        >
          <AppChat
            chatId={task.chat_id}
            flowId={task.agent_id}
            flowType="10"
            embedded
          />
        </Suspense>
      </div>
    </ChatErrorBoundary>
  );
}
