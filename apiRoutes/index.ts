import { Router } from 'express';

import githubRouter from './github';

const api = Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

api.use('/github', githubRouter);

export default api;
