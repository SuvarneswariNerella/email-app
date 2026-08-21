import { Router } from 'express';
import { verifyImapCredentials } from '../lib/imap.js';
import { encryptPassword, generateToken, verifyToken, decryptPassword } from '../lib/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    await verifyImapCredentials(email, password);

    const encrypted = encryptPassword(password);
    const token = generateToken(email, encrypted);

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      email,
      name: email.split('@')[0],
      isAuthenticated: true,
    });
  } catch (err: any) {
    console.error(`[Auth Error for ${email}]:`, err?.message || err);
    res.status(401).json({ message: err?.message || 'Authentication failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('session_token');
  res.json({ success: true });
});

router.get('/session', (req, res) => {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ isAuthenticated: false });
    return;
  }

  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ isAuthenticated: false });
    return;
  }

  res.json({
    email: session.email,
    name: session.email.split('@')[0],
    isAuthenticated: true,
  });
});

export default router;
