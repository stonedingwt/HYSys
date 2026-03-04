import { Loader2 } from "lucide-react";
import useLocalize from "~/hooks/useLocalize";

export default function MessageNodeRun({ data }) {

    const t = useLocalize()

    return <div className="mb-4 ml-11">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <Loader2 size={14} className="text-primary animate-spin" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{data.message.name}</span>
        </div>
    </div>
};
