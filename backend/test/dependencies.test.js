/** Upgraded dependencies: node-cron 4 and nodemailer 10 keep the behaviour the scheduler and mailer rely on. */
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import cron from 'node-cron';
import nodemailer from 'nodemailer';

describe('dependency upgrades', () => {
  it('node-cron 4 validates every seeded job schedule and schedules / stops tasks', () => {
    const jobs = JSON.parse(fs.readFileSync(new URL('../src/db/seeds/jobs.json', import.meta.url), 'utf8'));
    for (const j of jobs) expect(cron.validate(j.cron), `${j.code}: ${j.cron}`).toBe(true);
    expect(cron.validate('not a cron')).toBe(false);
    const task = cron.schedule('0 3 * * *', () => {});
    expect(typeof task.stop).toBe('function');
    task.stop();
  });

  it('nodemailer 10 builds a transport from a URL and sends through a stream transport', async () => {
    expect(typeof nodemailer.createTransport('smtp://user:secret@localhost:2525').sendMail).toBe('function');
    const t = nodemailer.createTransport({ jsonTransport: true });
    const info = await t.sendMail({ from: 'no-reply@example.ph', to: 'a@example.ph', subject: 'Test', html: '<p>Hi</p>' });
    expect(JSON.parse(info.message)).toMatchObject({ subject: 'Test', to: [{ address: 'a@example.ph' }] });
  });
});
