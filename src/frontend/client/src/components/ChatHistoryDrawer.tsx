import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useSetRecoilState } from 'recoil';
import { useSearchContext } from '~/Providers';
import { Conversations } from '~/components/Conversations';
import { Spinner } from '~/components/svg';
import { useConversationsInfiniteQuery } from '~/data-provider';
import type { ConversationListResponse } from '~/data-provider/data-provider/src';
import { useAuthContext, useLocalize, useNavScrolling } from '~/hooks';
import store from '~/store';
import { cn } from '~/utils';

const ChatHistoryDrawer = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const [isHovering, setIsHovering] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const setSearchQuery = useSetRecoilState(store.searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 350);
  }, [setSearchQuery]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const { pageNumber, searchQuery, setPageNumber, searchQueryRes } = useSearchContext();
  const [tags, setTags] = useState<string[]>([]);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useConversationsInfiniteQuery(
      {
        pageNumber: pageNumber.toString(),
        isArchived: false,
        tags: tags.length === 0 ? undefined : tags,
      },
      { enabled: isAuthenticated },
    );

  useEffect(() => {
    refetch();
  }, [tags]);

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
      (searchQuery ? searchQueryRes?.data : data)?.pages.flatMap((page) => page.conversations) ||
      [],
    [data, searchQuery, searchQueryRes?.data],
  );

  const handleMouseEnter = useCallback(() => setIsHovering(true), []);
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[320px] bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {localize('com_ui_chat_history')}
            </h3>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {/* Search bar */}
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="搜索对话..."
                className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
              />
              {localSearch && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div
            className={cn(
              'flex-1 overflow-y-auto px-2 transition-opacity duration-300',
              isHovering ? '' : 'scrollbar-transparent',
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            ref={containerRef}
          >
            <Conversations
              conversations={conversations}
              moveToTop={moveToTop}
              toggleNav={onClose}
            />
            {(isFetchingNextPage || showLoading) && (
              <Spinner className={cn('m-1 mx-auto mb-4 h-4 w-4 text-text-primary')} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(ChatHistoryDrawer);
