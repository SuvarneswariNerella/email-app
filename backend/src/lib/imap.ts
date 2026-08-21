import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.js';

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

export async function verifyImapCredentials(email: string, pass: string): Promise<boolean> {
  const client = getImapClient(email, pass);
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}
    throw new Error(err?.message || 'Invalid IMAP credentials');
  }
}

export async function listMailboxes(email: string, pass: string) {
  const client = getImapClient(email, pass);
  await client.connect();

  try {
    const list = await client.list();
    const mailboxes = [];

    for (const box of list) {
      if (box.flags.has('\\Noselect')) continue;

      let totalMessages = 0;
      let unreadMessages = 0;
      try {
        const res = await client.status(box.path, { messages: true, unseen: true });
        totalMessages = res.messages ?? 0;
        unreadMessages = res.unseen ?? 0;
      } catch {}

      mailboxes.push({
        id: box.path,
        name: box.name,
        path: box.path,
        totalMessages,
        unreadMessages,
        specialUse: box.specialUse ? box.specialUse.replace('\\', '').toLowerCase() : undefined,
      });
    }

    await client.logout();
    return mailboxes;
  } catch (err) {
    await client.logout().catch(() => {});
    throw err;
  }
}

export async function fetchMessages(
  email: string,
  pass: string,
  folder = 'INBOX',
  page = 1,
  limit = 50,
  searchQuery = '',
) {
  const client = getImapClient(email, pass);
  await client.connect();

  try {
    const lock = await client.getMailboxLock(folder);
    try {
      let uids: number[] = [];

      if (searchQuery) {
        const searchRes = await client.search(
          { or: [{ subject: searchQuery }, { from: searchQuery }, { body: searchQuery }] },
          { uid: true },
        );
        uids = Array.isArray(searchRes) ? searchRes : [];
      } else {
        const searchRes = await client.search({ all: true }, { uid: true });
        uids = Array.isArray(searchRes) ? searchRes : [];
      }

      // Sort descending (newest first)
      uids.reverse();

      const total = uids.length;
      const startIndex = (page - 1) * limit;
      const paginatedUids = uids.slice(startIndex, startIndex + limit);

      if (paginatedUids.length === 0) {
        return { messages: [], total, hasMore: false };
      }

      const messages = [];
      const range = paginatedUids.join(',');

      for await (const message of client.fetch(range, {
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

        // Check if attachments exist in body structure
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
          date: env?.date ? new Date(env.date).toISOString() : new Date().toISOString(),
          snippet: '',
          unread: isUnread,
          starred: isStarred,
          size: message.size,
          attachments: hasAttachments ? [{ id: 'att', filename: '', contentType: '', size: 0 }] : [],
        });
      }

      // Maintain reverse chronological order
      messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        messages,
        total,
        hasMore: startIndex + limit < total,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function fetchFullMessage(email: string, pass: string, folder: string, uid: number) {
  const client = getImapClient(email, pass);
  await client.connect();

  try {
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
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function fetchAttachmentContent(
  email: string,
  pass: string,
  folder: string,
  uid: number,
  attachmentIndex: number,
) {
  const client = getImapClient(email, pass);
  await client.connect();

  try {
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
  } finally {
    await client.logout().catch(() => {});
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
  const client = getImapClient(email, pass);
  await client.connect();

  try {
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
  } finally {
    await client.logout().catch(() => {});
  }
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
  const client = getImapClient(email, pass);
  await client.connect();

  try {
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
        // Move to Trash folder or set Deleted flag
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
  } finally {
    await client.logout().catch(() => {});
  }
}
