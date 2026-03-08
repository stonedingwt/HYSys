import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import AppAvator from "~/components/Avator";
import HeaderTitle from "~/components/Chat/HeaderTitle";
import { useAuthContext } from "~/hooks";
import ChatInput from "./ChatInput";
import ChatMessages from "./ChatMessages";
import { currentChatState } from "./store/atoms";
import useChatHelpers from "./useChatHelpers";
import { useWebSocket } from "./useWebsocket";

export default function ChatView({ data, cid, v, readOnly, embedded = false }) {
    const { user } = useAuthContext();
    const help = useChatHelpers()
    useWebSocket(help)
    const chatState = useRecoilValue(currentChatState)
    const hasUserMessages = (chatState?.messages ?? []).some(msg => msg.category === 'question');

    const Logo = useMemo(() => {
        return (
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full flex-shrink-0">
                <AppAvator className="h-full w-full" url={data.logo} id={data.name} flowType={data.flow_type} />
            </div>
        )
    }, [data]);

    if (!hasUserMessages && !embedded) {
        return (
            <div className="relative h-full flex flex-col bg-gray-50 dark:bg-gray-900">
                <HeaderTitle
                    readOnly={readOnly}
                    conversation={{ title: data.name, flowId: data.id, conversationId: cid, flowType: data.flow_type }}
                    logo={Logo}
                />
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full mb-4">
                            <AppAvator className="h-full w-full" url={data.logo} id={data.name} flowType={data.flow_type} />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                            有什么可以帮你的吗？
                        </h2>
                    </div>
                    <div className="w-full max-w-[720px]">
                        <ChatInput v={v} readOnly={readOnly} />
                    </div>
                </div>
            </div>
        );
    }

    const bgCls = embedded
        ? 'bg-gradient-to-b from-gray-50/80 via-white to-gray-50/30 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900'
        : 'bg-gray-50 dark:bg-gray-900';

    return <div className={`relative h-full flex flex-col ${bgCls}`}>
        {!embedded && (
            <HeaderTitle
                readOnly={readOnly}
                conversation={{ title: data.name, flowId: data.id, conversationId: cid, flowType: data.flow_type }}
                logo={Logo}
            />
        )}
        <div className="flex-1 min-h-0 flex flex-col">
            {hasUserMessages ? (
                <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0">
                        <div className="h-full max-w-[920px] mx-auto px-4">
                            <ChatMessages
                                useName={user?.username}
                                title={data.name}
                                logo={Logo}
                                readOnly={readOnly}
                                disabledSearch={data.flow_type === 10}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full mb-3">
                        <AppAvator className="h-full w-full" url={data.logo} id={data.name} flowType={data.flow_type} />
                    </div>
                    <h2 className="text-base font-medium text-gray-600 dark:text-gray-300">
                        有什么可以帮你的吗？
                    </h2>
                </div>
            )}
            <div className="max-w-[920px] w-full mx-auto px-4 pb-3 pt-1">
                <ChatInput v={v} readOnly={readOnly} embedded={embedded} />
            </div>
        </div>
    </div>
};
