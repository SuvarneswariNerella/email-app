import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../lib/auth.js';
import {
  fetchMessages,
  fetchFullMessage,
  fetchAttachmentContent,
  updateMessageFlags,
  saveDraftMessage,
} from '../lib/imap.js';
import { sendMail } from '../lib/smtp.js';

const router = Router();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB attachment limit

router.get('/', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;
  const folder = (req.query.folder as string) || 'INBOX';
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const search = (req.query.search as string) || '';

  try {
    const result = await fetchMessages(email, password, folder, page, limit, search);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to fetch messages' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;
  const uid = parseInt(req.params.id as string, 10);
  const folder = (req.query.folder as string) || 'INBOX';

  try {
    const message = await fetchFullMessage(email, password, folder, uid);
    res.json(message);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to fetch message details' });
  }
});

router.get('/:id/attachments/:attId', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;
  const uid = parseInt(req.params.id as string, 10);
  const attIndex = parseInt(req.params.attId as string, 10);
  const folder = (req.query.folder as string) || 'INBOX';

  try {
    const att = await fetchAttachmentContent(email, password, folder, uid, attIndex);
    res.setHeader('Content-Type', att.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
    res.send(att.content);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to fetch attachment' });
  }
});

router.post('/send', authMiddleware, upload.array('attachments'), async (req, res) => {
  const { email, password } = (req as any).user;

  try {
    let to: string[] = [];
    let cc: string[] | undefined;
    let bcc: string[] | undefined;

    if (typeof req.body.to === 'string') {
      try {
        to = JSON.parse(req.body.to);
      } catch {
        to = req.body.to.split(',').map((s: string) => s.trim());
      }
    } else if (Array.isArray(req.body.to)) {
      to = req.body.to;
    }

    if (req.body.cc) {
      try {
        cc = typeof req.body.cc === 'string' ? JSON.parse(req.body.cc) : req.body.cc;
      } catch {
        cc = req.body.cc.split(',').map((s: string) => s.trim());
      }
    }

    if (req.body.bcc) {
      try {
        bcc = typeof req.body.bcc === 'string' ? JSON.parse(req.body.bcc) : req.body.bcc;
      } catch {
        bcc = req.body.bcc.split(',').map((s: string) => s.trim());
      }
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const attachments = files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    }));

    const result = await sendMail(email, password, {
      to,
      cc,
      bcc,
      subject: req.body.subject || '(No Subject)',
      html: req.body.html || '',
      text: req.body.text,
      attachments: attachments.length > 0 ? attachments : undefined,
      inReplyTo: req.body.inReplyTo,
      references: req.body.references,
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to send email' });
  }
});

router.post('/draft', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;
  try {
    let to: string[] = [];
    if (typeof req.body.to === 'string') {
      try { to = JSON.parse(req.body.to); } catch { to = req.body.to.split(',').map((s: string) => s.trim()); }
    } else if (Array.isArray(req.body.to)) {
      to = req.body.to;
    }

    await saveDraftMessage(email, password, {
      to,
      subject: req.body.subject,
      html: req.body.html,
      text: req.body.text,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to save draft' });
  }
});

router.patch('/actions', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;
  const { action, ids, folder, value, targetFolder } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ message: 'Message IDs required' });
    return;
  }

  const uids = ids.map((id: string) => parseInt(id, 10)).filter((n) => !isNaN(n));

  try {
    await updateMessageFlags(email, password, folder || 'INBOX', uids, action, value, targetFolder);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to perform message action' });
  }
});

export default router;
