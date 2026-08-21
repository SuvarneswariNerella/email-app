import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { getImapClient } from './imap.js';

export async function sendMail(
  email: string,
  pass: string,
  options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
    inReplyTo?: string;
    references?: string;
  },
) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: email,
      pass: pass,
    },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: email,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
    text: options.text,
    inReplyTo: options.inReplyTo,
    references: options.references,
    attachments: options.attachments,
  };

  const info = await transporter.sendMail(mailOptions);

  // Append copy to IMAP Sent folder
  try {
    const imap = getImapClient(email, pass);
    await imap.connect();
    // Build raw message buffer
    const mailComposer = new (await import('nodemailer/lib/mail-composer/index.js')).default(mailOptions);
    const rawBuffer = await mailComposer.compile().build();
    await imap.append('Sent', rawBuffer, ['\\Seen']);
    await imap.logout();
  } catch {
    // Non-fatal if append fails
  }

  return info;
}
