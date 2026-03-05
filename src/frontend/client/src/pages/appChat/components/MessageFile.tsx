import { formatStrTime } from "~/utils"
import ChatFile from "./ChatFile"

export default function MessageFile({ data, title, logo }) {

    return <div className="group flex mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 max-w-[85%]">
            <div className="flex-shrink-0">
                {logo}
            </div>
            <div className="min-w-0 flex-1">
                {data.sender && <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">{data.sender}</span>}
                <ChatFile fileName={data.files[0]?.file_name} filePath={data.files[0]?.file_url} />
                <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatStrTime(data.create_time, 'MM 月 dd 日 HH:mm')}</span>
                </div>
            </div>
        </div>
    </div>
};
