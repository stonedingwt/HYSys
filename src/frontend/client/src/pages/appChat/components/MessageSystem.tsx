import { Copy, Check, ThumbsUp, ThumbsDown, Volume2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import Markdown from "~/components/Chat/Messages/Content/Markdown";
import { useToastContext } from "~/Providers";
import { useLocalize } from "~/hooks";
import { copyText } from "~/utils";

export default function MessageSystem({ title, logo, data }) {
    const { showToast } = useToastContext();
    const localize = useLocalize();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        if (data.thought) {
            navigator.clipboard.writeText(data.thought.toString()).then(() => {
                setCopied(true);
                showToast({ message: localize('com_message_content_copied'), status: 'success' });
                setTimeout(() => setCopied(false), 2000);
            });
        }
    }, [data.thought]);

    const logMkdown = useMemo(
        () => (
            data.thought && <Markdown content={data.thought.toString()} isLatestMessage={false} webContent={undefined} />
        ),
        [data.thought]
    )

    const border = { system: 'border-slate-200 dark:border-slate-700', question: 'border-amber-200 dark:border-amber-800', processing: 'border-cyan-200 dark:border-cyan-800', answer: 'border-lime-200 dark:border-lime-800', report: 'border-slate-200 dark:border-slate-700', guide: 'border-transparent' }

    const btnCls = 'p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors';

    return <div className="group flex mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 max-w-[85%]">
            <div className="flex-shrink-0">
                {logo}
            </div>
            <div className="min-w-0 flex-1">
                <div className={`relative rounded-xl px-4 py-3 border text-sm leading-relaxed dark:bg-gray-900/50 ${data.category === 'guide' ? 'bg-blue-50/50' : 'bg-gray-50/50'} ${border[data.category || 'system']}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">{logMkdown}</div>
                </div>
                {data.thought && (
                    <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="复制" onClick={handleCopy} className={btnCls}>
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
};
