import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server';

let app: import('express').Express;
let httpServer: import('http').Server;
const originalFetch = global.fetch;

beforeAll(async () => {
  const built = buildApp();
  app = built.app;
  httpServer = built.httpServer;
});

afterAll(async () => {
  if (originalFetch) {
    global.fetch = originalFetch;
  }
  httpServer.close();
});

describe('Express server', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'healthy' });
  });

  it('returns hardcoded user stats for ukVee', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const mockUser = {
      login: 'ukVee',
      name: 'Uk Vee',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      followers: 10,
      following: 5,
      public_repos: 7,
      public_gists: 2,
      html_url: 'https://github.com/ukVee',
      bio: 'Test bio',
      private_field: 'should not leak',
    };

    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toContain('/users/ukVee');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
      });
      return new Response(JSON.stringify(mockUser), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    // @ts-expect-error allow mock
    global.fetch = fetchMock;

    const res = await request(app).get('/api/github/user').expect(200);

    expect(res.body).toEqual({
      login: 'ukVee',
      name: 'Uk Vee',
      avatar_url: mockUser.avatar_url,
      followers: 10,
      following: 5,
      public_repos: 7,
      public_gists: 2,
      html_url: mockUser.html_url,
      bio: mockUser.bio,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns ukVee gists', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const mockGists = [
      { id: '1', description: 'gist1' },
      { id: '2', description: 'gist2' },
    ];

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain('/users/ukVee/gists');
      return new Response(JSON.stringify(mockGists), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    // @ts-expect-error allow mock
    global.fetch = fetchMock;

    const res = await request(app).get('/api/github/gists').expect(200);
    expect(res.body).toEqual(mockGists);
  });

  it('returns repo contents for ukVee repo and path', async () => {
    process.env.GITHUB_TOKEN = 'test-token';

    const mockContent = { name: 'README.md', path: 'README.md', type: 'file' };

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain('/repos/ukVee/demo/contents/src/utils');
      return new Response(JSON.stringify(mockContent), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    // @ts-expect-error allow mock
    global.fetch = fetchMock;

    const res = await request(app).get('/api/github/repos/demo/contents?path=src/utils').expect(200);
    expect(res.body).toEqual(mockContent);
  });

  it('rejects missing token', async () => {
    delete process.env.GITHUB_TOKEN;
    const res = await request(app).get('/api/github/user').expect(500);
    expect(res.body.error).toContain('GITHUB_TOKEN');
  });
});
