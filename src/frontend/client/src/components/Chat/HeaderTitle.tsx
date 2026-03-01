import { History, SquarePen } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { ContextType } from '~/common';
import { useGetBsConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import ShareChat from '../Share/ShareChat';

const types = {
  1: 'skill',
  5: 'assistant',
  10: 'workflow',
  15: 'workbench_chat'
}
export default function HeaderTitle({ conversation, logo, readOnly }) {
  const localize = useLocalize();
  const context = useOutletContext<ContextType>();
  const navigate = useNavigate();
  const { data: bsConfig } = useGetBsConfig();

  const handleNewChat = () => {
    const flowId = bsConfig?.dailyChatFlowId || conversation?.flowId;
    if (flowId) {
      const chatId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      navigate(`/chat/${chatId}/${flowId}/10`);
    } else {
      const btn = document.getElementById('create-convo-btn');
      if (btn) {
        btn.click();
      } else {
        navigate('/c/new');
      }
    }
  };

  return (
    <div className="sticky top-0 z-10 flex h-12 w-full items-center justify-between px-5 bg-[rgba(247,247,247,0.9)] dark:bg-gray-900/80 dark:text-white" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center gap-2 min-w-0" />
      <div className="flex items-center gap-1">
        <button
          onClick={handleNewChat}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={localize('com_ui_new_chat')}
        >
          <SquarePen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
        <button
          onClick={() => context?.setShowChatHistory?.(!context?.showChatHistory)}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={localize('com_ui_chat_history')}
        >
          <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
        {!readOnly && <ShareChat type={types[conversation?.flowType]} flowId={conversation?.flowId} chatId={conversation?.conversationId || ''} />}
      </div>
    </div>
  );
}
