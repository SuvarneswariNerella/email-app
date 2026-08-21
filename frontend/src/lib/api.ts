import type { EmailMessage, MailFolder, UserSession, SendEmailPayload } from '../types/mail';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<UserSession> => {
      return fetchJson<UserSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    logout: async (): Promise<{ success: boolean }> => {
      return fetchJson<{ success: boolean }>('/auth/logout', {
        method: 'POST',
      });
    },
    session: async (): Promise<UserSession> => {
      return fetchJson<UserSession>('/auth/session');
    },
  },

  folders: {
    list: async (): Promise<MailFolder[]> => {
      return fetchJson<MailFolder[]>('/folders');
    },
  },

  messages: {
    list: async (folder = 'INBOX', page = 1, limit = 50, search = ''): Promise<{ messages: EmailMessage[]; total: number; hasMore: boolean }> => {
      const query = new URLSearchParams({
        folder,
        page: page.toString(),
        limit: limit.toString(),
        ...(search ? { search } : {}),
      });
      return fetchJson<{ messages: EmailMessage[]; total: number; hasMore: boolean }>(`/messages?${query.toString()}`);
    },

    get: async (id: string, folder = 'INBOX'): Promise<EmailMessage> => {
      return fetchJson<EmailMessage>(`/messages/${encodeURIComponent(id)}?folder=${encodeURIComponent(folder)}`);
    },

    send: async (payload: SendEmailPayload): Promise<{ success: boolean; messageId?: string }> => {
      if (payload.attachments && payload.attachments.length > 0) {
        const formData = new FormData();
        formData.append('to', JSON.stringify(payload.to));
        if (payload.cc) formData.append('cc', JSON.stringify(payload.cc));
        if (payload.bcc) formData.append('bcc', JSON.stringify(payload.bcc));
        formData.append('subject', payload.subject);
        formData.append('html', payload.html);
        if (payload.text) formData.append('text', payload.text);
        if (payload.inReplyTo) formData.append('inReplyTo', payload.inReplyTo);
        if (payload.references) formData.append('references', payload.references);

        payload.attachments.forEach((file) => {
          formData.append('attachments', file);
        });

        const response = await fetch(`${API_BASE}/messages/send`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || 'Failed to send message');
        }

        return response.json();
      }

      return fetchJson<{ success: boolean; messageId?: string }>('/messages/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    saveDraft: async (payload: SendEmailPayload): Promise<{ success: boolean; id?: string }> => {
      return fetchJson<{ success: boolean; id?: string }>('/messages/draft', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    markRead: async (ids: string[], folder = 'INBOX', unread = false): Promise<void> => {
      await fetchJson('/messages/actions', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'setRead', ids, folder, value: !unread }),
      });
    },

    toggleStar: async (id: string, folder = 'INBOX', starred = true): Promise<void> => {
      await fetchJson('/messages/actions', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'setStarred', ids: [id], folder, value: starred }),
      });
    },

    deleteMessage: async (ids: string[], folder = 'INBOX'): Promise<void> => {
      await fetchJson('/messages/actions', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'delete', ids, folder }),
      });
    },

    moveToFolder: async (ids: string[], sourceFolder: string, targetFolder: string): Promise<void> => {
      await fetchJson('/messages/actions', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'move', ids, sourceFolder, targetFolder }),
      });
    },
  },
};
