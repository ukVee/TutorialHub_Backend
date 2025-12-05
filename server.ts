import 'dotenv/config';
import cors from 'cors';
import express from 'express';

import apiRouter from './apiRoutes';
import { originGuard } from './middleware';

const app = express();

app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl} origin=${req.get('origin') || ''}`);
  next();
});

app.use(cors());
app.use(express.json());
app.use(originGuard);

// Mount API router under /api to avoid double-prefix when deployed.
app.use('/api', apiRouter);

// Default export for Vercel serverless.
export default app;

if (require.main === module) {
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => {
    console.log(`🚀 Express server ready at http://localhost:${port}/`);
  });
}
