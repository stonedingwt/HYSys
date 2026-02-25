import { useState } from "react";
import { copyTrackingApi, likeChatApi } from "~/api/apps";
import MessageIcon from "~/components/ui/icon/Message";
import { TextToSpeechButton } from "~/components/Voice/TextToSpeechButton";

const enum ThumbsState {
    Default = 0,
    ThumbsUp,
    ThumbsDown
}

export default function MessageButtons({ id, text, onCopy, data, onUnlike, children = null }) {
    const [state, setState] = useState<ThumbsState>(data)
    const [copied, setCopied] = useState(false)

    const handleClick = (type: ThumbsState) => {
        setState(_type => {
            const newType = type === _type ? ThumbsState.Default : type
            likeChatApi(id, newType);
            return newType
        })
        if (state !== ThumbsState.ThumbsDown && type === ThumbsState.ThumbsDown) onUnlike?.(id)
    }

    const handleCopy = (e) => {
        setCopied(true)
        onCopy()
        setTimeout(() => {
            setCopied(false)
        }, 2000);
        copyTrackingApi(id)
    }

    return <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {children}
        <TextToSpeechButton messageId={String(id)} text={text} />
        <MessageIcon
            type='copy'
            className={`cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 ${copied && 'text-primary hover:text-primary'}`}
            onClick={handleCopy}
        />
        <MessageIcon
            type='like'
            className={`cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 ${state === ThumbsState.ThumbsUp && 'text-primary hover:text-primary'}`}
            onClick={() => handleClick(ThumbsState.ThumbsUp)}
        />
        <MessageIcon
            type='unLike'
            className={`cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 ${state === ThumbsState.ThumbsDown && 'text-primary hover:text-primary'}`}
            onClick={() => handleClick(ThumbsState.ThumbsDown)}
        />
    </div>
};
