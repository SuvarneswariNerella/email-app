import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { X, Paperclip, Send, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { isComposeOpenAtom, composeInitialDataAtom, activeFolderAtom } from '../../store/mail-store';
import { api } from '../../lib/api';
import { formatBytes } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { RichEditor } from './editor';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function EmailComposer() {
  const [isOpen, setIsOpen] = useAtom(isComposeOpenAtom);
  const [initialData, setInitialData] = useAtom(composeInitialDataAtom);
  const [activeFolder] = useAtom(activeFolderAtom);
  const queryClient = useQueryClient();

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      if (initialData.to) setTo(initialData.to.join(', '));
      if (initialData.cc) {
        setCc(initialData.cc.join(', '));
        setShowCc(true);
      }
      if (initialData.subject) setSubject(initialData.subject);
      if (initialData.html) setHtmlBody(initialData.html);
    }
  }, [initialData]);

  const resetForm = () => {
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setHtmlBody('');
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setInitialData(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toList = to
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const ccList = cc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bccList = bcc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (toList.length === 0) {
        throw new Error('Please specify at least one recipient in "To"');
      }

      return api.messages.send({
        to: toList,
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        subject: subject.trim() || '(No Subject)',
        html: htmlBody,
        attachments: attachments.length > 0 ? attachments : undefined,
        inReplyTo: initialData?.inReplyTo,
        references: initialData?.references,
      });
    },
    onSuccess: () => {
      toast.success('Email sent successfully');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to send email');
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
      await api.messages.saveDraft({
        to: toList,
        subject: subject.trim() || '(No Subject)',
        html: htmlBody,
      });
    },
    onSuccess: () => {
      toast.success('Draft saved to Drafts folder');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save draft');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-200 bg-card border border-border shadow-2xl rounded-t-xl flex flex-col overflow-hidden ${
        isMaximized
          ? 'inset-4 w-auto h-auto rounded-xl'
          : isMinimized
            ? 'bottom-0 right-8 w-80 h-11'
            : 'bottom-0 right-8 w-[580px] max-w-[calc(100vw-32px)] h-[560px] max-h-[85vh]'
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/60 border-b border-border select-none">
        <span className="text-xs font-semibold tracking-tight text-foreground truncate">
          {subject || 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsMaximized(!isMaximized);
              setIsMinimized(false);
            }}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto style-scrollbar gap-2.5">
          {/* Recipient Rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 border-b border-border/50 pb-1.5">
              <span className="w-10 text-muted-foreground font-medium">To:</span>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipients@company.com"
                className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
              />
              <div className="flex gap-1 text-[11px] text-muted-foreground">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="hover:text-foreground cursor-pointer px-1"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="hover:text-foreground cursor-pointer px-1"
                  >
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {showCc && (
              <div className="flex items-center gap-2 border-b border-border/50 pb-1.5">
                <span className="w-10 text-muted-foreground font-medium">Cc:</span>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@company.com"
                  className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            {showBcc && (
              <div className="flex items-center gap-2 border-b border-border/50 pb-1.5">
                <span className="w-10 text-muted-foreground font-medium">Bcc:</span>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@company.com"
                  className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-border/50 pb-1.5">
              <span className="w-10 text-muted-foreground font-medium">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent outline-none text-xs font-medium text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* TipTap Rich Editor */}
          <div className="flex-1 min-h-[160px] flex flex-col">
            <RichEditor
              content={htmlBody}
              onChange={setHtmlBody}
              placeholder="Type your message here..."
            />
          </div>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md border border-border/40 max-h-24 overflow-y-auto">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded text-xs text-foreground"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">({formatBytes(file.size)})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Action Toolbar */}
          <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => draftMutation.mutate()}
                disabled={draftMutation.isPending}
                className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {draftMutation.isPending ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="h-8 text-xs font-semibold px-3 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {sendMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
