import { lazy, Suspense } from 'react';
import { MessageSquare, Bot } from 'lucide-react';
import type { Task } from './types';

const AppChat = lazy(() => import('~/pages/appChat'));

interface Props {
  task: Task;
}

export default function TaskChat({ task }: Props) {
  if (!task.chat_id || !task.agent_id) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ backgroundColor: '#F7F7F7' }}>
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
    <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#F7F7F7' }}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-gray-400 text-sm" style={{ backgroundColor: '#F7F7F7' }}>
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
        />
      </Suspense>
    </div>
  );
}
