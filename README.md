# Message System

Real-time room chat with AI assistants, private media sharing, stickers, saved rooms, room administration, mobile recovery, and optional PostgreSQL persistence.

Repository: [github.com/WENLIN-LI/message-system](https://github.com/WENLIN-LI/message-system)

## What Is Included

- React 18 + Vite client in `client-heroui/`.
- Node.js 22 + Express + Socket.IO server in `server/`.
- Redis-backed realtime presence, Socket.IO scaling, and default durable storage.
- Optional PostgreSQL durable store with Redis kept for realtime state and message caching.
- Private media uploads through S3-compatible storage in production, with local media object routes for development.
- AI streaming through DeepSeek, Anthropic, OpenAI/OpenRouter-compatible models, plus AI role draft generation.
- Audio transcription through AssemblyAI when configured.
- Google sign-in linking, client password protection, room passwords, admin/member controls, and optional web push notifications.
- Five UI languages: English, Chinese, Hindi, Japanese, and Korean.
- Unit/component tests, Socket.IO/repository/API tests, and Playwright E2E coverage.

## Repository Layout

```text
client-heroui/     React + TypeScript + Vite frontend
server/            Express + Socket.IO TypeScript backend
docs/              Runbooks, design records, migration notes, reliability notes
Dockerfile         Production image: builds client and server, serves client from Express
fly.toml           Fly.io app configuration for the message-system app
start.sh           Local launcher: server on 3012, client on 3011
CLAUDE.md          Developer/agent guide; AGENTS.md points to it
```

## Architecture

```mermaid
flowchart LR
  Browser["Browser client"] <--> Socket["Socket.IO server"]
  Browser --> API["Express API"]
  Socket --> Store["CompositeRoomStore"]
  API --> Store
  Store --> Durable["Redis or PostgreSQL durable data"]
  Store --> Realtime["Redis realtime state + adapter + cache"]
  Socket --> AI["AI providers"]
  API --> Media["S3-compatible or local media storage"]
  API --> Auth["Google auth + client tokens"]
  API --> Push["Web push"]
```

The server chooses its durable store with `PERSISTENCE_STORE`:

- `redis`: Redis stores rooms, messages, members, auth, media metadata, and realtime state.
- `postgres`: PostgreSQL stores durable records, while Redis still handles online presence, socket sessions, Socket.IO pub/sub, and the optional room-message cache.

The React app is a single-page app centered on `MessagePage`. UI is organized under `src/components`, stateful behavior under `src/hooks`, and socket/API/persistence helpers under `src/utils`.

## Requirements

- Node.js 22.
- Redis at `redis://localhost:6379` for local development.
- Optional PostgreSQL database for PostgreSQL persistence tests and smoke tests.
- Optional provider accounts for AI, media storage, Google sign-in, AssemblyAI, and web push.

## Quick Start

Install dependencies:

```bash
cd server
npm install

cd ../client-heroui
npm install
```

Create backend config:

```bash
cp server/.env.example server/.env
```

For a minimal local chat setup, leave Redis enabled and start a local Redis server. For AI responses, add at least one provider key such as `DEEPSEEK_API_KEY` or `OPENROUTER_API_KEY`.

Start both apps:

```bash
./start.sh
```

The launcher builds the server, starts the compiled server on `http://localhost:3012`, and starts Vite on `http://localhost:3011`.

Manual development mode:

```bash
cd server
npm run dev
```

```bash
cd client-heroui
npm run dev
```

Open [http://localhost:3011](http://localhost:3011).

## Commands

Server:

```bash
cd server
npm run dev                         # ts-node-dev hot reload
npm run build                       # TypeScript build to dist/
npm start                           # run dist/src/server.js
npm test                            # Node built-in test runner over src/**/*.test.ts
npm run migrate:redis-to-postgres   # Redis -> PostgreSQL migration
npm run smoke:persistence           # guarded local persistence smoke test
```

Client:

```bash
cd client-heroui
npm run dev                 # Vite dev server
npm test                    # Vitest unit/component tests
npm run lint                # ESLint
npm run check:i18n          # verify translation keys
npm run translate:i18n:dry  # preview generated translation updates
npm run translate:i18n      # apply generated translation updates
npm run build               # i18n check + TypeScript + Vite build
npm run test:e2e            # Playwright E2E
npm run test:e2e:postgres   # Playwright E2E against PostgreSQL mode
npm run preview             # preview built client
```

## Configuration

Start from `server/.env.example`, then add optional service variables as needed.

| Area | Variables |
| --- | --- |
| HTTP/CORS | `PORT`, `CLIENT_URL`, `NODE_ENV` |
| Redis | `REDIS_URL` |
| Persistence | `PERSISTENCE_STORE`, `DATABASE_URL`, `POSTGRES_SSL`, `POSTGRES_SSL_REJECT_UNAUTHORIZED`, `POSTGRES_SSL_CA_BASE64`, `POSTGRES_SSL_CA`, `ROOM_MESSAGES_CACHE_TTL_SECONDS` |
| AI | `AI_MODEL`, `AI_MODEL_OPTIONS`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_NAME` |
| Media storage | `MEDIA_BUCKET_NAME`, `MEDIA_STORAGE_REGION`, `MEDIA_STORAGE_ENDPOINT`, `MEDIA_STORAGE_FORCE_PATH_STYLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `LOCAL_MEDIA_DIR` |
| Optional services | `ASSEMBLYAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_IDS`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` |

Client environment files:

- `client-heroui/.env.development` points the browser to the local server with `VITE_SOCKET_URL=http://localhost:3012`.
- `client-heroui/.env.production` uses same-origin routing with `VITE_SOCKET_URL=/`.

Only browser-safe values should use the `VITE_*` prefix.

## AI Models

The default AI model is `deepseek-v4-pro`. The built-in catalog includes DeepSeek, Claude, GPT, Kimi, GLM, MiniMax, Grok, Tencent, and Gemini options. `AI_MODEL_OPTIONS` controls which model IDs are exposed, and unknown configured models are treated as OpenRouter model IDs.

Premium models require confirmation in the client when pricing metadata marks them as expensive or unknown.

## Persistence

Redis is the default local durable store:

```env
PERSISTENCE_STORE=redis
REDIS_URL=redis://localhost:6379
```

PostgreSQL mode:

```env
PERSISTENCE_STORE=postgres
DATABASE_URL=postgres://user:password@localhost:5432/message_system
REDIS_URL=redis://localhost:6379
```

Redis-to-PostgreSQL migration:

```bash
cd server
REDIS_URL="redis://..." npm run migrate:redis-to-postgres -- --dry-run
REDIS_URL="redis://..." DATABASE_URL="postgres://..." npm run migrate:redis-to-postgres
```

Persistence smoke tests are guarded so they do not accidentally run against production data:

```bash
cd server
npm run smoke:persistence
TEST_DATABASE_URL="postgres://localhost/message_system_test" npm run smoke:persistence
```

PostgreSQL smoke database names must include `test` or `e2e` as a separated token.

## Media Storage

Production media uses private S3-compatible object storage configured with `MEDIA_*` and AWS credential variables. Fly/Tigris is the current production target.

When S3-compatible storage is not configured, development can use local media object routes backed by `LOCAL_MEDIA_DIR`.

The legacy base64-to-object-storage migration is intentionally disabled in this checkout. `npm run migrate:media-to-object-storage` exits with a message until `server/src/scripts/migrateLegacyMediaMessagesToObjectStorage.ts` is restored or reimplemented.

## Deployment

Deployment is CI-first:

- Pushes to `master` trigger `.github/workflows/fly-deploy.yml`.
- CI installs dependencies, builds server and client, runs translation validation, verifies required Fly secrets, and deploys with `flyctl deploy --remote-only -a message-system`.
- The Docker image builds the Vite client, builds the TypeScript server, then serves the compiled client from Express.
- Production app: `message-system` on Fly.io in `dfw`.

Required Fly secrets include AI provider keys, S3/Tigris credentials, media bucket/endpoint values, and `GOOGLE_CLIENT_ID`. See [DeploymentGuide.md](DeploymentGuide.md) for the full runbook.

## Testing

The repository has four main test layers:

- Server repository, route, service, and socket tests with Node's built-in test runner.
- Client component and utility tests with Vitest and Testing Library.
- Playwright E2E for room flows, message flows, AI/media sharing, mobile behavior, room restore, realtime behavior, and PostgreSQL persistence.
- i18n key checks as part of the client build.

Use focused tests near changed code. Use Playwright for browser-visible behavior and PostgreSQL E2E for persistence-mode regressions.

## Documentation

- [CLAUDE.md](CLAUDE.md): developer and agent operating guide.
- [DeploymentGuide.md](DeploymentGuide.md): production deployment runbook.
- [docs/postgres-rollout-runbook.md](docs/postgres-rollout-runbook.md): PostgreSQL cutover checklist.
- [docs/image-object-storage-migration-runbook.md](docs/image-object-storage-migration-runbook.md): media storage migration notes.
- [docs/media-viewer-gesture-requirements.md](docs/media-viewer-gesture-requirements.md): media viewer gesture requirements.
- [docs/documentation-audit.md](docs/documentation-audit.md): documentation status map.

Some files in `docs/` are historical plans or implementation records. Treat this README, `CLAUDE.md`, and active runbooks as the primary entry points.
