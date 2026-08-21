import { Router } from 'express';
import { authMiddleware } from '../lib/auth.js';
import { listMailboxes } from '../lib/imap.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const { email, password } = (req as any).user;

  try {
    const folders = await listMailboxes(email, password);
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to list folders' });
  }
});

export default router;
