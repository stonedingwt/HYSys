import { useState } from "react";
import { MessageSquare, MessagesSquareIcon, Search } from "lucide-react";
import { useRecoilState, useRecoilValue } from "recoil";
import { useNavigate } from "react-router-dom";
import { CSSTransition } from "react-transition-group";
import type { ReactNode } from "react";
import type { TMessage } from "~/data-provider/data-provider/src";
import {
  useScreenshot,
  useMessageScrolling,
  useLocalize,
  useNewConvo,
} from "~/hooks";
import ScrollToBottom from "~/components/Messages/ScrollToBottom";
import MultiMessage from "./MultiMessage";
import { cn } from "~/utils";
import store from "~/store";
import { Button } from "~/components/ui";

export default function MessagesView({
  messagesTree: _messagesTree,
  readOnly,
  Header,
}: {
  messagesTree?: TMessage[] | null;
  readOnly?: boolean;
  Header?: ReactNode;
}) {
  const { newConversation: newConvo } = useNewConvo(0);
  const navigate = useNavigate();
  const localize = useLocalize();
  const scrollButtonPreference = useRecoilValue(store.showScrollButton);
  const fontSize = useRecoilValue(store.fontSize);
  const { screenshotTargetRef } = useScreenshot();
  const [currentEditId, setCurrentEditId] = useState<number | string | null>(
    -1
  );
  const [selectedOrgKbs, setSelectedOrgKbs] = useRecoilState(
    store.selectedOrgKbs
  );
  const [enableOrgKb, setEnableOrgKb] = useRecoilState(store.enableOrgKb);
  const {
    conversation,
    scrollableRef,
    messagesEndRef,
    showScrollButton,
    handleSmoothToRef,
    debouncedHandleScroll,
  } = useMessageScrolling(_messagesTree);

  const { conversationId } = conversation ?? {};

  return (
    // 消息面板
    <div className="flex-1 overflow-hidden overflow-y-auto">
      <div className="relative h-full">
        <div
          className="scrollbar-gutter-stable flex flex-grow flex-col pb-20"
          onScroll={debouncedHandleScroll}
          ref={scrollableRef}
          style={{
            height: "100%",
            overflowY: "auto",
            width: "100%",
          }}
        >
          <div className="flex flex-1 flex-col pb-3 dark:bg-transparent">
            {(_messagesTree && _messagesTree.length == 0) ||
            _messagesTree === null ? (
              <div
                className={cn(
                  "flex w-full items-center justify-center p-3 text-text-secondary",
                  fontSize
                )}
              >
                {localize("com_ui_nothing_found")}
              </div>
            ) : (
              <>
                {Header != null && Header}
                <div ref={screenshotTargetRef}>
                  <MultiMessage
                    key={conversationId} // avoid internal state mixture
                    messagesTree={_messagesTree}
                    messageId={conversationId ?? null}
                    setCurrentEditId={setCurrentEditId}
                    currentEditId={currentEditId ?? null}
                  />
                </div>
              </>
            )}
            <div
              id="messages-end"
              className="group h-0 w-full flex-shrink-0"
              ref={messagesEndRef}
            />
          </div>
        </div>
        {/* 新对话按钮已移至右上角 */}
        {/* 返回底部 */}
        <CSSTransition
          in={showScrollButton}
          timeout={400}
          classNames="scroll-down"
          unmountOnExit={false}
          // appear
        >
          {() =>
            showScrollButton &&
            scrollButtonPreference && (
              <ScrollToBottom scrollHandler={handleSmoothToRef} />
            )
          }
        </CSSTransition>
      </div>
    </div>
  );
}
