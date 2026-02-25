import { useMemo } from "react";
import { emitAreaTextEvent, EVENT_TYPE } from "../useAreaText"

export default function GuideWord({ data }) {

    const randomItems = useMemo(() => {
        if (data.length < 3) {
            return data;
        }
        const randomIndices = [];
        while (randomIndices.length < 3) {
            const randIndex = Math.floor(Math.random() * data.length);
            if (!randomIndices.includes(randIndex)) {
                randomIndices.push(randIndex);
            }
        }
        return randomIndices.map(index => data[index]);
    }, [data]);

    return <div className="space-y-2 mt-2 ml-[68px] animate-msg-in">
        {
            randomItems.map(word =>
                <p
                    className="text-sm border border-gray-200 dark:border-gray-700 w-fit px-4 py-1.5 rounded-full text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    onClick={() => emitAreaTextEvent({ action: EVENT_TYPE.INPUT_SUBMIT, data: word })}
                    key={word}
                >
                    {word}
                </p>
            )
        }
    </div>
};
