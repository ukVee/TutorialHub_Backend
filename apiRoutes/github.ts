import { Router, type Request, type Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

import { GitHubContentFile } from '../lib/types';
import { assertToken, fetchWithAuth, GITHUB_API_BASE_URL, OWNER, GITHUB_TOKEN, USER_AGENT } from '../lib/auth';

const githubRouter = Router();

function safeJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

githubRouter.get('/user', async (_req, res) => {
  if (!assertToken(res)) return;

  const url = `${GITHUB_API_BASE_URL}/users/${OWNER}`;
  const ghRes = await fetchWithAuth(url);
  const bodyText = await ghRes.text();

  if (!ghRes.ok) {
    return res
      .status(ghRes.status)
      .json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
  }

  const data = safeJson(bodyText);
  const shaped = data && typeof data === 'object'
    ? {
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        followers: data.followers,
        following: data.following,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        html_url: data.html_url,
        bio: data.bio,
      }
    : data;

  return res.json(shaped);
});

githubRouter.get('/gists', async (_req, res) => {
  if (!assertToken(res)) return;

  const url = `${GITHUB_API_BASE_URL}/users/${OWNER}/gists`;
  const ghRes = await fetchWithAuth(url);
  const bodyText = await ghRes.text();

  if (!ghRes.ok) {
    return res
      .status(ghRes.status)
      .json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
  }

  return res.json(safeJson(bodyText));
});

// Repo contents for OWNER; optional path via query ?path=... inside repo
githubRouter.get('/repos/:repo/contents', async (req, res) => {
  if (!assertToken(res)) return;

  const repo = (req.params.repo || '').trim();
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  if (!/^[A-Za-z0-9_.-]+$/.test(repo)) return res.status(400).json({ error: 'invalid repo name' });

  const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
  const encodedPath = rawPath
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const pathSuffix = encodedPath ? `/${encodedPath}` : '';

  const url = `${GITHUB_API_BASE_URL}/repos/${OWNER}/${repo}/contents${pathSuffix}`;
  console.log(`[github:list] repo=${repo} path=${rawPath || '/'} url=${url}`);
  const ghRes = await fetchWithAuth(url);
  const bodyText = await ghRes.text();

  if (!ghRes.ok) {
    console.log(`[github:list:error] status=${ghRes.status} body=${bodyText.slice(0, 200)}`);
    return res
      .status(ghRes.status)
      .json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
  }

  return res.json(safeJson(bodyText));
});

function validateRepoParam(rawRepo: string) {
  if (!rawRepo) return undefined;
  const repo = rawRepo.trim();
  if (!repo) return undefined;
  if (!/^[A-Za-z0-9_.-]+$/.test(repo)) return undefined;
  return repo;
}

function sanitizePath(rawPath: unknown): string | undefined {
  const val = typeof rawPath === 'string' ? rawPath.trim() : '';
  if (!val) return undefined;
  const parts = val.split('/').filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.some((segment) => segment === '..')) return undefined;
  return parts.join('/');
}

// Stream file contents with range support; falls back to full-fetch chunking when Range unsupported.
githubRouter.get('/repos/:repo/file/stream', async (req: Request, res: Response) => {
  if (!assertToken(res)) return;

  const repo = validateRepoParam(req.params.repo || '');
  if (!repo) return res.status(400).json({ error: 'invalid repo' });

  const sanitizedPath = sanitizePath(req.query.filepath ?? req.query.path);
  if (!sanitizedPath) return res.status(400).json({ error: 'filepath is required' });

  const startRaw = typeof req.query.start === 'string' ? req.query.start : undefined;
  const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
  if (Number.isNaN(start) || start < 0) return res.status(400).json({ error: 'start must be >= 0' });

  const apiUrl = `${GITHUB_API_BASE_URL}/repos/${OWNER}/${repo}/contents/${encodeURI(sanitizedPath)}`;
  console.log(`[github:file-stream] repo=${repo} path=${sanitizedPath} start=${start}`);

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': USER_AGENT,
  };
  if (start > 0) {
    upstreamHeaders.Range = `bytes=${start}-`;
  }

  const upstream = await fetch(apiUrl, { headers: upstreamHeaders });

  if (!upstream.ok && upstream.status !== 206) {
    const body = await upstream.text();
    console.log(`[github:file-stream:error] status=${upstream.status} body=${body.slice(0, 200)}`);
    return res
      .status(upstream.status)
      .json({ error: 'GitHub API request failed', status: upstream.status, body: safeJson(body) });
  }

  const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
  const contentRange = upstream.headers.get('content-range');
  const etag = upstream.headers.get('etag');
  const length = upstream.headers.get('content-length');
  console.log(`[github:file-stream:upstream] status=${upstream.status} type=${contentType} range=${contentRange || ''} len=${length || ''}`);

  if (contentRange) res.setHeader('Content-Range', contentRange);
  if (etag) res.setHeader('ETag', etag);
  if (length) res.setHeader('Content-Length', length);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);

  const body = upstream.body;
  if (!body) {
    return res.status(502).json({ error: 'empty response body from GitHub' });
  }

  // Pipe without buffering; Node 18+ exposes Readable.fromWeb
  return Readable.fromWeb(body as unknown as NodeReadableStream).pipe(res);
});

function isFileContentResponse(data: unknown): data is GitHubContentFile {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  return candidate.type === 'file'
    && typeof candidate.content === 'string'
    && typeof candidate.encoding === 'string';
}

// File contents (text) for OWNER/i3-scripts; requires ?filepath=... (alias: ?path=...)
githubRouter.get('/repos/i3-scripts/file', async (req: Request, res: Response) => {
  if (!assertToken(res)) return;

  const rawPath = typeof req.query.filepath === 'string'
    ? req.query.filepath.trim()
    : typeof req.query.path === 'string'
      ? req.query.path.trim()
      : '';
  if (!rawPath) return res.status(400).json({ error: 'filepath is required' });

  // Normalize and sanitize path segments; reject traversal attempts.
  const pathSegments = rawPath.split('/').filter(Boolean);
  if (pathSegments.length === 0) return res.status(400).json({ error: 'filepath is required' });
  if (pathSegments.some((segment) => segment === '..')) return res.status(400).json({ error: 'invalid path segment' });

  // Encode each segment to produce a safe GitHub API path.
  const encodedPath = pathSegments.map(encodeURIComponent).join('/');
  const url = `${GITHUB_API_BASE_URL}/repos/${OWNER}/i3-scripts/contents/${encodedPath}`;
  const ghRes = await fetchWithAuth(url);
  const bodyText = await ghRes.text();

  if (!ghRes.ok) {
    return res
      .status(ghRes.status)
      .json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
  }

  const payload = safeJson(bodyText);
  if (!isFileContentResponse(payload)) {
    return res
      .status(502)
      .json({ error: 'unexpected GitHub response', body: payload });
  }

  if (payload.encoding !== 'base64') {
    return res.status(415).json({ error: `unsupported encoding: ${payload.encoding}` });
  }

  const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
  return res.type('text/plain; charset=utf-8').send(decoded);
});

export default githubRouter;
