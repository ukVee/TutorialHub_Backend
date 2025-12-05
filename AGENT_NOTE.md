# AGENTS.md (backend)

## Scope
- Express 5 TypeScript (CJS) GitHub proxy for fixed OWNER=`ukVee`.
- Exports `app` (for Vercel). When run directly, listens on `PORT` (default 4000).

## Stack & Layout
- Node 20+, npm. TS `strict`. Built with `tsc` → `dist/`; runtime CJS (`type: "commonjs"`).
- `server.ts`: wires `cors`, `express.json`, `originGuard`, mounts `/api`.
- `middleware/index.ts`: originGuard — dev allows `localhost:3000`; prod requires `ukvee.github.io` with path `/TutorialHub/` (or `/`).
- `apiRoutes/github.ts`:
  - `GET /api/github/user` (selected profile fields)
  - `GET /api/github/gists`
  - `GET /api/github/repos/:repo/contents?path=...` (repo regex `[A-Za-z0-9_.-]+`, path sanitized/encoded)
  - `GET /api/github/repos/:repo/file/stream?filepath=...&start=...` (range-aware, streams raw text; preferred)
  - `GET /api/github/repos/i3-scripts/file?filepath=...` (or `path=`); rejects `..`, only accepts `base64` payloads, returns decoded text (legacy)
- `lib/auth.ts`: `OWNER`, `GITHUB_API_BASE_URL` (default `https://api.github.com`), `GITHUB_TOKEN` required; `assertToken` sends 500 if missing; `fetchWithAuth` attaches Bearer + UA.
- `lib/types.ts`: `GitHubContentFile` type.

## Environment
- Required: `GITHUB_TOKEN`.
- Optional: `GITHUB_API_BASE_URL`, `PORT` (default 4000), `NODE_ENV` (controls originGuard behavior).

## Commands
- `npm install`
- `npm run dev`      # tsx watch
- `npm run build`    # tsc → dist/
- `npm start`        # node dist/server.js
- `npm test`         # removed/unused; no tests present as of 2025-12-04.

## Behavior & Constraints
- `cors()` enabled; originGuard still enforces allowed hosts—change only with explicit intent.
- Upstream GitHub errors are forwarded as `{ error, status, body }`; keep this contract for the frontend.
- File endpoint is text-only; binary content will be corrupted.
- Changing OWNER requires updating `lib/auth.ts` (and ensuring frontend expectations align).
