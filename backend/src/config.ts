import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  imap: {
    host: process.env.IMAP_HOST || 'mail.yourcompany.com',
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'mail.yourcompany.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
  },

  jwtSecret: process.env.JWT_SECRET || 'super_secret_corporate_webmail_jwt_key',
};
