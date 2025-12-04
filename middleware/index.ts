import type { Request, Response, NextFunction } from 'express';

const DEV_ORIGIN = 'localhost:3000';
const PROD_ORIGIN = 'ukvee.github.io';
const PROD_PATH_PREFIX = '/TutorialHub/';

function getRequester(req: Request) {
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';
  return origin || referer;
}

function isAllowedHost(host: string, isProd: boolean) {
  if (!host) return false;
  try {
    const url = new URL(host.startsWith('http') ? host : `http://${host}`);
    if (isProd) {
      const hostMatch = url.host === PROD_ORIGIN;
      const pathMatch = url.pathname === '/' || url.pathname.startsWith(PROD_PATH_PREFIX);
      return hostMatch && pathMatch;
    }
    return url.host === DEV_ORIGIN;
  } catch {
    return false;
  }
}

export function originGuard(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === 'production';
  const requester = getRequester(req);
  if (!isAllowedHost(requester, isProd)) {
    return res.status(403).json({ error: 'origin not allowed' });
  }
  return next();
}
