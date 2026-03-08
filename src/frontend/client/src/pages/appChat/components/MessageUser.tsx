import { RefreshCw, Search, SquarePen } from "lucide-react";
import { useMemo } from "react";
import { useRecoilState } from "recoil";
import { useLocalize } from "~/hooks";
import { formatStrTime } from "~/utils";
import { mepConfState } from "../store/atoms";
import { emitAreaTextEvent, EVENT_TYPE } from "../useAreaText";

function getInitials(name?: string): string {
    if (!name) return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    if (trimmed.includes(' ')) {
        const parts = trimmed.split(/\s+/);
        return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
    }
    return trimmed[0].toUpperCase();
}

export default function MessageUser({ useName, data, showButton, disabledSearch = false, readOnly }) {
    const initials = useMemo(() => getInitials(useName), [useName]);
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

    return <div className="flex justify-end mb-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-start gap-3 max-w-[75%] group">
            <div className="flex flex-col items-end min-w-0">
                <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-blue-500 dark:bg-white/[0.05] dark:text-gray-200 text-white text-sm leading-relaxed shadow-sm">
                    <span className="break-all whitespace-break-spaces">{msg}</span>
                </div>
                {!readOnly && (
                    <div className="flex items-center gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-0.5 text-gray-400 dark:text-gray-500">
                            {showButton && <SquarePen className="size-4 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => handleResend(false)} />}
                            {showButton && <RefreshCw className="size-4 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => handleResend(true)} />}
                            {!disabledSearch && config?.dialog_quick_search && <Search className="size-4 p-0.5 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={handleSearch} />}
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatStrTime(data.create_time, 'MM 月 dd 日 HH:mm')}</span>
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-[11px] font-bold leading-none select-none">{initials}</span>
            </div>
        </div>
    </div>
};
