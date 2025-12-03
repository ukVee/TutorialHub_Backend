import { buildApp } from '../server';

// Vercel Node/Express handler: export the app, let the platform create the listener.
const { app } = buildApp();

export default app;
