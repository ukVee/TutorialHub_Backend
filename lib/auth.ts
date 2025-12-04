import type { Response } from 'express';

export const OWNER = 'ukVee';
export const GITHUB_API_BASE_URL = process.env.GITHUB_API_BASE_URL || 'https://api.github.com';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const USER_AGENT = 'tutorialhub-backend-proxy';

export function assertToken(res: Response): string | undefined {
  if (!GITHUB_TOKEN) {
    res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
    return undefined;
  }
  return GITHUB_TOKEN;
}

export async function fetchWithAuth(url: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    },
  });
}
