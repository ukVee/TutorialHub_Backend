# TutorialHub Backend (Express GitHub Proxy)

Minimal Express backend that proxies a fixed GitHub user (OWNER=`ukVee`) for consumption by a static frontend. All GitHub access is server-side; tokens never reach the client.

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

### Headers
No auth headers are required from the client; the server injects `GITHUB_TOKEN` internally.

### Error Responses
- If `GITHUB_TOKEN` is missing: `500 { "error": "GITHUB_TOKEN not configured" }`.
- Upstream GitHub errors: same status code with body `{ error, status, body }` (body is JSON when available).

## Testing

```bash
npm test
```

Vitest suite mocks GitHub responses and covers health, user stats shaping, gists, repo contents, and missing-token handling.

## Notes
- OWNER is hardcoded to `ukVee`. To change, update `OWNER` in `server.ts`.
- Only exposes the above routes to avoid acting as an open proxy.
