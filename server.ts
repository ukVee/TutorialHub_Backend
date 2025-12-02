import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { typeDefs, resolvers } from './schemas';

interface MyContext {
  token?: string;
}

export async function buildApp() {
  const app = express();
  const httpServer = http.createServer(app);

  const apolloServer = new ApolloServer<MyContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await apolloServer.start();

  app.use(
    '/',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ token: req.headers.token }),
    }),
  );

  return { app, httpServer, apolloServer };
}

export async function startServer(port = 4000) {
  const { app, httpServer, apolloServer } = await buildApp();

  await new Promise<void>((resolve) => {
    httpServer.listen({ port }, resolve);
  });

  console.log(`🚀 Server ready at http://localhost:${port}/`);

  return { app, httpServer, apolloServer };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
