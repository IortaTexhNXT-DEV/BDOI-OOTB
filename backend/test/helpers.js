import request from 'supertest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

/** Fresh schema + seed, an app instance and an admin token. Call once per test file (beforeAll). */
export async function setup() {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  return { app, token: r.body.accessToken, api: (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`) };
}
export async function loginAs(app, username, password) {
  const r = await request(app).post('/api/auth/login').send({ username, password });
  return r.body.accessToken;
}
