import { buildApp } from '../server';

// Catch-all Vercel function for /api/* paths. Vercel provides the listener.
const { app } = buildApp();

export default app;
