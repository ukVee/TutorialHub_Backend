import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../server';

let app: import('express').Express;
let httpServer: import('http').Server;
let apolloServer: import('@apollo/server').ApolloServer<any>;

beforeAll(async () => {
  const built = await buildApp();
  app = built.app;
  httpServer = built.httpServer;
  apolloServer = built.apolloServer;
});

afterAll(async () => {
  await apolloServer.stop();
  httpServer.close();
});

describe('GraphQL health query', () => {
  it('returns healthy', async () => {
    const res = await request(app)
      .post('/')
      .send({ query: '{ health }' })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data).toBeDefined();
    expect(res.body.data.health).toBe('healthy');
  });
});
