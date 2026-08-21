# 📧 Organization Webmail Client

A modern, fast, and responsive webmail client built with **React 19**, **Vite**, **TailwindCSS v4**, and **TipTap WYSIWYG Editor**, decoupled from all AI/SaaS bloat and designed to connect directly to any corporate **IMAP/SMTP** mail server.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Modern Webmail Frontend (SPA)               │
│     React 19 + Tailwind v4 + TipTap + Lucide + Radix UI     │
│                                                             │
│         [ Cloudflare Pages Free Tier OR Self-Hosted ]       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            Lightweight Node.js IMAP/SMTP API Proxy          │
│                                                             │
│   • imapflow (Direct IMAP socket pool & MIME streaming)     │
│   • mailparser (Inline CID image replacement & attachments) │
│   • nodemailer (Outgoing SMTP & automatic Sent copy)        │
│   • Stateless: NO DUPLICATE DATABASE REQUIRED               │
│                                                             │
│               [ Docker Container / Small VPS ]              │
└──────────────┬───────────────────────────────┬──────────────┘
               │ IMAP (Port 993/143)           │ SMTP (Port 587/465)
               ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Your Organization's Mail Server                │
│    (Dovecot, Stalwart, Postfix, Zimbra, Exchange, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Environment Variables Reference

Create `standalone-webmail/backend/.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for the backend API server |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin for frontend |
| `IMAP_HOST` | `mail.yourcompany.com` | Incoming IMAP server hostname |
| `IMAP_PORT` | `993` | IMAP port (`993` for SSL/TLS, `143` for STARTTLS) |
| `IMAP_SECURE`| `true` | `true` for Port 993 (TLS), `false` for Port 143 |
| `SMTP_HOST` | `mail.yourcompany.com` | Outgoing SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL) |
| `SMTP_SECURE`| `false` | `true` for Port 465 (SSL), `false` for Port 587 |
| `JWT_SECRET` | *(required)* | Random secret string used to encrypt session tokens |

---

## 🚀 Running Locally

### 1. Start the Backend API
```bash
cd standalone-webmail/backend
cp .env.example .env    # Configure your IMAP/SMTP details
npm install
npm run dev
```

### 2. Start the Frontend Client
```bash
cd standalone-webmail/frontend
npm install
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** and sign in with any corporate email and password.

---

## 🚢 Production Deployment Options

### Option A: Cloudflare Pages (Frontend Free) + Docker/VPS (Backend)

1. **Deploy Frontend on Cloudflare Pages**:
   - Create a new project on **Cloudflare Pages**.
   - Root Directory: `standalone-webmail/frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Set environment variable: `VITE_API_URL=https://api.mail.yourcompany.com` (or proxy via Cloudflare).

2. **Deploy Backend on your Server / VPS**:
   ```bash
   cd standalone-webmail
   docker compose up -d backend
   ```

---

### Option B: All-in-One Self-Hosted Docker Compose

Run both the frontend (served via Nginx) and the backend together on your own server or Docker host:

```bash
cd standalone-webmail
docker compose up -d --build
```
Your webmail will be available at **http://your-server-ip:3000** (or port 80 when behind reverse proxy).

---

## ⌨️ Built-in Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `j` or `↓` | Select next email |
| `k` or `↑` | Select previous email |
| `c` | Open new email composer |
| `e` | Delete / Trash selected email |
| `s` | Star / Unstar email |
| `Esc` | Close email composer |
