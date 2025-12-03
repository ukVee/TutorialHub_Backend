import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'http';

const OWNER = 'ukVee';
const GITHUB_API_BASE_URL = process.env.GITHUB_API_BASE_URL || 'https://api.github.com';

export function buildApp() {
  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'healthy' });
  });

  api.get('/github/user', async (_req, res) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

    const url = `${GITHUB_API_BASE_URL}/users/${OWNER}`;
    const ghRes = await fetchWithAuth(url, token);
    const bodyText = await ghRes.text();

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
    }

    const data = safeJson(bodyText);
    // Return only useful public stats to the client
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

  api.get('/github/gists', async (_req, res) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

    const url = `${GITHUB_API_BASE_URL}/users/${OWNER}/gists`;
    const ghRes = await fetchWithAuth(url, token);
    const bodyText = await ghRes.text();

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
    }

    return res.json(safeJson(bodyText));
  });

  // Repo contents for OWNER; optional path via query ?path=... inside repo
  api.get('/github/repos/:repo/contents', async (req, res) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

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
    const ghRes = await fetchWithAuth(url, token);
    const bodyText = await ghRes.text();

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: 'GitHub API request failed', status: ghRes.status, body: safeJson(bodyText) });
    }

    return res.json(safeJson(bodyText));
  });

  // Mount API router under /api to avoid double-prefix when deployed.
  app.use('/api', api);

  return { app, httpServer };
}

export async function startServer(port = 4000) {
  const { app, httpServer } = buildApp();

  await new Promise<void>((resolve) => {
    httpServer.listen({ port }, resolve);
  });

  console.log(`🚀 Express server ready at http://localhost:${port}/`);

  return { app, httpServer };
}

async function fetchWithAuth(url: string, token: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'tutorialhub-backend-proxy',
    },
  });
}

function safeJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
