import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState, useRecoilValue } from "recoil";
import { Textarea } from "~/components";
import SpeechToTextComponent from "~/components/Voice/SpeechToText";
import { useRecordingAudioLoading } from "~/components/Voice/textToSpeechStore";
import { useGetWorkbenchModelsQuery } from "~/data-provider";
import { useLocalize } from "~/hooks";
import InputFiles from "./components/InputFiles";
import { mepConfState, currentRunningState } from "./store/atoms";
import { useAreaText, FileTypes } from "./useAreaText";
import { useFileDropAndPaste } from "./useFileDropAndPaste";
import DragDropOverlay from "~/components/Chat/Input/Files/DragDropOverlay";
import { ArrowUp, Square, SlidersHorizontal, Globe, FileSpreadsheet, ShoppingCart, Check, Paperclip } from "lucide-react";

const TOOL_WORKFLOWS = {
    tp: { id: 'dc06032fa9e942038861da1d22944ec5', label: '根据TP生成跟单任务', icon: FileSpreadsheet },
    salesOrder: { id: '2d615d62073d4970ac63acf4d6dd957f', label: '根据销售订单生成跟单任务', icon: ShoppingCart },
};

const ALL_ACCEPTS = FileTypes.ALL.join(',');

export default function ChatInput({ readOnly, v, embedded = false }) {
    const navigate = useNavigate();
    const [mepConfig] = useRecoilState(mepConfState);
    const { inputDisabled, error: inputMsg, showStop } = useRecoilValue(currentRunningState) || {};
    const { accepts, inputRef, setChatFiles, handleInput, handleSendClick, handleStopClick } = useAreaText();

    const [fileUploading, setFileUploading] = useState(false);
    const [audioOpening] = useRecordingAudioLoading();
    const localize = useLocalize();
    const { data: modelData } = useGetWorkbenchModelsQuery();
    const showVoice = modelData?.asr_model?.id;

    const inputFilesRef = useRef(null);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const toolsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
                setToolsOpen(false);
            }
        };
        if (toolsOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [toolsOpen]);

    const { isDragging, handlePaste } = useFileDropAndPaste({
        enabled: !readOnly && !inputDisabled,
        onFilesReceived: (files) => {
            inputFilesRef.current?.upload(files);
        }
    });

    const placholder = useMemo(() => {
        return inputDisabled ?
            (inputMsg?.code ? localize(`api_errors.${inputMsg.code}`, inputMsg?.data) : ' ')
            : '请输入您的问题...'
    }, [inputDisabled, inputMsg, localize]);

    useEffect(() => {
        inputDisabled && setTimeout(() => {
            inputRef.current?.focus()
        }, 60)
    }, [inputDisabled]);

    const canSend = !inputDisabled && !fileUploading && !readOnly && !audioOpening;

    const handleSend = () => {
        if (!canSend) return;
        handleSendClick();
        inputFilesRef.current?.clear();
    };

    const handleToolSelect = (toolKey: string) => {
        if (toolKey === 'webSearch') {
            setWebSearchEnabled(prev => !prev);
            setToolsOpen(false);
            return;
        }
        const workflow = TOOL_WORKFLOWS[toolKey];
        if (workflow) {
            const chatId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            navigate(`/chat/${chatId}/${workflow.id}/10`);
            setToolsOpen(false);
        }
    };

    return (
        <div className="relative">
            {isDragging && <DragDropOverlay />}

            <div className="relative rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 transition-colors focus-within:border-gray-300 dark:focus-within:border-gray-500 shadow-sm">
                <InputFiles
                    ref={inputFilesRef}
                    v={v}
                    showVoice={showVoice}
                    accepts={accepts || ALL_ACCEPTS}
                    disabled={readOnly || audioOpening || inputDisabled}
                    size={mepConfig?.uploaded_files_maximum_size || 50}
                    onChange={(files => {
                        setFileUploading(!files);
                        setChatFiles(files);
                    })}
                />

                <Textarea
                    id="bs-send-input"
                    ref={inputRef}
                    rows={1}
                    style={{ height: 66 }}
                    disabled={readOnly || inputDisabled}
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={placholder}
                    className="resize-none bg-transparent border-none shadow-none pl-4 pr-4 py-3 text-[15px] min-h-[66px] max-h-60 scrollbar-hide leading-6 focus-visible:ring-0"
                />

                <div className="flex items-center justify-between px-3 pb-2.5">
                    <div className="flex items-center gap-3">
                        <button
                            className="flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            disabled={readOnly || audioOpening || inputDisabled}
                            onClick={() => document.getElementById('chat-file-input')?.click()}
                            title="上传附件"
                        >
                            <Paperclip className="w-[18px] h-[18px]" strokeWidth={1.8} />
                        </button>

                        {!embedded && (
                            <div className="relative" ref={toolsRef}>
                                <button
                                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                                        webSearchEnabled
                                            ? 'text-primary'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                    } disabled:opacity-30 disabled:pointer-events-none`}
                                    disabled={readOnly || inputDisabled}
                                    onClick={() => setToolsOpen(prev => !prev)}
                                >
                                    <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={1.8} />
                                    <span>工具</span>
                                </button>

                                {toolsOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                            onClick={() => handleToolSelect('tp')}
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                            <span className="flex-1 text-gray-700 dark:text-gray-300">根据TP生成跟单任务</span>
                                        </button>
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                            onClick={() => handleToolSelect('salesOrder')}
                                        >
                                            <ShoppingCart className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            <span className="flex-1 text-gray-700 dark:text-gray-300">根据销售订单生成跟单任务</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {showVoice && (
                            <SpeechToTextComponent
                                disabled={inputDisabled || readOnly || showStop}
                                onChange={(e) => { if (inputRef.current) inputRef.current.value += e }}
                            />
                        )}

                        {showStop ? (
                            <button
                                className="flex items-center justify-center w-8 h-8 bg-gray-800 dark:bg-gray-200 rounded-full cursor-pointer transition-transform active:scale-95"
                                onClick={handleStopClick}
                            >
                                <Square className="w-3.5 h-3.5 text-white dark:text-gray-800 fill-current" />
                            </button>
                        ) : (
                            <button
                                id="bs-send-btn"
                                className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-300 dark:border-gray-500 text-gray-400 transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none hover:bg-gray-100 dark:hover:bg-gray-700"
                                disabled={!canSend}
                                onClick={handleSend}
                            >
                                <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!embedded && mepConfig?.dialog_tips && (
                <p className="text-center text-xs pt-2 text-gray-400">{mepConfig.dialog_tips}</p>
            )}
        </div>
    );
};
