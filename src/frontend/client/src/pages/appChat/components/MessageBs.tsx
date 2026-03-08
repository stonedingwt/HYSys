import { CheckIcon, ChevronDown, Copy, Check, Loader2, ThumbsUp, ThumbsDown, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

    return <div className="mb-3">
        <div className="rounded-lg border border-gray-100 dark:border-white/[0.06] overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-50/50 dark:bg-white/[0.04]" onClick={() => setOpen(!open)}>
                {loading ? <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 size={14} className="text-primary animate-spin" />
                    <span>{t('com_bs_reasoning_thinking')}</span>
                </div>
                    : <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckIcon size={10} className='text-white' />
                        </div>
                        <span>{t('com_bs_reasoning_done')}</span>
                    </div>
                }
                <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
            </div>
            <div className={cn('px-3 py-2 overflow-hidden text-xs text-gray-500 bg-gray-50/30 dark:bg-white/[0.03] leading-relaxed', open ? 'h-auto' : 'h-0 !p-0')}>
                {msg.split('\n').map((line, index) => (
                    <p className="text-[12px] mb-0.5 leading-relaxed" key={index}>{line}</p>
                ))}
            </div>
        </div>
    </div>
}

const TYPING_LABELS = [
    '正在理解您的问题…',
    '正在检索相关信息…',
    '正在分析并整理结果…',
    '即将为您呈现回复…',
];

const TypingDots = () => {
    const [labelIdx, setLabelIdx] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setLabelIdx(i => (i + 1) % TYPING_LABELS.length), 3200);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gray-50/80 dark:bg-white/[0.05] border border-gray-100 dark:border-white/[0.08]">
            <div className="flex items-center gap-[5px]">
                {[0, 1, 2].map(i => (
                    <span
                        key={i}
                        className="block w-[7px] h-[7px] rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
                    />
                ))}
            </div>
            <span
                key={labelIdx}
                className="text-[13px] text-gray-400 dark:text-gray-500 font-medium animate-in fade-in duration-300"
            >
                {TYPING_LABELS[labelIdx]}
            </span>
        </div>
    );
};

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

    return <div className="group flex mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 max-w-[85%] pl-3 border-l-2 border-cyan-400 dark:border-cyan-400/80 dark:shadow-[0_0_12px_rgba(34,211,238,0.15)]">
            <div className="flex-shrink-0">
                {logo}
            </div>
            <div className="min-w-0 flex-1">
                <ReasoningLog loading={!data.end && (data.reasoning_log || reasoningLog)} msg={data.reasoning_log || reasoningLog} />
                {!(data.reasoning_log && !message && !data.files.length) && <>
                    {data.sender && <span className="text-xs text-gray-400 mb-1 block">{data.sender}</span>}
                    {message || data.files.length ?
                        <div ref={messageRef}>
                            {message && <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed
                                prose-p:mb-2 prose-p:leading-relaxed
                                prose-headings:font-semibold prose-headings:text-gray-800 dark:prose-headings:text-gray-200
                                prose-table:text-sm prose-th:bg-gray-50 dark:prose-th:bg-white/[0.04]
                                prose-strong:text-gray-800 dark:prose-strong:text-gray-200
                                prose-blockquote:border-blue-300 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400`}>
                                <Markdown content={message} isLatestMessage={false} webContent={undefined} />
                            </div>}
                            {data.files.length > 0 && <div className="mt-2 space-y-1">{data.files.map(file => <ChatFile key={file.path} fileName={file.name} filePath={file.path} />)}</div>}
                            {data.receiver && <p className="text-blue-500 text-sm mt-1">@ {data.receiver.user_name}</p>}
                        </div>
                        : <TypingDots />
                    }
                </>}
                {data.end && (message || data.files.length > 0) && (
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageSource
                            extra={data.extra || {}}
                            end={data.end}
                            source={data.source}
                            onSource={() => onSource?.({ messageId: data.id, message })}
                        />
                        <MessageButtons
                            id={data.id}
                            data={data.liked}
                            text={message}
                            onUnlike={onUnlike}
                            onCopy={handleCopyMessage}
                        >
                            <span className="text-[11px] text-gray-400">{formatStrTime(data.create_time, 'MM 月 dd 日 HH:mm')}</span>
                        </MessageButtons>
                    </div>
                )}
            </div>
        </div>
    </div>
};
