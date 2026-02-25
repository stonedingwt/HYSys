import { CheckIcon, ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ChatMessageType } from "~/@types/chat";
import Markdown from "~/components/Chat/Messages/Content/Markdown";
import { cn, copyText, formatStrTime } from "~/utils";
import ChatFile from "./ChatFile";
import MessageButtons from "./MessageButtons";
import MessageSource from "./MessageSource";
import useLocalize from "~/hooks/useLocalize";


export const ReasoningLog = ({ loading, msg = '' }) => {
    const t = useLocalize()
    const [open, setOpen] = useState(true)

    if (!msg) return null

    return <div className="py-1 mb-3">
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-50/50 dark:bg-gray-800/50" onClick={() => setOpen(!open)}>
                {loading ? <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 size={14} className="text-primary animate-spin" />
                    <span>{t('com_bs_reasoning_thinking')}</span>
                </div>
                    : <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckIcon size={10} className='text-white' />
                        </div>
                        <span>{t('com_bs_reasoning_done')}</span>
                    </div>
                }
                <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
            </div>
            <div className={cn('px-3 py-2 overflow-hidden text-sm text-gray-500 bg-gray-50/30 dark:bg-gray-800/30', open ? 'h-auto' : 'h-0 !p-0')}>
                {msg.split('\n').map((line, index) => (
                    <p className="text-[13px] mb-0.5 leading-relaxed" key={index}>{line}</p>
                ))}
            </div>
        </div>
    </div>
}

const TypingDots = () => (
    <div className="flex items-center gap-1 py-2 px-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-blink" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-blink [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-dot-blink [animation-delay:0.4s]" />
    </div>
);

export default function MessageBs({ logo, title, data, onUnlike = () => { }, readOnly, onSource }:
    { logo: React.ReactNode, title: string, data: ChatMessageType, onUnlike?: any, readOnly?: boolean, onSource?: any }) {

    const t = useLocalize()
    const [message, reasoningLog] = useMemo(() => {
        const msg = typeof data.message === 'string' ? data.message : data.message?.msg
        if (!msg) {
            return ['', '']
        }
        const regex = /<think>(.*?)<\/think>/s;
        const match = msg.match(regex);
        if (match) {
            return [msg.replace(regex, ''), match[1]]
        }
        return [msg, '']
    }, [data.message])

    const messageRef = useRef<HTMLDivElement>(null)
    const handleCopyMessage = () => {
        copyText(messageRef.current)
    }

    return <div className="animate-msg-in py-3">
        <div className="group flex flex-row justify-start pr-[20px]">
            {/* Avatar */}
            <div className="relative flex flex-shrink-0 flex-col items-end ml-1 mr-4">
                {logo}
            </div>
            {/* Content */}
            <div className="relative flex w-full flex-col items-start min-w-0 pt-3">
                <ReasoningLog loading={!data.end && (data.reasoning_log || reasoningLog)} msg={data.reasoning_log || reasoningLog} />
                {!(data.reasoning_log && !message && !data.files.length) && <>
                    {data.sender && <span className="text-xs text-gray-400 mb-1">{data.sender}</span>}
                    {message || data.files.length ?
                        <div ref={messageRef}>
                            {message && <div className="bs-mkdown text-[15px] leading-relaxed text-gray-800 dark:text-gray-200"><Markdown content={message} isLatestMessage={false} webContent={undefined} /></div>}
                            {data.files.length > 0 && <div className="mt-2 space-y-1">{data.files.map(file => <ChatFile key={file.path} fileName={file.name} filePath={file.path} />)}</div>}
                            {data.receiver && <p className="text-blue-500 text-sm mt-1">@ {data.receiver.user_name}</p>}
                        </div>
                        : <TypingDots />
                    }
                </>}
                {data.end && (
                    <div className="flex items-center gap-2 mt-2">
                        <MessageSource
                            extra={data.extra || {}}
                            end={data.end}
                            source={data.source}
                            onSource={() => onSource?.({ messageId: data.id, message })}
                        />
                        {!readOnly && <MessageButtons
                            id={data.id}
                            data={data.liked}
                            text={message}
                            onUnlike={onUnlike}
                            onCopy={handleCopyMessage}
                        >
                            <span className="text-xs text-gray-400">{formatStrTime(data.create_time, 'MM 月 dd 日 HH:mm')}</span>
                        </MessageButtons>}
                    </div>
                )}
            </div>
        </div>
    </div>
};
