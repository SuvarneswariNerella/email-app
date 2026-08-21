import { Download, File, FileText, Image, Paperclip } from 'lucide-react';
import type { Attachment } from '../../types/mail';
import { formatBytes } from '../../lib/utils';
import { Button } from '../ui/button';

interface AttachmentsListProps {
  attachments?: Attachment[];
  messageId: string;
  folder: string;
}

export function AttachmentsList({ attachments, messageId, folder }: AttachmentsListProps) {
  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (contentType.includes('pdf') || contentType.includes('text')) return <FileText className="h-4 w-4 text-amber-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const handleDownload = (att: Attachment) => {
    const downloadUrl = `/api/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(att.id)}?folder=${encodeURIComponent(folder)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = att.filename || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border-t border-border/60 p-4 bg-muted/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" />
        <span>{attachments.length} Attachment{attachments.length > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center justify-between p-2 rounded-md border border-border bg-card hover:bg-accent/40 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              {getFileIcon(att.contentType)}
              <div className="min-w-0 text-left">
                <p className="text-xs font-medium text-foreground truncate">{att.filename}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(att.size)}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground group-hover:text-primary shrink-0 cursor-pointer"
              onClick={() => handleDownload(att)}
              title="Download file"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
