# Code Agent Static Publish Implementation

Date: 2026-06-30

## Architecture

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant UI as Message System UI
    participant Node as Message System Server
    participant Runner as message-system_code_agent_runner
    participant Code Agent as Code Agent engine
    participant Store as Object Storage

    User->>UI: ask Code Agent to build and publish a static page
    UI->>Node: ask_ai
    Node->>Runner: run request + scoped publish URL/token
    Runner->>Code Agent: Shell + Message System CLI instructions
    Code Agent->>Runner: message-system site publish --root ... --slug ...
    Runner->>Runner: read and validate workspace files
    Runner->>Node: POST /api/code-agent/publish-static-site
    Node->>Node: verify token and validate files
    Node->>Store: write versioned files
    Node->>Store: write manifest
    Node-->>Runner: public URL
    Runner-->>Code Agent: tool result with URL
    User->>Node: GET /p/:slug/
    Node->>Store: read manifest + file
    Node-->>User: static content
```

## Components

### 1. `PublishedStaticSiteService`

New service under `server/src/services/publishedStaticSite.ts`.

Responsibilities:

- Issue and verify HMAC-signed scoped publish tokens.
- Validate publish payloads.
- Sanitize and reserve slugs.
- Write files to `MediaObjectStorage`.
- Write a manifest at `published-sites/<slug>/manifest.json`.
- Read a manifest and resolve request paths for serving.

Object layout:

```text
published-sites/
  <slug>/
    manifest.json
    versions/
      <versionId>/
        index.html
        assets/app.js
        assets/style.css
```

Manifest shape:

```json
{
  "schemaVersion": 1,
  "slug": "message-system-demo",
  "roomId": "room-1",
  "clientId": "client-1",
  "turnId": "turn-1",
  "title": "Message System Demo",
  "entry": "index.html",
  "versionId": "20260630T120000Z_abcd1234",
  "fileCount": 3,
  "totalBytes": 12345,
  "createdAt": "2026-06-30T12:00:00.000Z",
  "updatedAt": "2026-06-30T12:00:00.000Z",
  "files": [
    {
      "path": "index.html",
      "mimeType": "text/html; charset=utf-8",
      "byteSize": 5120,
      "objectKey": "published-sites/message-system-demo/versions/.../index.html"
    }
  ]
}
```

### 2. Publish Routes

New route module under `server/src/routes/publishedStaticSiteRoutes.ts`.

Routes:

- `POST /api/code-agent/publish-static-site`
  - Protected by `Authorization: Bearer <scoped token>`.
  - Uses a larger JSON body limit for small static artifacts.
  - Returns `{ url, slug, entry, versionId, fileCount, totalBytes }`.

- `DELETE /api/code-agent/publish-static-site`
  - Uses the same scoped turn token and accepts `{ slug }`.
  - Verifies that the slug belongs to the token's room, removes every stored version, and updates the room index.
  - Returns `{ url, slug, objectCount }`; the returned URL is the address that was taken offline.

- `GET /api/code-agent/room-context/sites`
  - Uses the read-only room-context token and rechecks current room access.
  - Returns the sites owned by the current room for `message-system site list --json`.

- `GET /p/:slug`
- `GET /p/:slug/*`
  - Reads manifest and serves the requested file.
  - No path means the manifest entry file.
  - Directory paths fall back to `<dir>/index.html`, then manifest entry for SPA-style routes.

### 3. Media Object Storage

`MediaObjectStorage` already supports local development and S3-compatible writes. S3 needs `getMediaObject` so the app can proxy public published files without signed URLs.

### 4. Code Agent Session Env

`CodeAgentSessionService` should issue a per-turn publish token and pass these environment variables only to the runner process:

```text
MESSAGE_SYSTEM_CODE_AGENT_ENABLE_STATIC_PUBLISH=true
MESSAGE_SYSTEM_STATIC_PUBLISH_URL=https://ai-chat.wenlin.dev/api/code-agent/publish-static-site
MESSAGE_SYSTEM_STATIC_PUBLISH_TOKEN=<scoped token>
MESSAGE_SYSTEM_STATIC_PUBLISH_PUBLIC_BASE_URL=https://ai-chat.wenlin.dev
```

The token is not stored in messages and is not sent to the browser.

The Message System CLI exposes the capability symmetrically:

```bash
message-system site publish --root dist --entry index.html --slug message-system-demo
message-system site unpublish --slug message-system-demo
```

`message-system publish-static-site` remains as a compatibility alias for `message-system site publish`.

### 5. Message System CLI

The runner exposes static-site management only through the shared `message-system` CLI. The previous native `PublishStaticSite` engine tool is removed so Coco, Codex CLI, and Codex app-server use one contract.

`message-system site list --json` is read-only and uses the room-context broker, so it is available in every mode without exposing a publish token. `site publish` and `site unpublish` require all of:

- Mode is Edit, Approve for me, or Full access (`acceptEdits` is treated as the legacy alias for Edit).
- `MESSAGE_SYSTEM_CODE_AGENT_ENABLE_STATIC_PUBLISH=true`.
- Publish URL and token are present.

Publish input:

```json
{
  "root": "dist",
  "entry": "index.html",
  "slug": "message-system-demo",
  "title": "Message System Demo"
}
```

The publish command:

1. Resolves `root` inside the current workspace.
2. Walks files recursively.
3. Filters unsafe directories and file names.
4. Enforces file count and byte limits.
5. Base64-encodes file contents.
6. POSTs the payload to Message System.
7. Returns a concise JSON or human-readable result with the durable URL.

The unpublish command sends `DELETE /api/code-agent/publish-static-site` with the scoped token. The server verifies room ownership, removes every stored version for the slug, and updates or deletes the room index. It never deletes workspace files.

### 6. System Prompt

The runner system prompt describes the CLI only when the matching read or write capability is available:

```text
message-system site list --json
message-system site publish --root dist --entry index.html --slug message-system-demo
message-system site unpublish --slug message-system-demo
```

## Tests

### Server

- Token issue/verify accepts valid tokens and rejects expired/tampered tokens.
- Publish stores files and manifest.
- Publish rejects missing entry, bad path traversal, unsupported MIME/type, oversized payload, and slug ownership conflict.
- Routes serve `index.html`, assets, directory index, and SPA fallback.
- Unpublish rejects cross-room and Plan-mode tokens, removes all stored versions, and keeps the room index consistent.
- Routes return 404 for missing slugs and unsafe paths.

### Runner

- Plan mode can run `site list`, but rejects `site publish` and `site unpublish`.
- Writable modes expose publish credentials to the CLI.
- The native `PublishStaticSite` engine tool is absent.
- System prompts list only the CLI commands available in the current mode.
- Tool posts valid payloads and returns the URL.
- CLI supports `site publish` and `site unpublish`; both reject Plan-mode access.
- Tool rejects traversal, missing entry, oversized files, and secret-like files before making an HTTP request.

### Integration

- `CodeAgentSessionService` passes the scoped publish env only to JSONL runner turns.
- The publish env includes room, client, turn, and mode-bound token claims.

## Deployment

Required production settings:

```text
MEDIA_BUCKET_NAME=...
MEDIA_STORAGE_ENDPOINT=...
MEDIA_STORAGE_REGION=...
CODE_AGENT_STATIC_PUBLISH_PUBLIC_URL=https://ai-chat.wenlin.dev
CODE_AGENT_STATIC_PUBLISH_TOKEN_SECRET=...
```

Recommended later:

```text
CODE_AGENT_STATIC_PUBLISH_PUBLIC_URL=https://published.ai-chat.wenlin.dev
```

Using a dedicated publish host isolates arbitrary static JavaScript from the main Message System app origin.
