import { CheckIcon, ChevronDown, CircleAlert, Loader2 } from "lucide-react";
import { useRecoilState } from "recoil";
import { useMemo, useState } from "react";
import { chatsState } from "../store/atoms";
import { cn } from "~/utils";
import useLocalize from "~/hooks/useLocalize";

export default function MessageRunlog({ data }) {
    const [open, setOpen] = useState(false)
    const t = useLocalize()

    const [_chatsState] = useRecoilState(chatsState)
    const assistantState = useMemo(() => {
        return _chatsState[data.chat_id].flow
    }, [_chatsState, data])

    const [title, lost] = useMemo(() => {
        let lost = false
        let title = ''
        const status = data.end ? t('com_runlog_used') : t('com_runlog_using')
        const assistant: any = assistantState as any
        if (data.category === 'flow') {
            const flow = assistant?.flow_list?.find((flow: any) => flow.id === data.message.tool_key)
            if (flow) {
                lost = flow.status === 1
                title = lost ? `${flow.name} ${t('com_runlog_offline')}` : `${status} ${flow.name}`
            } else {
                title = t('com_runlog_flow_deleted')
            }
        } else if (data.category === 'tool') {
            const tool = assistant?.tool_list?.find((tool: any) => tool.tool_key === data.message.tool_key)
            title = tool ? `${status} ${tool.name}` : t('com_runlog_tool_deleted')
        } else if (data.category === 'knowledge') {
            const knowledge = assistant?.knowledge_list?.find((knowledge: any) => knowledge.id === parseInt(data.message.tool_key))
            title = knowledge ? `${data.end ? t('com_runlog_searched') : t('com_runlog_searching')} ${knowledge.name}` : t('com_runlog_knowledge_deleted')
        } else {
            title = data.end ? t('com_runlog_done') : t('com_runlog_thinking')
        }
        return [title, lost]
    }, [assistantState, data])

    const listsLen = ((assistantState as any)?.tool_list?.length ?? 0)
        + ((assistantState as any)?.knowledge_list?.length ?? 0)
        + ((assistantState as any)?.flow_list?.length ?? 0)
    if (listsLen === 0) return null

    return <div className="mb-4 ml-11">
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden max-w-[85%]">
            <div className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => setOpen(!open)}>
                <div className="flex items-center gap-2 text-xs font-medium">
                    {
                        data.end ? (lost ? <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center" >
                            <CircleAlert size={10} className='text-white' />
                        </div> : <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" >
                            <CheckIcon size={10} className='text-white' />
                        </div>) :
                            <Loader2 size={14} className="text-primary animate-spin" />
                    }
                    <span className="text-gray-600 dark:text-gray-300">{title}</span>
                </div>
                <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
            </div>
            <div className={cn('bg-gray-50/30 dark:bg-gray-800/30 px-3 py-2 overflow-hidden text-xs', open ? 'h-auto' : 'h-0 !p-0')}>
                {data.thought.split('\n').map((line, index) => (
                    <p className="text-[12px] mb-0.5 leading-relaxed text-gray-500 dark:text-gray-400" key={index}>{line}</p>
                ))}
            </div>
        </div>
    </div>
};
