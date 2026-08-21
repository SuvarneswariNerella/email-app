import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import DOMPurify from 'dompurify';
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Star,
  Mail,
  MailOpen,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ChevronsUpDown,
} from 'lucide-react';
import {
  selectedMessageIdAtom,
  activeFolderAtom,
  isComposeOpenAtom,
  composeInitialDataAtom,
} from '../../store/mail-store';
import { api } from '../../lib/api';
import { formatFullDate, getInitials } from '../../lib/utils';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { MailDisplaySkeleton } from './mail-skeleton';
import { AttachmentsList } from './attachments-accordion';
import { toast } from 'sonner';
import type { EmailMessage } from '../../types/mail';

export function MailDisplay() {
  const [selectedMessageId, setSelectedMessageId] = useAtom(selectedMessageIdAtom);
  const [activeFolder] = useAtom(activeFolderAtom);
  const [, setIsComposeOpen] = useAtom(isComposeOpenAtom);
  const [, setComposeData] = useAtom(composeInitialDataAtom);
  const queryClient = useQueryClient();

  // State to track expanded status for each message in the conversation thread
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const { data: message, isLoading, error } = useQuery({
    queryKey: ['message', selectedMessageId, activeFolder],
    queryFn: () => (selectedMessageId ? api.messages.get(selectedMessageId, activeFolder) : null),
    enabled: !!selectedMessageId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMessageId) return;
      await api.messages.deleteMessage([selectedMessageId], activeFolder);
    },
    onSuccess: () => {
      toast.success('Message moved to trash');
      setSelectedMessageId(null);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete message');
    },
  });

  const starMutation = useMutation({
    mutationFn: async () => {
      if (!message) return;
      await api.messages.toggleStar(message.id, activeFolder, !message.starred);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message', selectedMessageId] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: async () => {
      if (!message) return;
      await api.messages.markRead([message.id], activeFolder, !message.unread);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message', selectedMessageId] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  const handleReplyMessage = (targetMsg: EmailMessage, replyAll = false) => {
    const recipients = replyAll
      ? [targetMsg.from.address, ...(targetMsg.to || []).map((t) => t.address), ...(targetMsg.cc || []).map((c) => c.address)]
      : [targetMsg.from.address];

    const cleanSubject = targetMsg.subject.startsWith('Re:') ? targetMsg.subject : `Re: ${targetMsg.subject}`;
    const quotedBody = `<br><br><hr><blockquote>On ${formatFullDate(targetMsg.date)}, ${targetMsg.from.name || targetMsg.from.address} wrote:<br>${targetMsg.bodyHtml || targetMsg.bodyText || ''}</blockquote>`;

    setComposeData({
      to: Array.from(new Set(recipients)).filter(Boolean),
      subject: cleanSubject,
      html: quotedBody,
      inReplyTo: targetMsg.id,
    });
    setIsComposeOpen(true);
  };

  const handleForwardMessage = (targetMsg: EmailMessage) => {
    const cleanSubject = targetMsg.subject.startsWith('Fwd:') ? targetMsg.subject : `Fwd: ${targetMsg.subject}`;
    const quotedBody = `<br><br><hr><blockquote>---------- Forwarded message ---------<br>From: ${targetMsg.from.name || targetMsg.from.address} &lt;${targetMsg.from.address}&gt;<br>Date: ${formatFullDate(targetMsg.date)}<br>Subject: ${targetMsg.subject}<br>To: ${(targetMsg.to || []).map((t) => t.address).join(', ')}<br><br>${targetMsg.bodyHtml || targetMsg.bodyText || ''}</blockquote>`;

    setComposeData({
      to: [],
      subject: cleanSubject,
      html: quotedBody,
    });
    setIsComposeOpen(true);
  };

  if (!selectedMessageId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-card/20 select-none">
        <Mail className="h-12 w-12 mb-3 stroke-[1.25] text-muted-foreground/40" />
        <h3 className="text-sm font-semibold text-foreground">No email selected</h3>
        <p className="text-xs text-muted-foreground max-w-xs mt-1">
          Select an email from the list to view its contents, reply, or manage attachments.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <MailDisplaySkeleton />;
  }

  if (error || !message) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-destructive p-8 text-center">
        <p className="text-sm font-semibold">Failed to load email</p>
        <Button variant="outline" size="sm" onClick={() => setSelectedMessageId(null)} className="mt-3 text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to List
        </Button>
      </div>
    );
  }

  const thread: EmailMessage[] = message.thread && message.thread.length > 0 ? message.thread : [message];
  const lastIndex = thread.length - 1;

  // Toggle single message expand/collapse
  const toggleExpand = (msgKey: string, currentExpanded: boolean) => {
    setExpandedMap((prev) => ({
      ...prev,
      [msgKey]: !currentExpanded,
    }));
  };

  // Toggle all messages
  const toggleAllMessages = () => {
    const anyCollapsed = thread.some((m, idx) => {
      const key = `${m.folder || activeFolder}:${m.uid || m.id}`;
      return expandedMap[key] === false || (expandedMap[key] === undefined && idx !== lastIndex);
    });

    const newMap: Record<string, boolean> = {};
    thread.forEach((m) => {
      const key = `${m.folder || activeFolder}:${m.uid || m.id}`;
      newMap[key] = anyCollapsed;
    });
    setExpandedMap(newMap);
  };

  const isMsgExpanded = (msg: EmailMessage, idx: number) => {
    const key = `${msg.folder || activeFolder}:${msg.uid || msg.id}`;
    if (expandedMap[key] !== undefined) {
      return expandedMap[key];
    }
    // By default, expand the latest message (or if it's the only message)
    return idx === lastIndex;
  };

  const latestMsg = thread[lastIndex] || message;

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/80 bg-card select-none">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleReplyMessage(latestMsg, false)}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleReplyMessage(latestMsg, true)}
            className="h-8 text-xs gap-1.5 hidden sm:inline-flex cursor-pointer"
          >
            <ReplyAll className="h-3.5 w-3.5" />
            Reply All
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleForwardMessage(latestMsg)}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <Forward className="h-3.5 w-3.5" />
            Forward
          </Button>

          {thread.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAllMessages}
              className="h-8 text-xs gap-1.5 ml-2 cursor-pointer"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expand/Collapse All
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => starMutation.mutate()}
            title={message.starred ? 'Starred' : 'Not starred'}
            className="h-8 w-8 text-muted-foreground hover:text-amber-500 cursor-pointer"
          >
            <Star className={`h-4 w-4 ${message.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => toggleReadMutation.mutate()}
            title={message.unread ? 'Mark as read' : 'Mark as unread'}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {message.unread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate()}
            title="Delete email"
            className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Email View Area */}
      <div className="flex-1 overflow-y-auto style-scrollbar flex flex-col">
        {/* Email Thread Subject Header */}
        <div className="p-5 pb-3 border-b border-border/40 bg-card">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-lg font-bold text-foreground tracking-tight leading-snug">
              {message.subject || '(No Subject)'}
            </h2>
            {thread.length > 1 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full whitespace-nowrap">
                <MessageSquare className="h-3 w-3" />
                {thread.length} messages
              </span>
            )}
          </div>
        </div>

        {/* Conversation Thread Messages */}
        <div className="flex-1 p-4 space-y-4 pb-8">
          {thread.map((msg, idx) => {
            const key = `${msg.folder || activeFolder}:${msg.uid || msg.id}`;
            const expanded = isMsgExpanded(msg, idx);

            const sanitizedHtml = msg.bodyHtml
              ? DOMPurify.sanitize(msg.bodyHtml, {
                  ADD_ATTR: ['target'],
                  FORBID_TAGS: ['script', 'style'],
                })
              : '';

            return (
              <div
                key={key}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  expanded
                    ? 'border-border bg-card shadow-xs'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer'
                }`}
              >
                {/* Message Header */}
                <div
                  onClick={() => toggleExpand(key, expanded)}
                  className={`flex items-start justify-between gap-4 p-4 select-none ${
                    expanded ? 'border-b border-border/40 bg-card' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarFallback>{getInitials(msg.from.name, msg.from.address)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline gap-2 truncate">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {msg.from.name || msg.from.address}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          &lt;{msg.from.address}&gt;
                        </span>
                        {msg.folder && /sent/i.test(msg.folder) && (
                          <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.2 rounded">
                            Sent
                          </span>
                        )}
                      </div>

                      {expanded ? (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          <span>To: </span>
                          {(msg.to || []).map((t) => t.name || t.address).join(', ')}
                          {msg.cc && msg.cc.length > 0 && (
                            <span className="ml-2">
                              | Cc: {msg.cc.map((c) => c.name || c.address).join(', ')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {msg.snippet || msg.bodyText?.slice(0, 100) || '(No preview)'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatFullDate(msg.date)}
                    </span>
                    {thread.length > 1 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                        aria-label={expanded ? 'Collapse message' : 'Expand message'}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Message Body & Attachments */}
                {expanded && (
                  <div>
                    <div className="p-5 text-sm leading-relaxed text-foreground select-text email-content-container">
                      {msg.bodyHtml ? (
                        <div
                          className="email-body prose prose-sm dark:prose-invert max-w-none break-words dark:text-zinc-100"
                          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                        />
                      ) : (
                        <pre className="font-sans whitespace-pre-wrap text-sm text-foreground dark:text-zinc-100 email-body">
                          {msg.bodyText || ''}
                        </pre>
                      )}
                    </div>

                    {/* Attachments Section */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="p-4 pt-0">
                        <AttachmentsList
                          attachments={msg.attachments}
                          messageId={msg.id}
                          folder={msg.folder || activeFolder}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
