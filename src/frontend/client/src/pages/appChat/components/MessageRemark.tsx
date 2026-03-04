import { Copy, Check } from "lucide-react";
import { useCallback, useState } from "react";
import Markdown from "~/components/Chat/Messages/Content/Markdown";
import { TextToSpeechButton } from "~/components/Voice/TextToSpeechButton";

export default function MessageRemark({ readOnly, logo, title, message }:
    { readOnly?: boolean, logo: React.ReactNode, title: string, message: string }) {

    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        if (message) {
            navigator.clipboard.writeText(message).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        }
    }, [message]);

    const btnCls = 'p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors';

    return <div className="group flex mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 max-w-[85%]">
            <div className="flex-shrink-0">
                {logo}
            </div>
            <div className="min-w-0 flex-1">
                {message && <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300"><Markdown content={message} isLatestMessage={false} webContent={undefined} /></div>}
                {message && (
                    <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TextToSpeechButton messageId={message} text={message} />
                        <button title="复制" onClick={handleCopy} className={btnCls}>
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
};
