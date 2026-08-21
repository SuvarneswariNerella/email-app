import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.js';

interface CachedClient {
  client: ImapFlow;
  lastUsed: number;
  timer: NodeJS.Timeout;
}

// Connection pool to reuse TLS/IMAP authenticated sessions across requests
const clientPool = new Map<string, CachedClient>();

export function getImapClient(email: string, pass: string) {
  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: email,
      pass: pass,
    },
    logger: false,
  });

  // Attach error listener to prevent uncaught error events from crashing the server
  client.on('error', (err) => {
    console.error(`[IMAP Socket Error for ${email}]:`, err?.message || err);
  });

  return client;
}

export async function getConnectedClient(email: string, pass: string): Promise<ImapFlow> {
  const key = `${email}:${pass}`;
  const existing = clientPool.get(key);

  if (existing && existing.client.usable) {
    clearTimeout(existing.timer);
    existing.lastUsed = Date.now();
    existing.timer = setTimeout(() => closeClient(key), 60000); // 60s idle timeout
    return existing.client;
  }

  // If previous client exists but is dead/unusable, clean it up
  if (existing) {
    clientPool.delete(key);
    try {
      await existing.client.logout();
    } catch {}
  }

  const client = getImapClient(email, pass);
  await client.connect();

  const entry: CachedClient = {
    client,
    lastUsed: Date.now(),
    timer: setTimeout(() => closeClient(key), 60000),
  };

  clientPool.set(key, entry);

  client.on('close', () => {
    clientPool.delete(key);
  });

  return client;
}

async function closeClient(key: string) {
  const existing = clientPool.get(key);
  if (existing) {
    clientPool.delete(key);
    try {
      if (existing.client.usable) {
        await existing.client.logout();
      }
    } catch {}
  }
}

export async function verifyImapCredentials(email: string, pass: string): Promise<boolean> {
  const client = getImapClient(email, pass);
  await client.connect();
  await client.logout().catch(() => {});
  return true;
}

export async function fetchMailboxes(email: string, pass: string) {
  const client = await getConnectedClient(email, pass);

  try {
    const list = await client.list();
    const validBoxes = list.filter((box) => !box.flags.has('\\Noselect'));

    // Fetch folder statuses concurrently in parallel
    const mailboxes = await Promise.all(
      validBoxes.map(async (box) => {
        let totalMessages = 0;
        let unreadMessages = 0;
        try {
          const res = await client.status(box.path, { messages: true, unseen: true });
          totalMessages = res.messages ?? 0;
          unreadMessages = res.unseen ?? 0;
        } catch {}

        return {
          id: box.path,
          name: box.name,
          path: box.path,
          totalMessages,
          unreadMessages,
          specialUse: box.specialUse ? box.specialUse.replace('\\', '').toLowerCase() : undefined,
        };
      }),
    );

    return mailboxes;
  } catch (err) {
    // If pool connection failed, invalidate cache and rethrow
    clientPool.delete(`${email}:${pass}`);
    throw err;
  }
}

export const listMailboxes = fetchMailboxes;

export async function fetchMessages(
  email: string,
  pass: string,
  folder = 'INBOX',
  page = 1,
  limit = 50,
  searchQuery = '',
) {
  const client = await getConnectedClient(email, pass);
  const lock = await client.getMailboxLock(folder);

  try {
    if (searchQuery) {
      const searchRes = await client.search(
        { or: [{ subject: searchQuery }, { from: searchQuery }, { body: searchQuery }] },
        { uid: true },
      );
      const uids: number[] = Array.isArray(searchRes) ? searchRes : [];
      uids.reverse();

      const total = uids.length;
      const startIndex = (page - 1) * limit;
      const paginatedUids = uids.slice(startIndex, startIndex + limit);

      if (paginatedUids.length === 0) {
        return { messages: [], total, hasMore: false };
      }

      const messages = [];
      const range = paginatedUids.join(',');

      for await (const message of client.fetch(
        range,
        {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
          size: true,
        },
        { uid: true },
      )) {
        const env = message.envelope;
        const fromAddr = env?.from?.[0]
          ? { name: env.from[0].name || '', address: env.from[0].address || '' }
          : { name: '', address: '' };

        const toAddrs = (env?.to || []).map((t) => ({
          name: t.name || '',
          address: t.address || '',
        }));

        const isUnread = message.flags ? !message.flags.has('\\Seen') : true;
        const isStarred = message.flags ? message.flags.has('\\Flagged') : false;

        const hasAttachments =
          message.bodyStructure?.childNodes?.some(
            (node) => node.disposition === 'attachment' || !!node.parameters?.name,
          ) || false;

        messages.push({
          id: message.uid.toString(),
          uid: message.uid,
          folder,
          subject: env?.subject || '(No Subject)',
          from: fromAddr,
          to: toAddrs,
          date: env?.date ? env.date.toISOString() : new Date().toISOString(),
          snippet: '',
          unread: isUnread,
          starred: isStarred,
          hasAttachments,
          size: message.size,
        });
      }

      messages.sort((a, b) => b.uid - a.uid);
      return {
        messages,
        total,
        hasMore: startIndex + limit < total,
      };
    }

    // High-speed sequence slicing directly from total exists (Instant O(1) IMAP fetch without full search)
    const mailbox = typeof client.mailbox === 'object' && client.mailbox ? client.mailbox : null;
    const total = mailbox ? mailbox.exists : 0;
    if (total === 0) {
      return { messages: [], total: 0, hasMore: false };
    }

    const endIndex = Math.max(1, total - (page - 1) * limit);
    const startIndex = Math.max(1, endIndex - limit + 1);
    const seqRange = `${startIndex}:${endIndex}`;
    const messages = [];

    for await (const message of client.fetch(seqRange, {
      uid: true,
      envelope: true,
      flags: true,
      bodyStructure: true,
      size: true,
    })) {
      const env = message.envelope;
      const fromAddr = env?.from?.[0]
        ? { name: env.from[0].name || '', address: env.from[0].address || '' }
        : { name: '', address: '' };

      const toAddrs = (env?.to || []).map((t) => ({
        name: t.name || '',
        address: t.address || '',
      }));

      const isUnread = message.flags ? !message.flags.has('\\Seen') : true;
      const isStarred = message.flags ? message.flags.has('\\Flagged') : false;

      const hasAttachments =
        message.bodyStructure?.childNodes?.some(
          (node) => node.disposition === 'attachment' || !!node.parameters?.name,
        ) || false;

      messages.push({
        id: message.uid.toString(),
        uid: message.uid,
        folder,
        subject: env?.subject || '(No Subject)',
        from: fromAddr,
        to: toAddrs,
        date: env?.date ? env.date.toISOString() : new Date().toISOString(),
        snippet: '',
        unread: isUnread,
        starred: isStarred,
        hasAttachments,
        size: message.size,
      });
    }

    // Sort newest first
    messages.reverse();

    return {
      messages,
      total,
      hasMore: startIndex > 1,
    };
  } finally {
    lock.release();
  }
}

export async function fetchFullMessage(email: string, pass: string, folder: string, uid: number) {
  const client = await getConnectedClient(email, pass);
  const lock = await client.getMailboxLock(folder);

  try {
    const download = await client.download(uid.toString(), undefined, { uid: true });
    if (!download || !download.content) {
      throw new Error('Message content not found');
    }

    const parsed = await simpleParser(download.content);

    // Extract attachments metadata and handle inline CID images
    let bodyHtml = parsed.html || undefined;
    const attachments = (parsed.attachments || []).map((att, idx) => {
      if (att.contentId && att.content && bodyHtml) {
        const cleanCid = att.contentId.replace(/^<|>$/g, '');
        const base64 = att.content.toString('base64');
        const dataUri = `data:${att.contentType || 'image/png'};base64,${base64}`;
        bodyHtml = bodyHtml.replaceAll(`cid:${cleanCid}`, dataUri);
        bodyHtml = bodyHtml.replaceAll(`cid:${att.contentId}`, dataUri);
      }

      return {
        id: idx.toString(),
        filename: att.filename || `attachment_${idx + 1}`,
        contentType: att.contentType,
        size: att.size,
        contentId: att.contentId,
      };
    });

    const fromAddr = parsed.from?.value?.[0]
      ? { name: parsed.from.value[0].name, address: parsed.from.value[0].address }
      : { name: '', address: '' };

    const toAddrs = Array.isArray(parsed.to)
      ? parsed.to.flatMap((t) => t.value).map((v) => ({ name: v.name, address: v.address }))
      : parsed.to?.value
        ? parsed.to.value.map((v) => ({ name: v.name, address: v.address }))
        : [];

    const ccAddrs = Array.isArray(parsed.cc)
      ? parsed.cc.flatMap((c) => c.value).map((v) => ({ name: v.name, address: v.address }))
      : parsed.cc?.value
        ? parsed.cc.value.map((v) => ({ name: v.name, address: v.address }))
        : [];

    // Mark message as read
    await client.messageFlagsAdd(uid.toString(), ['\\Seen'], { uid: true }).catch(() => {});

    return {
      id: uid.toString(),
      uid,
      folder,
      subject: parsed.subject || '(No Subject)',
      from: fromAddr,
      to: toAddrs,
      cc: ccAddrs,
      date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
      bodyHtml,
      bodyText: parsed.text || undefined,
      attachments,
      unread: false,
      starred: false,
    };
  } finally {
    lock.release();
  }
}

export async function fetchAttachmentContent(
  email: string,
  pass: string,
  folder: string,
  uid: number,
  attachmentIndex: number,
) {
  const client = await getConnectedClient(email, pass);
  const lock = await client.getMailboxLock(folder);

  try {
    const download = await client.download(uid.toString(), undefined, { uid: true });
    if (!download || !download.content) throw new Error('Message not found');

    const parsed = await simpleParser(download.content);
    const att = parsed.attachments[attachmentIndex];
    if (!att) throw new Error('Attachment not found');

    return {
      filename: att.filename || 'attachment',
      contentType: att.contentType,
      content: att.content,
    };
  } finally {
    lock.release();
  }
}

export async function saveDraftMessage(
  email: string,
  pass: string,
  options: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    html?: string;
    text?: string;
  },
) {
  const client = await getConnectedClient(email, pass);

  const mailComposerModule = await import('nodemailer/lib/mail-composer/index.js');
  const MailComposer = (mailComposerModule as any).default || mailComposerModule;
  const mailComposer = new MailComposer({
    from: email,
    to: options.to || [],
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject || '(No Subject)',
    html: options.html || '',
    text: options.text,
  });

  const rawBuffer = await mailComposer.compile().build();
  await client.append('Drafts', rawBuffer, ['\\Draft', '\\Seen']);
  return { success: true };
}

export async function updateMessageFlags(
  email: string,
  pass: string,
  folder: string,
  uids: number[],
  action: 'setRead' | 'setStarred' | 'delete' | 'move',
  value?: boolean,
  targetFolder?: string,
) {
  const client = await getConnectedClient(email, pass);
  const lock = await client.getMailboxLock(folder);

  try {
    const range = uids.join(',');

    if (action === 'setRead') {
      if (value) {
        await client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
      } else {
        await client.messageFlagsRemove(range, ['\\Seen'], { uid: true });
      }
    } else if (action === 'setStarred') {
      if (value) {
        await client.messageFlagsAdd(range, ['\\Flagged'], { uid: true });
      } else {
        await client.messageFlagsRemove(range, ['\\Flagged'], { uid: true });
      }
    } else if (action === 'delete') {
      try {
        await client.messageMove(range, 'Trash', { uid: true });
      } catch {
        await client.messageFlagsAdd(range, ['\\Deleted'], { uid: true });
      }
    } else if (action === 'move' && targetFolder) {
      await client.messageMove(range, targetFolder, { uid: true });
    }
  } finally {
    lock.release();
  }
}
