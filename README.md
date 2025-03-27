# Message System

[中文版](./README.zh.md)

A lightweight WebSocket-based real-time messaging system with Redis storage. Useful as a foundation for chat apps, internal tools, or collaborative platforms.

---

## 🚀 Tech Stack

### Client

- React + TypeScript
- Tailwind CSS
- React Router
- Socket.io Client
- i18next (Internationalization)

### Server

- Node.js + Express
- Socket.io
- Redis (as storage engine)
- UUID-based identity

---

## 🌟 Features

- ✅ Real-time message sending/receiving
- ✅ Join or create rooms
- ✅ Local saved rooms
- ✅ Persistent room/message storage via Redis
- ✅ Dark/light mode toggle
- ✅ Responsive UI
- ✅ Multi-language (English & Chinese)

---

## 🧪 Quick Start

### Requirements

- Node.js installed
- Redis installed and running locally (default on `localhost:6379`)

### Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### Start the system

Use the provided script:

```bash
./start.sh
```

Or start manually:

```bash
cd server
npm start

cd ../client
npm run dev
```

---

## 🧭 Usage

1. Visit [http://localhost:3011](http://localhost:3011)
2. A unique `clientId` will be assigned and saved in `localStorage`
3. Create or join a room and chat in real time

---

## 🔌 API Overview

### HTTP Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/rooms` | `GET` | Get rooms created by current user |
| `/api/rooms` | `POST` | Create a new room |
| `/api/messages` | `GET` | Get room messages (require `roomId`) |
| `/api/messages` | `POST` | Send message |
| `/api/rooms/:id` | `GET` | Get specific room (if owned) |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `register` | Client → Server | Register user with clientId |
| `get_rooms` | Client → Server | Get rooms created by user |
| `create_room` | Client → Server | Create room |
| `join_room` | Client → Server | Join room |
| `leave_room` | Client → Server | Leave room |
| `send_message` | Client → Server | Send a message |
| `get_room_by_id` | Client → Server | Get room info via ID |
| `message_history` | Server → Client | Room message history |
| `new_room` | Server → Client | New room notification (scoped to client) |
| `new_message` | Server → Client | New message broadcast to room |

---

## ⚙️ Configuration

### Server `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3012 | Server port |
| `CLIENT_URL` | http://localhost:3011 | CORS origin |

### Client `.env`

`.env.development`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SOCKET_URL` | http://localhost:3012 | WebSocket base URL |

`.env.production`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SOCKET_URL` | `/` | Use relative path for same-origin deployment |

---

## 📦 Redis Persistence

The system uses **RDB snapshot** persistence by default. You may enable **AOF** or adjust the save policies via `redis.conf`.

---

## 📄 License

MIT License

Copyright (c) 2024 Message System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---
