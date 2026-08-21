import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Request, Response, NextFunction } from 'express';

export interface AuthSession {
  email: string;
  passEncrypted: string;
}

// Simple reversible encryption helper for storing password securely in server-only HTTP-only session cookie
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(config.jwtSecret).digest();

export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPassword(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new Error('Failed to decrypt credentials');
  }
}

export function generateToken(email: string, passEncrypted: string): string {
  return jwt.sign({ email, passEncrypted }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthSession;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ message: 'Unauthorized - Please sign in' });
    return;
  }

  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ message: 'Session expired or invalid' });
    return;
  }

  (req as any).user = {
    email: session.email,
    password: decryptPassword(session.passEncrypted),
  };

  next();
}
