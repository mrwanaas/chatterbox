# 💬 Chatterbox

A full-stack, real-time communication platform inspired by Discord — built with React, Node.js, Socket.io, WebRTC, and MongoDB.

![Chatterbox Banner](https://placehold.co/900x200/5865f2/ffffff?text=Chatterbox+%E2%80%93+Real-time+Communication)

---

## ✨ Features

| Category | Features |
|---|---|
| **Auth** | Email/password registration, JWT + refresh token rotation, password reset via email |
| **Friends** | Add/remove/block friends, real-time friend requests, online presence |
| **Direct Messages** | 1-on-1 DMs, group DMs, infinite scroll, read receipts, typing indicators |
| **Servers** | Create servers, text & voice channels, invite links, member roles |
| **Messaging** | Edit/delete messages, emoji reactions, file/image attachments, reply threads |
| **Voice/Video** | WebRTC peer-to-peer calls, screen sharing, mute/camera toggle |
| **Telegram Bot** | Link Telegram account, receive notifications, reply via bot |
| **UI** | Discord-inspired dark theme, responsive sidebar, toast notifications |

---

## 🗂 Project Structure

```
chatterbox/
├── backend/                    # Node.js / Express API
│   ├── src/
│   │   ├── config/             # DB connection
│   │   ├── middleware/         # Auth, error handler, uploads
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/             # REST API routes
│   │   ├── socket/             # Socket.io server + event handlers
│   │   ├── services/           # Email & Telegram services
│   │   └── server.js           # Entry point
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── layout/         # AppSidebar, ServerSidebar, DMSidebar
│   │   │   ├── messages/       # MessageList, MessageItem, MessageInput
│   │   │   ├── calls/          # VideoCallModal, IncomingCall, VoiceChannel
│   │   │   └── common/         # UserAvatar, LoadingScreen
│   │   ├── context/            # Zustand stores (auth, chat, socket)
│   │   ├── hooks/              # useWebRTC
│   │   ├── pages/              # Login, Register, Home, Server, Friends, Settings
│   │   ├── services/           # Axios API client
│   │   └── App.jsx             # Routes + providers
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start (Local Dev)

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** running locally (`mongod`) or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) URI
- **npm** ≥ 9

### 1 — Clone & install

```bash
git clone https://github.com/yourname/chatterbox.git
cd chatterbox

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2 — Configure environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, REFRESH_TOKEN_SECRET at minimum

# Frontend
cd ../frontend
cp .env.example .env
# VITE_API_URL and VITE_SOCKET_URL default to localhost — no changes needed for dev
```

**Minimum required `.env` for backend:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatterbox
JWT_SECRET=change_me_in_production_32chars
REFRESH_TOKEN_SECRET=change_me_too_32chars
CLIENT_URL=http://localhost:5173
```

### 3 — Run

Open two terminals:

```bash
# Terminal 1 – Backend (with hot reload)
cd backend
npm run dev

# Terminal 2 – Frontend (Vite dev server)
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🐳 Docker (Recommended for Production)

```bash
# 1. Copy and fill in both .env files
cp backend/.env.example backend/.env
# Edit backend/.env with your production values

# 2. Start all services
docker compose up --build -d

# 3. View logs
docker compose logs -f backend
```

Services:
| Container | Port | Description |
|---|---|---|
| `chatterbox_mongo` | 27017 | MongoDB 7 |
| `chatterbox_backend` | 5000 | Node.js API + Socket.io |
| `chatterbox_frontend` | 80 | Nginx serving Vite build |

---

## ☁️ Deploying to the Cloud

### Option A — Railway (easiest)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **MongoDB** plugin
4. Set env vars for the backend service
5. For the frontend, set `VITE_API_URL` to your backend Railway URL
6. Deploy — Railway handles the rest

### Option B — Render

1. Create a **Web Service** for the backend (root: `backend/`, start: `npm start`)
2. Create a **Static Site** for the frontend (root: `frontend/`, build: `npm run build`, publish: `dist/`)
3. Add a free MongoDB database via [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
4. Configure env vars in each Render service dashboard

### Option C — VPS (Ubuntu / Debian)

```bash
# Install Node, MongoDB, Nginx, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs mongodb nginx

# Clone, install, build
git clone https://github.com/yourname/chatterbox.git /var/www/chatterbox
cd /var/www/chatterbox/backend && npm ci
cd /var/www/chatterbox/frontend && npm ci && npm run build

# Run backend with PM2
npm install -g pm2
pm2 start /var/www/chatterbox/backend/src/server.js --name chatterbox-backend
pm2 save && pm2 startup

# Configure Nginx (see frontend/nginx.conf as reference)
# sudo cp /var/www/chatterbox/frontend/nginx.conf /etc/nginx/sites-available/chatterbox
# sudo ln -s /etc/nginx/sites-available/chatterbox /etc/nginx/sites-enabled/
# sudo nginx -t && sudo systemctl reload nginx
```

---

## 📡 Socket.io Events Reference

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join:channel` | client→server | `channelId` | Join a text channel room |
| `join:dm` | client→server | `chatId` | Join a DM room |
| `message:new` | server→client | `{ message }` | New message received |
| `message:updated` | server→client | `{ message }` | Message was edited |
| `message:deleted` | server→client | `{ messageId }` | Message was deleted |
| `typing:start` | bidirectional | `{ roomId, roomType }` | User started typing |
| `typing:stop` | bidirectional | `{ roomId, roomType }` | User stopped typing |
| `user:presence` | server→client | `{ userId, status }` | User came online/offline |
| `friend:request` | server→client | `{ request }` | Incoming friend request |
| `call:initiate` | client→server | `{ targetUserId, callType }` | Start a call |
| `call:incoming` | server→client | `{ callerId, callType }` | Incoming call notification |
| `call:accept` | client→server | `{ callerSocketId }` | Accept call |
| `call:declined` | server→client | `{}` | Call was declined |
| `signal:offer` | bidirectional | `{ offer, targetSocketId }` | WebRTC SDP offer |
| `signal:answer` | bidirectional | `{ answer, fromSocketId }` | WebRTC SDP answer |
| `signal:ice-candidate` | bidirectional | `{ candidate }` | ICE candidate exchange |
| `voice:join` | client→server | `{ channelId }` | Join voice channel |
| `voice:leave` | client→server | `{ channelId }` | Leave voice channel |
| `voice:userJoined` | server→client | `{ userId, socketId }` | Participant joined voice |
| `voice:userLeft` | server→client | `{ userId }` | Participant left voice |

---

## 🤖 Telegram Bot Setup

1. Open Telegram → search **@BotFather** → `/newbot`
2. Follow prompts to get your `BOT_TOKEN`
3. Set in `backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_BOT_USERNAME=YourBotUsername
   # For production webhook:
   TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
   ```
4. In development, the bot uses **polling** automatically (no webhook needed)
5. Users link via: **Settings → Telegram → Link Telegram Account**

**Bot Commands:**

| Command | Description |
|---|---|
| `/start` | Show welcome message |
| `/link <code>` | Link Chatterbox account |
| `/unlink` | Unlink account |
| `/messages` | List recent conversations |
| `/reply <n> <text>` | Reply to conversation #n |

---

## 🔐 Security Notes

- Passwords hashed with **bcrypt** (12 rounds)
- JWT access tokens expire in **15 minutes**; refresh tokens in **7 days** (httpOnly cookie)
- **Refresh token rotation** — old token invalidated on each refresh
- Input validated with `express-validator` on all routes
- Mongoose prevents NoSQL injection by design
- Rate limiting: 500 req/15 min globally, 20 req/15 min on auth routes
- CORS restricted to `CLIENT_URL`
- `helmet` sets security headers

---

## 🛠 Tech Stack

**Backend:** Node.js 20 · Express 4 · Socket.io 4 · Mongoose 8 · JWT · bcryptjs · Multer · Nodemailer · node-telegram-bot-api

**Frontend:** React 18 · Vite 5 · Tailwind CSS 3 · Zustand 4 · Socket.io-client · simple-peer (WebRTC) · React Router 6 · emoji-picker-react · react-hot-toast · date-fns · Axios

**Infrastructure:** MongoDB 7 · Nginx · Docker / Docker Compose

---

## 📝 License

MIT © 2024 Chatterbox Contributors
