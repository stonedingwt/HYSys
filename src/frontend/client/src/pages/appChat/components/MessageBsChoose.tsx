import { CheckIcon, File } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ChatMessageType } from "~/@types/chat";
import { Button, Textarea } from "~/components";
import Markdown from "~/components/Chat/Messages/Content/Markdown";
import { TextToSpeechButton } from "~/components/Voice/TextToSpeechButton";
import useLocalize from "~/hooks/useLocalize";
import { downloadFile } from "~/utils";
import { emitAreaTextEvent, EVENT_TYPE } from "../useAreaText";
import { changeMinioUrl } from "./ResouceModal";

export default function MessageBsChoose({ type = 'choose', disabled, logo, data, flow }
    : { type?: string, disabled?: Boolean, logo: React.ReactNode, data: ChatMessageType }) {
    const t = useLocalize()
    const [selected, setSelected] = useState(data.message.hisValue || '')
    const handleSelect = (obj) => {
        if (selected) return
        emitAreaTextEvent({
            action: EVENT_TYPE.MESSAGE_INPUT, data: {
                nodeId: data.message.node_id,
                message: JSON.stringify({
                    ...data.message,
                    hisValue: obj.id
                }),
                msgId: data.id,
                data: {
                    [data.message.key]: obj.id
                }
            }
        })

        setSelected(obj.id)
    }

    const handleDownloadFile = (file) => {
        downloadFile(changeMinioUrl(file.path), file.name)
    }

    const textRef = useRef(null)
    const inputSended = useMemo(() => !!data.message.hisValue || false, [data.message.hisValue])
    const handleSend = () => {
        const val = textRef.current.value
        if (!val.trim()) return
        emitAreaTextEvent({
            action: EVENT_TYPE.MESSAGE_INPUT, data: {
                nodeId: data.message.node_id,
                message: JSON.stringify({
                    ...data.message,
                    hisValue: val
                }),
                msgId: data.id,
                data: {
                    [data.message.key]: val
                }
            }
        })
    }

    const files = useMemo(() => {
        return typeof data.files === 'string' ? [] : data.files
    }, [data.files])

    return <MessageWarper flow={flow} logo={logo} >
        <div className="group">
            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                <div><Markdown content={data.message.msg} isLatestMessage={false} webContent={undefined} /></div>
                <div className="not-prose space-y-2 mt-2">
                    {files.map((file) => <div
                        key={file.name}
                        className="flex gap-2.5 w-56 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
                        onClick={() => handleDownloadFile(file)}
                    >
                        <div className="flex items-center text-gray-400"><File size={14} /></div>
                        <div>
                            <h1 className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</h1>
                            <p className="text-[11px] text-gray-400 mt-0.5">{t('com_bschoose_click_to_download')}</p>
                        </div>
                    </div>)
                    }
                </div>
                <div className="not-prose mt-3">
                    {type === 'input' ?
                        <div>
                            <Textarea
                                className="w-full rounded-xl border-gray-200 dark:border-gray-700 focus:border-blue-400 focus:ring-blue-400/20"
                                ref={textRef}
                                disabled={inputSended || disabled}
                                defaultValue={data.message.input_msg || data.message.hisValue}
                            />
                            <div className="flex justify-end mt-2">
                                <Button
                                    className="h-8 rounded-lg"
                                    disabled={inputSended || disabled}
                                    onClick={handleSend}
                                >{inputSended ? t('com_bschoose_confirmed') : t('com_bschoose_confirm')}</Button>
                            </div>
                        </div>
                        : <div className="space-y-2">
                            {data.message.options.map(opt => <div
                                key={opt.id}
                                className={`min-w-56 border rounded-xl px-4 py-3 cursor-pointer flex justify-between items-center break-all text-sm transition-all
                                    ${selected === opt.id
                                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
                                    }`}
                                onClick={() => handleSelect(opt)}
                            >
                                <span className="text-gray-700 dark:text-gray-300">{opt.label}</span>
                                {selected === opt.id && <div className="size-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ml-2" >
                                    <CheckIcon size={10} className='text-white' />
                                </div>}
                            </div>)
                            }
                        </div>
                    }
                    <div className="flex justify-end py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {data.message.msg && <TextToSpeechButton messageId={String(data.id)} text={data.message.msg} />}
                    </div>
                </div>
            </div>
        </div>
    </MessageWarper>
};


export const MessageWarper = ({ flow, logo, children }) => {
    return <div className="group flex mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 max-w-[85%]">
            <div className="flex-shrink-0">
                {logo}
            </div>
            <div className="min-w-0 flex-1">
                {children}
            </div>
        </div>
    </div>
}
