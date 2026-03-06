import { ArrowRight, History, MousePointerClick, Search, SquarePen, X } from 'lucide-react';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { getFeaturedCases } from '~/api/linsight';
import type { ChatFormValues, ContextType } from '~/common';
import { Conversations } from '~/components/Conversations';
import { Spinner } from '~/components/svg';
import { useConversationsInfiniteQuery } from '~/data-provider';
import type { ConversationListResponse, TMessage } from '~/data-provider/data-provider/src';
import { useGetMessagesByConvoId } from '~/data-provider/data-provider/src/react-query';
import { useAddedResponse, useAuthContext, useChatHelpers, useMediaQuery, useNavScrolling, useSSE } from '~/hooks';
import useLocalize from '~/hooks/useLocalize';
import { AddedChatContext, ChatContext, ChatFormProvider, useFileMapContext, useSearchContext } from '~/Providers';
import store from '~/store';
import { buildTree, cn } from '~/utils';
import { Button } from '../ui';
import { Card, CardContent } from '../ui/Card';
import HeaderTitle from './HeaderTitle';
import ChatForm from './Input/ChatForm';
import { sameSopLabelState } from './Input/SameSopSpan';
import InvitationCodeForm from './InviteCode';
import Landing from './Landing';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import { useGetBsConfig } from '~/data-provider';


const ChatView = ({ id = '', index = 0, shareToken = '' }: { id?: string, index?: number, shareToken?: string }) => {
  const t = useLocalize();
  const outletCtx = useOutletContext<ContextType>();
  const { conversationId: cid } = useParams();
  const conversationId = cid ?? id;
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const addedSubmission = useRecoilValue(store.submissionByIndex(index + 1));
  const [showCode, setShowCode] = useState(false);
  const [inputFloat, setInputFloat] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mobileShowHistory, setMobileShowHistory] = useState(true);

  const { data: bsConfig } = useGetBsConfig();
  const navigate = useNavigate();
  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', shareToken, {
    select: useCallback(
      (data: TMessage[]) => {
        // console.log('messagesTree :>> ', data);
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const lingsiEntry = bsConfig?.linsightConfig?.linsight_entry;
  const [isLingsi, setIsLingsi] = useState(false);
  useEffect(() => {
    if (lingsiEntry === false) setIsLingsi(false);
  }, [lingsiEntry]);
  useEffect(() => {
    window.isLinsight = isLingsi
  }, [isLingsi])
  const chatHelpers = useChatHelpers(index, conversationId, isLingsi);
  const addedChatHelpers = useAddedResponse({ rootIndex: index });

  useSSE(rootSubmission, chatHelpers, false);
  useSSE(addedSubmission, addedChatHelpers, true);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  // 提取title in messagesTree
  const conversation = useMemo(() => ({
    ...chatHelpers?.conversation,
    title: messagesTree?.[0]?.flow_name || '',
  }), [chatHelpers]);

  useEffect(() => {
    if (messagesTree && messagesTree.length !== 0) {
      // keep lingsi mode
    }
  }, [messagesTree]);

  // Handle scroll event to trigger float input
  const chatContainerRef = useRef<HTMLDivElement>(null); // 创建 ref
  const casesRef = useRef(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  useEffect(() => {
    let hideLocal = 0
    const handleScroll = async (e: Event) => {
      const target = e.target as HTMLDivElement
      const scrollTop = target.scrollTop
      const floatPanne = document.getElementById("floatPanne")

      if (floatPanne) {
        const rect = floatPanne.getBoundingClientRect()
        if (rect.top <= 20) {
          setInputFloat(true)
          setInputWidth(rect.width)
          if (hideLocal === 0) {
            hideLocal = scrollTop
          }
        }
        if (hideLocal > 0 && scrollTop < hideLocal) {
          setInputFloat(false)
          hideLocal = 0
        }
      }

      const { scrollHeight, clientHeight } = target
      if (scrollTop + clientHeight >= scrollHeight - 10 && !isLoadingMore && casesRef.current) {
        setIsLoadingMore(true)
        try {
          const hasMore = await casesRef.current.loadMore()
          if (!hasMore) {
          }
        } catch (error) {
          console.error("Error loading more data:", error)
        } finally {
          setIsLoadingMore(false)
        }
      }
    }

    const chatContainer = chatContainerRef.current
    if (chatContainer) {
      chatContainer.addEventListener("scroll", handleScroll)
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener("scroll", handleScroll)
      }
    }
  }, [isLoadingMore])

  const isNew = conversationId === 'new';

  useEffect(() => {
    if (!isNew) setMobileShowHistory(true);
  }, [isNew]);

  if (isMobile && isNew && mobileShowHistory && !shareToken) {
    return (
      <MobileChatHistoryView
        onNewChat={() => setMobileShowHistory(false)}
      />
    );
  }

  let content: JSX.Element | null | undefined;

  if (isLoading && conversationId !== 'new') {
    content = (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="opacity-0" />
      </div>
    );
  } else if (messagesTree && messagesTree.length !== 0) {
    content = <MessagesView readOnly={shareToken} messagesTree={messagesTree} Header={<HeaderTitle readOnly={shareToken} conversation={conversation} logo={null} />} />;
  } else {
    content = <Landing lingsi={isLingsi} lingsiEntry={bsConfig?.linsightConfig?.linsight_entry} setLingsi={setIsLingsi} isNew={isNew} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation isLingsi={isLingsi}>
            <div className={cn(`h-full`)}>
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className={cn(
                  "absolute size-full object-cover object-center",
                  "transition-opacity duration-500 ease-out",
                  isLingsi ? "opacity-100 dark:opacity-[0.15]" : "opacity-0"
                )}
              >
                <source src={`${__APP_ENV__.BASE_URL}/assets/linsi-bg.mp4`} type="video/mp4" />
                <img src={`${__APP_ENV__.BASE_URL}/assets/lingsi-bg.png`} alt="" />
              </video>
              {/* Dark mode overlay for video background */}
              <div className={cn(
                "absolute inset-0 z-[5] transition-opacity duration-500 pointer-events-none",
                isLingsi ? "dark:bg-gradient-to-b dark:from-black/40 dark:to-black/60" : "",
                "opacity-0 dark:opacity-100"
              )} />
              <div ref={chatContainerRef} className='relative z-10 h-full overflow-y-auto'>
                {/* Floating buttons - only on Landing page (no messages) */}
                {!shareToken && !(messagesTree && messagesTree.length !== 0) && outletCtx?.setShowChatHistory && (
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                    <button
                      onClick={() => navigate('/c/new')}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-white/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
                      title={t('com_ui_new_chat')}
                    >
                      <SquarePen className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => outletCtx.setShowChatHistory(!outletCtx.showChatHistory)}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-white/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
                      title={t('com_ui_chat_history')}
                    >
                      <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                <div className={cn(showCode ? "hidden" : "flex flex-col justify-center relative",
                  messagesTree ? ' h-full' : 'h-[calc(100vh-200px)]'
                )}>
                  {content}
                  <div
                    id="floatPanne"
                    className={cn(
                      'w-full border-t-0 pl-0 pt-2 dark:border-white/20 md:w-[calc(100%-.5rem)] md:border-t-0 md:border-transparent md:pl-0 md:pt-0 md:dark:border-transparent',
                      inputFloat ? 'fixed top-0 z-10 bg-white dark:bg-gray-900 pb-20 md:pt-5' : ''
                    )}
                    style={{ width: inputFloat ? `${inputWidth}px` : '100%' }} // Dynamically set width
                  >
                    <ChatForm isLingsi={isLingsi} setShowCode={setShowCode} index={index} readOnly={shareToken} />
                    {!inputFloat && <div className="h-[2vh]"></div>}
                  </div>
                </div>
                <Cases ref={casesRef} t={t} isLingsi={isLingsi} setIsLingsi={setIsLingsi} />
              </div>
              {/*   邀请码 */}
              <InvitationCodeForm showCode={showCode} setShowCode={setShowCode} />
            </div >
          </Presentation >
        </AddedChatContext.Provider >
      </ChatContext.Provider >
    </ChatFormProvider >
  );
};

export default memo(ChatView);


function MobileChatHistoryView({ onNewChat }: { onNewChat: () => void }) {
  const { isAuthenticated } = useAuthContext();
  const { pageNumber, searchQuery, searchQueryRes } = useSearchContext();
  const setSearchQuery = useSetRecoilState(store.searchQuery);
  const [localSearch, setLocalSearch] = useState('');
  const [showLoading, setShowLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 350);
  }, [setSearchQuery]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useConversationsInfiniteQuery(
      { pageNumber: pageNumber.toString(), isArchived: false },
      { enabled: isAuthenticated },
    );

  const { containerRef, moveToTop } = useNavScrolling<ConversationListResponse>({
    setShowLoading,
    hasNextPage: searchQuery ? searchQueryRes?.hasNextPage : hasNextPage,
    fetchNextPage: searchQuery ? searchQueryRes?.fetchNextPage : fetchNextPage,
    isFetchingNextPage: searchQuery
      ? searchQueryRes?.isFetchingNextPage ?? false
      : isFetchingNextPage,
  });

  const conversations = useMemo(
    () =>
      (searchQuery ? searchQueryRes?.data : data)?.pages.flatMap((p) => p.conversations) || [],
    [data, searchQuery, searchQueryRes?.data],
  );

  const noop = useCallback(() => {}, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">对话</h2>
        <button
          onClick={onNewChat}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          title="新建对话"
        >
          <SquarePen className="w-4 h-4 text-primary" />
        </button>
      </div>
      {/* Search */}
      <div className="shrink-0 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜索对话..."
            className="w-full h-9 pl-9 pr-9 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2" ref={containerRef}>
        {conversations.length > 0 ? (
          <Conversations
            conversations={conversations}
            moveToTop={moveToTop}
            toggleNav={noop}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500">
            <p className="text-sm">{localSearch ? '未找到匹配的对话' : '暂无对话历史'}</p>
          </div>
        )}
        {(isFetchingNextPage || showLoading) && (
          <Spinner className="m-1 mx-auto mb-4 h-4 w-4 text-text-primary" />
        )}
      </div>
    </div>
  );
}


const Cases = forwardRef(({ t, isLingsi, setIsLingsi }, ref) => {
  const [_, setSameSopLabel] = useRecoilState(sameSopLabelState)
  const [casesData, setCasesData] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const queryParams = typeof window !== "undefined" ? new URLSearchParams(location.search) : null
  const sopid = queryParams?.get("sopid")
  const sopName = queryParams?.get("name")
  const sopSharePath = queryParams?.get("path")

  const handleCardClick = (sopId: string) => {
    window.open(`${__APP_ENV__.BASE_URL}/linsight/case/${sopId}`)
  }

  const loadMore = async (): Promise<boolean> => {
    if (!hasMore || isLoading) return false

    setIsLoading(true)
    try {
      const nextPage = currentPage + 1
      const res = await getFeaturedCases(nextPage)

      if (res.data.items.length > 0) {
        setCasesData((prev) => [...prev, ...res.data.items]) // Prepend new items for upward scroll
        setCurrentPage(nextPage)
        setHasMore(res.data.items.length === 12)
        return true
      } else {
        setHasMore(false)
        return false
      }
    } catch (error) {
      console.error("Error loading more cases:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  useImperativeHandle(ref, () => ({
    loadMore,
  }))

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const res = await getFeaturedCases(1)
        setCasesData(res.data.items)
        setHasMore(res.data.items.length === 12)

        // If sopid exists, find and set the sameSopLabel
        if (sopid) {
          const caseItem = res.data.items.find((item: any) => item.id === Number(sopid))
          if (caseItem) {
            setSameSopLabel({ ...caseItem }) // Uncomment if you have this state
            setIsLingsi(true)
          }
        } else if (sopName && sopSharePath) {
          setSameSopLabel({ id: '', name: decodeURIComponent(sopName), url: decodeURIComponent(sopSharePath) })
          setIsLingsi(true)
        }
      } catch (error) {
        console.error("Error loading initial cases:", error)
      }
    }

    loadInitialData()
  }, [sopid, setIsLingsi])

  if (!isLingsi) return null
  if (casesData.length === 0) return null

  return (
    <div className="relative w-full mt-8 pb-20">
      <p className="text-sm text-center text-gray-400">{t("com_case_featured")}</p>
      <div className="flex flex-wrap pt-4 mx-auto gap-2 w-[782px]">
        {casesData.map((caseItem) => (
          <Card
            key={caseItem.id}
            className="w-[254px] py-0 rounded-2xl shadow-none hover:shadow-xl dark:hover:shadow-gray-900/50 group relative overflow-hidden dark:border-gray-700 dark:bg-gray-800/80"
          >
            <CardContent className="flex flex-col justify-between h-[98px] p-4">
              {/* 信息位：标题 */}
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{caseItem.name}</div>

              {/* 动作位：按钮组（右下角，hover 时显示） */}
              <div className="absolute bottom-2 right-4 flex justify-end space-x-2 mt-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <Button
                  variant="default"
                  className="bg-primary text-white rounded-full h-8 px-3 text-xs flex items-center space-x-0"
                  onClick={() => setSameSopLabel({ ...caseItem })}
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>{t("com_make_samestyle")}</span>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full w-8 h-8 p-0 text-xs flex items-center space-x-1 bg-transparent"
                  onClick={() => handleCardClick(caseItem.id.toString())}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
})