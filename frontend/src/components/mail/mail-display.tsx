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
} from 'lucide-react';
import { selectedMessageIdAtom, activeFolderAtom, isComposeOpenAtom, composeInitialDataAtom } from '../../store/mail-store';
import { api } from '../../lib/api';
import { formatFullDate, getInitials } from '../../lib/utils';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { MailDisplaySkeleton } from './mail-skeleton';
import { AttachmentsList } from './attachments-accordion';
import { toast } from 'sonner';

export function MailDisplay() {
  const [selectedMessageId, setSelectedMessageId] = useAtom(selectedMessageIdAtom);
  const [activeFolder] = useAtom(activeFolderAtom);
  const [, setIsComposeOpen] = useAtom(isComposeOpenAtom);
  const [, setComposeData] = useAtom(composeInitialDataAtom);
  const queryClient = useQueryClient();

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

  const handleReply = (replyAll = false) => {
    if (!message) return;
    const recipients = replyAll
      ? [message.from.address, ...(message.to || []).map((t) => t.address), ...(message.cc || []).map((c) => c.address)]
      : [message.from.address];

    const cleanSubject = message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`;
    const quotedBody = `<br><br><hr><blockquote>On ${formatFullDate(message.date)}, ${message.from.name || message.from.address} wrote:<br>${message.bodyHtml || message.bodyText || ''}</blockquote>`;

    setComposeData({
      to: Array.from(new Set(recipients)).filter(Boolean),
      subject: cleanSubject,
      html: quotedBody,
      inReplyTo: message.id,
    });
    setIsComposeOpen(true);
  };

  const handleForward = () => {
    if (!message) return;
    const cleanSubject = message.subject.startsWith('Fwd:') ? message.subject : `Fwd: ${message.subject}`;
    const quotedBody = `<br><br><hr><blockquote>---------- Forwarded message ---------<br>From: ${message.from.name || message.from.address} &lt;${message.from.address}&gt;<br>Date: ${formatFullDate(message.date)}<br>Subject: ${message.subject}<br>To: ${(message.to || []).map((t) => t.address).join(', ')}<br><br>${message.bodyHtml || message.bodyText || ''}</blockquote>`;

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

  const sanitizedHtml = message.bodyHtml
    ? DOMPurify.sanitize(message.bodyHtml, {
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'style'],
      })
    : '';

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/80 bg-card select-none">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleReply(false)}
            className="h-8 text-xs gap-1.5"
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleReply(true)}
            className="h-8 text-xs gap-1.5 hidden sm:inline-flex"
          >
            <ReplyAll className="h-3.5 w-3.5" />
            Reply All
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleForward}
            className="h-8 text-xs gap-1.5"
          >
            <Forward className="h-3.5 w-3.5" />
            Forward
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => starMutation.mutate()}
            title={message.starred ? 'Starred' : 'Not starred'}
            className="h-8 w-8 text-muted-foreground hover:text-amber-500"
          >
            <Star className={`h-4 w-4 ${message.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => toggleReadMutation.mutate()}
            title={message.unread ? 'Mark as read' : 'Mark as unread'}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {message.unread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate()}
            title="Delete email"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Email View Area */}
      <div className="flex-1 overflow-y-auto style-scrollbar flex flex-col">
        {/* Email Header */}
        <div className="p-5 pb-3 border-b border-border/40">
          <h2 className="text-lg font-bold text-foreground tracking-tight leading-snug mb-3">
            {message.subject || '(No Subject)'}
          </h2>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback>{getInitials(message.from.name, message.from.address)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 text-left">
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-semibold text-xs text-foreground truncate">
                    {message.from.name || message.from.address}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    &lt;{message.from.address}&gt;
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  <span>To: </span>
                  {(message.to || []).map((t) => t.name || t.address).join(', ')}
                  {message.cc && message.cc.length > 0 && (
                    <span className="ml-2">
                      | Cc: {message.cc.map((c) => c.name || c.address).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              {formatFullDate(message.date)}
            </span>
          </div>
        </div>

        {/* Email Body */}
        <div className="p-6 flex-1 text-sm leading-relaxed text-foreground select-text email-content-container">
          {message.bodyHtml ? (
            <div
              className="email-body prose prose-sm dark:prose-invert max-w-none break-words dark:text-zinc-100"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <pre className="font-sans whitespace-pre-wrap text-sm text-foreground dark:text-zinc-100 email-body">
              {message.bodyText || ''}
            </pre>
          )}
        </div>

        {/* Attachments Section */}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentsList
            attachments={message.attachments}
            messageId={message.id}
            folder={activeFolder}
          />
        )}
      </div>
    </div>
  );
}
