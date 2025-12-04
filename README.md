# TutorialHub Backend (Express GitHub Proxy)

Minimal Express backend that proxies a fixed GitHub user (OWNER=`ukVee`) for consumption by a static frontend. All GitHub access is server-side; tokens never reach the client.

## Environment & Auth
- `GITHUB_TOKEN` (required): PAT with scopes to read target resources. Missing token returns `500`.
- `GITHUB_API_BASE_URL` (optional): override for GitHub Enterprise API root.
- Origin guard (middleware runs globally in `server.ts`):
  - Dev (`NODE_ENV !== 'production'`): `Origin`/`Referer` host must be `localhost:3000`.
  - Prod (`NODE_ENV === 'production'`): `Origin`/`Referer` must be `https://ukvee.github.io/TutorialHub/` (host `ukvee.github.io`, path `/TutorialHub/` or `/`).
  - Otherwise: `403 { "error": "origin not allowed" }`.
  - Browsers set `Origin` automatically; CLI must set it, e.g. `curl -H "Origin: http://localhost:3000" ...`.

## Requirements
- Node.js 20+
- npm (ships with Node)

## Configuration
Place a `.env` in the repo root (same directory as `package.json`). Example:

```
GITHUB_TOKEN=ghp_your_personal_access_token
# Optional: override for GitHub Enterprise
# GITHUB_API_BASE_URL=https://github.mycompany.com/api/v3
```

> The token must have scopes sufficient for reading the targeted resources (public data only requires `public_repo` and `read:user`).

## Install

```bash
npm install
```

If your global npm cache has permission issues, you can use a local cache:

```bash
NPM_CONFIG_CACHE=./.npm-cache npm install
```

## Run

- Dev (tsx watch):

  ```bash
  npm run dev
  ```

- Production build + start:

  ```bash
  npm run build
  npm start
  ```

The server listens on `PORT` (default `4000`).

## API Endpoints
Base URL: `http://localhost:4000`

- `GET /health`
  - Returns `{ "status": "healthy" }`.

- `GET /api/github/user`
  - Returns selected profile fields for `ukVee`:
    - `login`, `name`, `avatar_url`, `followers`, `following`, `public_repos`, `public_gists`, `html_url`, `bio`.

- `GET /api/github/gists`
  - Returns all public gists for `ukVee` (raw GitHub response).

- `GET /api/github/repos/:repo/contents`
  - Query param `path` (optional) selects nested paths.
  - Example: `/api/github/repos/demo/contents?path=src/utils`
  - Returns GitHub contents API payload for the given repo/path.

- `GET /api/github/repos/i3-scripts/file`
  - Provide the file path via `?filepath=...` (alias: `?path=...`).
  - Returns the raw text content (UTF-8 decoded from GitHub’s base64 payload). Binary files will be mangled.

### Headers
No auth headers are required from the client; the server injects `GITHUB_TOKEN` internally. An allowed `Origin`/`Referer` header is required (see Origin guard above).

### Error Responses
- If `GITHUB_TOKEN` is missing: `500 { "error": "GITHUB_TOKEN not configured" }`.
- Upstream GitHub errors: same status code with body `{ error, status, body }` (body is JSON when available).
- Origin check failures: `403 { "error": "origin not allowed" }`.

## Testing

```bash
npm test
```

Vitest suite mocks GitHub responses and covers health, user stats shaping, gists, repo contents, and missing-token handling.

## Notes
- OWNER is hardcoded to `ukVee`. To change, update `OWNER` in `lib/auth.ts`.
- Only exposes the above routes to avoid acting as an open proxy.

## Route & Auth Wiring (for client setup)
- Global middleware (`server.ts`): `originGuard` enforces allowed `Origin`/`Referer` before `/api`.
- GitHub helpers (`lib/auth.ts`):
  - `assertToken(res)`: returns 500 JSON if `GITHUB_TOKEN` is missing.
  - `fetchWithAuth(url)`: attaches Bearer token, GitHub accept header, and UA for every GitHub API request.
- Routers (`apiRoutes/github.ts`):
  - All GitHub calls reuse shared helpers.
  - File endpoint is fixed to `i3-scripts` and returns plain text content.
