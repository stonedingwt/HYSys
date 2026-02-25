import Markdown from "~/components/Chat/Messages/Content/Markdown";
import { TextToSpeechButton } from "~/components/Voice/TextToSpeechButton";

export default function MessageRemark({ readOnly, logo, title, message }:
    { readOnly?: boolean, logo: React.ReactNode, title: string, message: string }) {

    return <div className="animate-msg-in py-3">
        <div className="group flex flex-row justify-start pr-[20px]">
            <div className="relative flex flex-shrink-0 flex-col items-end ml-1 mr-4">
                {logo}
            </div>
            <div className="relative flex w-full flex-col items-start min-w-0 pt-3">
                {message && <div className="bs-mkdown text-[15px] leading-relaxed text-gray-700 dark:text-gray-300"><Markdown content={message} isLatestMessage={false} webContent={undefined} /></div>}
            </div>
        </div>
        {message && !readOnly && (
            <div className="flex mt-1.5 ml-[68px] opacity-0 group-hover:opacity-100 transition-opacity">
                <TextToSpeechButton messageId={message} text={message} />
            </div>
        )}
    </div>
};
