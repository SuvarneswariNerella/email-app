export interface EmailAddress {
  name?: string;
  address: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  url?: string;
}

export interface EmailMessage {
  id: string;
  uid: number;
  folder: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  attachments?: Attachment[];
  unread: boolean;
  starred: boolean;
  flagged?: boolean;
  draft?: boolean;
  size?: number;
  messageId?: string;
  inReplyTo?: string;
  thread?: EmailMessage[];
}

export interface MailFolder {
  id: string;
  name: string;
  path: string;
  totalMessages: number;
  unreadMessages: number;
  specialUse?: 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | 'starred';
}

export interface UserSession {
  email: string;
  name?: string;
  isAuthenticated: boolean;
}

export interface SendEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: File[];
  inReplyTo?: string;
  references?: string;
}
