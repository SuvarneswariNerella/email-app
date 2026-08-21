import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { getConnectedClient, findSentMailbox } from './imap.js';

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

  // Append copy of sent email to IMAP Sent folder
  try {
    const imap = await getConnectedClient(email, pass);
    const sentMailbox = await findSentMailbox(imap);
    const mailComposerModule = await import('nodemailer/lib/mail-composer/index.js');
    const MailComposer = (mailComposerModule as any).default || mailComposerModule;
    const mailComposer = new MailComposer(mailOptions);
    const rawBuffer = await mailComposer.compile().build();
    await imap.append(sentMailbox, rawBuffer, ['\\Seen']);
  } catch (appendErr) {
    console.error('[SMTP Append to Sent Error]:', appendErr);
  }

  return info;
}
