import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Search,
  RotateCw,
  Star,
  Trash2,
  Mail,
  MailOpen,
  Paperclip,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  activeFolderAtom,
  selectedMessageIdAtom,
  searchQueryAtom,
  selectedMessageIdsAtom,
  isComposeOpenAtom,
} from '../../store/mail-store';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { MailListSkeleton } from './mail-skeleton';
import { toast } from 'sonner';

export function MailList() {
  const [activeFolder] = useAtom(activeFolderAtom);
  const [selectedMessageId, setSelectedMessageId] = useAtom(selectedMessageIdAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedMessageIdsAtom);
  const [, setIsComposeOpen] = useAtom(isComposeOpenAtom);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['messages', activeFolder, page, searchQuery],
    queryFn: () => api.messages.list(activeFolder, page, 50, searchQuery),
  });

  const messages = data?.messages || [];

  // Keyboard navigation shortcuts
  const selectNextMessage = useCallback(() => {
    if (messages.length === 0) return;
    const currentIndex = messages.findIndex((m) => m.id === selectedMessageId);
    if (currentIndex === -1 || currentIndex === messages.length - 1) {
      setSelectedMessageId(messages[0].id);
    } else {
      setSelectedMessageId(messages[currentIndex + 1].id);
    }
  }, [messages, selectedMessageId, setSelectedMessageId]);

  const selectPrevMessage = useCallback(() => {
    if (messages.length === 0) return;
    const currentIndex = messages.findIndex((m) => m.id === selectedMessageId);
    if (currentIndex <= 0) {
      setSelectedMessageId(messages[messages.length - 1].id);
    } else {
      setSelectedMessageId(messages[currentIndex - 1].id);
    }
  }, [messages, selectedMessageId, setSelectedMessageId]);

  useHotkeys('j, down', (e) => { e.preventDefault(); selectNextMessage(); }, [selectNextMessage]);
  useHotkeys('k, up', (e) => { e.preventDefault(); selectPrevMessage(); }, [selectPrevMessage]);
  useHotkeys('c', (e) => { e.preventDefault(); setIsComposeOpen(true); }, [setIsComposeOpen]);

  const toggleSelectAll = () => {
    if (selectedIds.length === messages.length && messages.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(messages.map((m) => m.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const batchDeleteMutation = useMutation({
    mutationFn: async () => {
      await api.messages.deleteMessage(selectedIds, activeFolder);
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} message(s) deleted`);
      setSelectedIds([]);
      if (selectedIds.includes(selectedMessageId || '')) {
        setSelectedMessageId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete messages');
    },
  });

  const batchMarkReadMutation = useMutation({
    mutationFn: async (unread: boolean) => {
      await api.messages.markRead(selectedIds, activeFolder, unread);
    },
    onSuccess: () => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  const handleToggleStar = async (id: string, currentStarred: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.messages.toggleStar(id, activeFolder, !currentStarred);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch {
      toast.error('Failed to update star');
    }
  };

  const handleSelectMessage = (id: string, isUnread: boolean) => {
    setSelectedMessageId(id);
    if (isUnread) {
      api.messages.markRead([id], activeFolder, false).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folders'] });
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-r border-border select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-border/80 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder={`Search ${activeFolder}...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs bg-muted/40"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          title="Refresh inbox"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Batch Actions Bar (when items selected) */}
      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between px-3 py-1.5 bg-accent/40 border-b border-border text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-foreground hover:text-primary cursor-pointer flex items-center gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold">{selectedIds.length} Selected</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => batchMarkReadMutation.mutate(false)}
              title="Mark as Read"
            >
              <MailOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => batchMarkReadMutation.mutate(true)}
              title="Mark as Unread"
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => batchDeleteMutation.mutate()}
              title="Delete Selected"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 text-[11px] text-muted-foreground font-medium">
          <span>{data?.total || messages.length} message(s)</span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="hover:text-foreground cursor-pointer flex items-center gap-1"
          >
            <Square className="h-3 w-3" />
            <span>Select All</span>
          </button>
        </div>
      )}

      {/* Messages Scroll List */}
      <div className="flex-1 overflow-y-auto style-scrollbar divide-y divide-border/40">
        {isLoading ? (
          <MailListSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <p className="text-xs font-medium text-muted-foreground">No messages in {activeFolder}</p>
          </div>
        ) : (
          messages.map((message) => {
            const isSelected = selectedMessageId === message.id;
            const isChecked = selectedIds.includes(message.id);

            return (
              <div
                key={message.id}
                onClick={() => handleSelectMessage(message.id, message.unread)}
                className={`flex items-start gap-2.5 p-3 cursor-pointer transition-colors relative ${
                  isSelected
                    ? 'bg-accent/80'
                    : message.unread
                      ? 'bg-card font-semibold hover:bg-accent/40'
                      : 'bg-background hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                {/* Unread dot */}
                {message.unread && (
                  <div className="absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                )}

                {/* Selection Checkbox */}
                <button
                  type="button"
                  onClick={(e) => toggleSelectOne(message.id, e)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                >
                  {isChecked ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Star Button */}
                <button
                  type="button"
                  onClick={(e) => handleToggleStar(message.id, message.starred, e)}
                  className="mt-0.5 text-muted-foreground hover:text-amber-500 cursor-pointer shrink-0"
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      message.starred ? 'fill-amber-400 text-amber-400' : ''
                    }`}
                  />
                </button>

                {/* Email Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1 mb-0.5">
                    <span
                      className={`text-xs truncate ${
                        message.unread ? 'font-bold text-foreground' : 'font-medium text-foreground/80'
                      }`}
                    >
                      {message.from.name || message.from.address}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(message.date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`text-xs truncate ${
                        message.unread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {message.subject || '(No Subject)'}
                    </span>
                    {message.attachments && message.attachments.length > 0 && (
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                    {message.snippet}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
