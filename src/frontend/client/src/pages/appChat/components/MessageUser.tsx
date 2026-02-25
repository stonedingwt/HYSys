import { RefreshCw, Search, SquarePen } from "lucide-react";
import { useMemo } from "react";
import { useRecoilState } from "recoil";
import { useLocalize } from "~/hooks";
import { formatStrTime } from "~/utils";
import { mepConfState } from "../store/atoms";
import { emitAreaTextEvent, EVENT_TYPE } from "../useAreaText";

export default function MessageUser({ useName, data, showButton, disabledSearch = false, readOnly }) {
    const avatar = useMemo(() => {
        return <div className="w-12 h-12 min-w-12 text-white bg-primary rounded-full flex justify-center items-center text-sm font-medium">{useName.substring(0, 2).toUpperCase()}</div>
    }, [useName])
    const [config] = useRecoilState(mepConfState)
    const localize = useLocalize()

    const msg = useMemo(() => {
        const res = typeof data.message === 'string' ? data.message : data.message[data.chatKey]
        const hackStr = typeof res === 'string' ? res : JSON.stringify(data.message)
        return hackStr.replace(/\\n/g, '\n')
    }, [])

    const handleResend = (send) => {
        emitAreaTextEvent({
            action: EVENT_TYPE.RE_ENTER,
            autoSend: send,
            text: msg
        })
    }

    const handleSearch = () => {
        window.open(config?.dialog_quick_search + encodeURIComponent(msg))
    }

    return <div className="flex w-full py-3 animate-msg-in">
        <div className="w-fit group min-h-8 max-w-[90%] ml-auto">
            <div className="flex flex-row-reverse justify-end pl-[20px]">
                <div className="relative flex flex-shrink-0 flex-col items-end ml-4 mr-1">
                    {avatar}
                </div>
                <div className="relative flex flex-col items-end min-w-0">
                    <div className="rounded-2xl px-4 py-2.5">
                        <div className="text-[#0D1638] dark:text-[#CFD5E8] text-[15px] leading-relaxed break-all whitespace-break-spaces">{msg}</div>
                    </div>
                </div>
            </div>
            {!readOnly && (
                <div className="flex justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 mr-[68px]">
                    <div className="flex gap-0.5 text-gray-400">
                        {showButton && <SquarePen className="size-5 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => handleResend(false)} />}
                        {showButton && <RefreshCw className="size-5 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => handleResend(true)} />}
                        {!disabledSearch && config?.dialog_quick_search && <Search className="size-5 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={handleSearch} />}
                    </div>
                    <span className="text-xs text-gray-400 self-center">{formatStrTime(data.create_time, 'MM 月 dd 日 HH:mm')}</span>
                </div>
            )}
        </div>
    </div>
};
