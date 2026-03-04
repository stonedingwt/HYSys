import { BookOpen } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecoilState, useRecoilValue } from "recoil";
import { File_Accept } from "~/common";
import { Button, TextareaAutosize } from "~/components/ui";
import SpeechToTextComponent from "~/components/Voice/SpeechToText";
import { useRecordingAudioLoading } from "~/components/Voice/textToSpeechStore";
import {
  useGetBsConfig,
  useGetFileConfig,
  useGetUserLinsightCountQuery,
  useGetWorkbenchModelsQuery,
} from "~/data-provider";
import {
  fileConfig as defaultFileConfig,
  isAssistantsEndpoint,
  mergeFileConfig,
  supportsFiles,
} from "~/data-provider/data-provider/src";
import {
  useAutoSave,
  useHandleKeyUp,
  useLocalize,
  useQueryParams,
  useRequiresKey,
  useSubmitMessage,
  useTextarea,
} from "~/hooks";
import {
  useAddedChatContext,
  useAssistantsMapContext,
  useChatContext,
  useChatFormContext,
} from "~/Providers";
import store from "~/store";
import { checkIfScrollable, cn, removeFocusRings } from "~/utils";
import { ChatToolDown } from "./ChatFormTools";
import CollapseChat from "./CollapseChat";
import FileFormWrapper from "./Files/FileFormWrapper";
import SameSopSpan, { sameSopLabelState } from "./SameSopSpan";
import SendButton from "./SendButton";
import StopButton from "./StopButton";
import { ChatKnowledge } from "./ChatKnowledge";
type SelectedOrgKb = {
  id: string;
  name: string;
};
const ChatForm = ({ isLingsi, setShowCode, readOnly, index = 0 }) => {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  useQueryParams({ textAreaRef });

  const localize = useLocalize();

  const [isOutMaxToken, setIsOutMaxToken] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const [searchType, setSearchType] = useRecoilState(store.searchType);
  const [isSearch, setIsSearch] = useRecoilState(store.isSearch);
  const [chatModel, setChatModel] = useRecoilState(store.chatModel);
  // 组织知识库选中（多选）
  const [selectedOrgKbs, setSelectedOrgKbs] = useRecoilState(
    store.selectedOrgKbs
  );
  const [enableOrgKb, setEnableOrgKb] = useRecoilState(store.enableOrgKb);

  const [chatStatesMap, setChatStatesMap] = useRecoilState(store.chatStatesMap);
  const isSearching = useRecoilValue(store.isSearching);
  const [showStopButton, setShowStopButton] = useRecoilState(
    store.showStopButtonByIndex(index)
  );
  const [showPlusPopover, setShowPlusPopover] = useRecoilState(
    store.showPlusPopoverFamily(index)
  );
  const [showMentionPopover, setShowMentionPopover] = useRecoilState(
    store.showMentionPopoverFamily(index)
  );
  const isInitialMount = useRef(true);
  const [chatId, setChatId] = useRecoilState(store.chatId);
  const chatDirection = useRecoilValue(store.chatDirection).toLowerCase();
  const isRTL = chatDirection === "rtl";

  const { requiresKey } = useRequiresKey();
  const handleKeyUp = useHandleKeyUp({
    index,
    textAreaRef,
    setShowPlusPopover,
    setShowMentionPopover,
  });

  const { data: bsConfig } = useGetBsConfig();
  const [sameSopLabel] = useRecoilState(sameSopLabelState);
  const {
    handlePaste,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTextarea({
    textAreaRef,
    submitButtonRef,
    setIsScrollable,
    disabled: !!(requiresKey ?? false),
    placeholder: isLingsi
      ? sameSopLabel
        ? "请输入与此案例相似的目标"
        : bsConfig?.linsightConfig?.input_placeholder ||
        localize("com_linsight_input_placeholder")
      : bsConfig?.inputPlaceholder,
  });

  const {
    files,
    setFiles,
    dailyFiles,
    setDailyFiles,
    conversation,
    isSubmitting,
    filesLoading,
    newConversation,
    handleStopGenerating,
  } = useChatContext();
  const methods = useChatFormContext();
  const {
    addedIndex,
    generateConversation,
    conversation: addedConvo,
    setConversation: setAddedConvo,
    isSubmitting: isSubmittingAdded,
  } = useAddedChatContext();
  const showStopAdded = useRecoilValue(store.showStopButtonByIndex(addedIndex));

  const { clearDraft } = useAutoSave({
    conversationId: useMemo(() => conversation?.conversationId, [conversation]),
    textAreaRef,
    files,
    setFiles,
    dailyFiles,
    setDailyFiles,
  });

  const navigator = useNavigate();

  const assistantMap = useAssistantsMapContext();
  const { submitMessage, submitPrompt } = useSubmitMessage({ clearDraft });

  const { endpoint: _endpoint, endpointType } = conversation ?? {
    endpoint: null,
  };
  const endpoint = endpointType ?? _endpoint;
  // 知识库是否开启
  const isKnowledgeOn = enableOrgKb || searchType === "knowledgeSearch";

  // 联网搜索是否开启
  const isNetSearchOn = searchType === "netSearch";

  const { data: fileConfig = defaultFileConfig } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const endpointFileConfig = fileConfig.endpoints[endpoint ?? ""];
  const invalidAssistant = useMemo(
    () =>
      isAssistantsEndpoint(conversation?.endpoint) &&
      (!(conversation?.assistant_id ?? "") ||
        !assistantMap?.[conversation?.endpoint ?? ""][
        conversation?.assistant_id ?? ""
        ]),
    [conversation?.assistant_id, conversation?.endpoint, assistantMap]
  );
  const disableInputs = useMemo(() => {
    if (readOnly) return true;
    if (isLingsi) return false;
    if (!bsConfig?.models) return true;
    if (bsConfig.models.length === 0) return true;
    return !!((requiresKey ?? false) || invalidAssistant);
  }, [requiresKey, invalidAssistant, isLingsi, readOnly, bsConfig]);

  const { ref, ...registerProps } = methods.register("text", {
    required: true,
    onChange: (e) => {
      methods.setValue("text", e.target.value, { shouldValidate: true });
    },
  });
  const isVisual = useMemo(() => {
    if (!bsConfig?.models || !chatModel?.id) return false;
    const model = bsConfig.models.find(item => item.id == chatModel.id);
    return !!model?.visual;
  }, [bsConfig?.models, chatModel?.id]);
  useEffect(() => {
    if (!isSearching && textAreaRef.current && !disableInputs) {
      textAreaRef.current.focus();
    }
  }, [isSearching, disableInputs]);

  useEffect(() => {
    if (textAreaRef.current) {
      checkIfScrollable(textAreaRef.current);
    }
  }, []);

  useEffect(() => {
    if (files.size >= 1) {
      setIsSearch(false);
    }
    let total = 0;
    files.forEach((item: any) => {
      total = item?.token + total;
    });
    const isOut = total > 300000;
    setIsOutMaxToken(isOut);
  }, [files]);

  useEffect(() => {
    searchType || enableOrgKb ? setIsSearch(true) : setIsSearch(false);
  }, [searchType, enableOrgKb]);
  const prevChatId = useRef("");
  useEffect(() => {
    if (conversation?.conversationId === prevChatId.current) {
      return;
    }

    if (conversation?.conversationId === "new") {
      if (bsConfig?.knowledgeBase?.enabled) {
        setEnableOrgKb(true);
        setSearchType("knowledgeSearch");
      } else {
        setSelectedOrgKbs([]);
        setEnableOrgKb(false);
        setSearchType("");
      }
      setChatId("new");
      prevChatId.current = "new";
      return;
    }

    if (prevChatId.current === "new" && conversation?.conversationId) {
      const newChatId = conversation.conversationId;
      const savedState = chatStatesMap[newChatId];

      if (savedState) {
        setSelectedOrgKbs(savedState.selectedOrgKbs || []);
        setEnableOrgKb(savedState.enableOrgKb ?? false);
        setSearchType(savedState.searchType ?? "");
      } else {
        const newChatState = {
          selectedOrgKbs: selectedOrgKbs,
          enableOrgKb: enableOrgKb,
          searchType: searchType,
        };

        // 保存到新的 conversationId 中
        setChatStatesMap((prev) => ({
          ...prev,
          [newChatId]: newChatState,
        }));
      }

      setChatId(newChatId);
      prevChatId.current = newChatId;
      return;
    }

    // 从实际 ID 切换到另一个实际 ID
    if (
      conversation?.conversationId &&
      prevChatId.current &&
      prevChatId.current !== "new"
    ) {
      const newChatId = conversation.conversationId;
      // 先保存当前会话的状态
      if (prevChatId.current) {
        setChatStatesMap((prev) => ({
          ...prev,
          [prevChatId.current]: {
            selectedOrgKbs,
            enableOrgKb,
            searchType,
          },
        }));
      }

      const savedState = chatStatesMap[newChatId];
      if (savedState) {
        setSelectedOrgKbs(savedState.selectedOrgKbs || []);
        setEnableOrgKb(savedState.enableOrgKb || false);
        setSearchType(savedState.searchType || "");
      } else {
        setSelectedOrgKbs([]);
        setEnableOrgKb(false);
        setSearchType("");
      }

      setChatId(newChatId);
      prevChatId.current = newChatId;
      return;
    }
    if (conversation?.conversationId) {
      const newChatId = conversation.conversationId;

      const savedState = chatStatesMap[newChatId];
      if (savedState) {
        setSelectedOrgKbs(savedState.selectedOrgKbs || []);
        setEnableOrgKb(savedState.enableOrgKb || false);
        setSearchType(savedState.searchType || "");
      } else {
        setSelectedOrgKbs([]);
        setEnableOrgKb(false);
        setSearchType("");
      }

      setChatId(newChatId);
      prevChatId.current = newChatId;
    } else {
      // conversationId 不存在的情况
      setChatId("");
      prevChatId.current = conversation?.conversationId;
    }
  }, [conversation?.conversationId]);

  const endpointSupportsFiles: boolean =
    supportsFiles[endpointType ?? endpoint ?? ""] ?? false;
  const isUploadDisabled: boolean = endpointFileConfig?.disabled ?? false;

  const baseClasses = cn(
    "md:py-3.5 m-0 w-full resize-none py-[13px] bg-surface-tertiary placeholder-black/50 dark:placeholder-white/50 [&:has(textarea:focus)]:shadow-[0_2px_6px_rgba(0,0,0,.5)]",
    isCollapsed ? "max-h-[52px]" : "max-h-96",
    isLingsi && "bg-transparent"
  );

  const uploadActive = endpointSupportsFiles && !isUploadDisabled;
  const speechClass = isRTL
    ? `pr-${uploadActive ? "6" : "4"} pl-6`
    : `pl-${uploadActive ? "6" : "4"} pr-6`;

  // linsight工具
  const [tools, setTools] = useState([]);
  // 获取剩余次数
  const { data: count, refetch } = useGetUserLinsightCountQuery();
  useEffect(() => {
    bsConfig?.linsight_invitation_code && refetch();
  }, [bsConfig?.linsight_invitation_code]);

  const accept = useMemo(() => {
    if (isLingsi) {
      return bsConfig?.enable_etl4lm
        ? File_Accept.Linsight_Etl4lm
        : File_Accept.Linsight;
    }
    return File_Accept.Default;
  }, [isLingsi, bsConfig]);

  const { data: modelData } = useGetWorkbenchModelsQuery();
  const showVoice = modelData?.asr_model?.id || bsConfig?.voiceInput?.enabled;

  const [audioOpening] = useRecordingAudioLoading();
  const noModel = useMemo(() => {
    if (isLingsi) return false;
    if (!bsConfig?.models) return true;
    if (bsConfig.models.length === 0) return true;
    return false;
  }, [isLingsi, bsConfig]);

  // 自动选择第一个可用模型（去掉 ModelSelect 后，自动初始化）
  useEffect(() => {
    if (!bsConfig?.models || bsConfig.models.length === 0) return;
    const hasCurrent = bsConfig.models.find(
      (opt) => String(opt.id) === String(chatModel.id)
    );
    if (!hasCurrent) {
      setChatModel({
        id: Number(bsConfig.models[0].id),
        name: bsConfig.models[0].displayName || bsConfig.models[0].name || "",
      });
    }
  }, [bsConfig?.models]);

  return (
    <form
      onSubmit={methods.handleSubmit((data) => {
        if (bsConfig?.linsight_invitation_code && isLingsi && count === 0)
          return setShowCode(true);
        submitMessage({
          ...data,
          linsight: isLingsi,
          tools,
          // knowledge: {
          //   personal: searchType === "knowledgeSearch",
          //   orgKbIds: enableOrgKb ? selectedOrgKbs.map((kb) => kb.id) : [],
          // },
        });
        isLingsi && navigator("/linsight/new");
      })}
      className={cn(
        "mx-auto flex flex-row gap-3 transition-all duration-200 last:mb-2",
        maximizeChatSpace ? "w-full max-w-full" : "md:max-w-3xl xl:max-w-5xl"
      )}
    >
      <div
        className={`relative flex h-full flex-1 items-stretch md:flex-col ${!isLingsi && "overflow-hidden"
          }`}
      >
        {/* 切换模型 */}
        {/* {showPlusPopover && !isAssistantsEndpoint(endpoint) && (
          <Mention
            setShowMentionPopover={setShowPlusPopover}
            newConversation={generateConversation}
            textAreaRef={textAreaRef}
            commandChar="+"
            placeholder="com_ui_add_model_preset"
            includeAssistants={false}
          />
        )}
        {showMentionPopover && (
          <Mention
            setShowMentionPopover={setShowMentionPopover}
            newConversation={newConversation}
            textAreaRef={textAreaRef}
          />
        )} */}
        {/* 快捷提示词选择 */}
        {/* <PromptsCommand index={index} textAreaRef={textAreaRef} submitPrompt={submitPrompt} /> */}
        <div
          className={cn(
            "transitional-all relative flex w-full flex-grow flex-col overflow-hidden rounded-3xl bg-surface-tertiary pb-8 z-10 text-text-primary duration-200 border border-transparent",
            isLingsi &&
            "border-blue-400 dark:border-blue-500/30 bg-gradient-to-b from-[#F2F5FF] to-white dark:from-[#1e293b] dark:to-[#1a1d24]"
          )}
        >
          {/* 临时对话 */}
          {/* <TemporaryChat
            isTemporaryChat={isTemporaryChat}
            setIsTemporaryChat={setIsTemporaryChat}
          /> */}
          {/* 操作已添加的对话 */}
          {/* <TextareaHeader addedConvo={addedConvo} setAddedConvo={setAddedConvo} /> */}
          {/* {bsConfig?.fileUpload.enabled && */}
          {/* 做同款 */}
          {isLingsi && <SameSopSpan></SameSopSpan>}
          {/* 知识库标签：管理端启用知识库时默认静默启用，不显示标签 */}
          {false && (enableOrgKb || searchType === "knowledgeSearch") &&
            selectedOrgKbs.length > 0 &&
            !isLingsi && (
              <div className="mx-2 mt-2 max-h-[100px] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedOrgKbs.map((kb) => (
                    <div
                      key={kb.id}
                      className="group relative flex items-center gap-1
              px-2 py-1 pr-6
              rounded-full bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600
              text-xs text-slate-700 dark:text-slate-200
              max-w-[200px]
              hover:bg-slate-50 dark:hover:bg-gray-600 transition-all duration-200"
                    >
                      {kb.id === "personal_knowledge_base" ? (
                        <BookOpen
                          size={14}
                          className="text-slate-500 shrink-0"
                        />
                      ) : (
                        <img
                          className="size-[14px] text-slate-500 shrink-0"
                          src={__APP_ENV__.BASE_URL + "/assets/books.svg"}
                          alt=""
                        />
                      )}

                      <span className="truncate flex-1 min-w-0 transition-all duration-200 group-hover:text-[11px]">
                        {kb.name}
                      </span>

                      {setSelectedOrgKbs && (
                        <button
                          onClick={() => {
                            setSelectedOrgKbs((prev) =>
                              prev.filter((i) => i.id !== kb.id)
                            );
                            if (kb.id === "personal_knowledge_base") {
                              setSearchType("");
                            }
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2
                  opacity-0 group-hover:opacity-100
                  w-4 h-4 flex items-center justify-center
                  rounded-full hover:bg-slate-200
                  text-slate-400 transition-opacity duration-200"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          <FileFormWrapper
            accept={accept}
            showVoice={showVoice}
            fileTip={!isLingsi && !isVisual}
            noUpload={!bsConfig?.fileUpload?.enabled}
            disableInputs={disableInputs || audioOpening}
            disabledSearch={isSearch && !isLingsi}
            selectedOrgKbs={selectedOrgKbs}
            setSelectedOrgKbs={setSelectedOrgKbs}
            enableOrgKb={enableOrgKb}
          >
            <>
              <CollapseChat
                isCollapsed={isCollapsed}
                isScrollable={isScrollable}
                setIsCollapsed={setIsCollapsed}
              />
              <TextareaAutosize
                {...registerProps}
                ref={(e) => {
                  ref(e);
                  textAreaRef.current = e;
                }}
                disabled={disableInputs}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onHeightChange={() => {
                  if (textAreaRef.current) {
                    const scrollable = checkIfScrollable(textAreaRef.current);
                    setIsScrollable(scrollable);
                  }
                }}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                tabIndex={0}
                data-testid="text-input"
                rows={2}
                onFocus={() => isCollapsed && setIsCollapsed(false)}
                onClick={() => isCollapsed && setIsCollapsed(false)}
                style={{ height: isLingsi ? 124 : 84, overflowY: "auto" }}
                className={cn(
                  baseClasses,
                  speechClass,
                  removeFocusRings,
                  "transition-[max-height] duration-200",
                  "transition-[height] duration-500",
                  isLingsi ? "min-h-32" : "min-h-24"
                )}
              />
            </>
          </FileFormWrapper>
          {/* 发送和停止 */}
          <div className="absolute bottom-2 right-3 flex gap-2 items-center">
            {showVoice && (
              <SpeechToTextComponent
                disabled={readOnly || noModel}
                onChange={(e) => {
                  const text = textAreaRef.current.value + e;
                  methods.setValue("text", text, { shouldValidate: true });
                }}
              />
            )}
            {(isSubmitting || isSubmittingAdded) &&
              (showStopButton || showStopAdded) ? (
              <StopButton
                stop={handleStopGenerating}
                setShowStopButton={setShowStopButton}
              />
            ) : (
              <SendButton
                ref={submitButtonRef}
                isLingsi={isLingsi}
                control={methods.control}
                disabled={
                  !!(
                    filesLoading ||
                    isSubmitting ||
                    disableInputs ||
                    isOutMaxToken
                  ) || audioOpening
                }
              />
            )}
          </div>
          {/* 深度思考 联网 */}
          <div className="absolute bottom-2 left-3 flex gap-2">
            {/* 知识库：管理端启用后默认静默启用，不显示控件 */}
            <ChatToolDown
              tools={tools}
              setTools={setTools}
              linsi={isLingsi}
              config={bsConfig}
              searchType={searchType}
              setSearchType={setSearchType}
              disabled={!!files.size || readOnly || isKnowledgeOn}
            />
          </div>
        </div>
        {/* 气泡 - 仅在有内容时显示 */}
      </div>
    </form>
  );
};

export default memo(ChatForm);
