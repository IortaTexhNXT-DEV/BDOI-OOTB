/**
 * Signed-in users of the rehearsal. On TARGET the persona users come from the configuration workbook (no password in
 * it): the first sign-in uses the temporary password the load returned once, and sets PERSONA_PASSWORD.
 */
import { Session, ApiError, dataOf, listOf } from '../uat/http.js';

/** Sign a persona in on TARGET (temporary password of the load, PERSONA_PASSWORD, or a reset by the administrator). */
export async function persona(ctx, username) {
  const t = ctx.tgt;
  if (t.personas[username]?.token) return t.personas[username];
  const s = new Session(t.api, username);
  const temp = t.temporaryPasswords[username];
  const pw = ctx.cfg.personaPassword;
  try {
    if (temp) {
      await s.login(temp, { newPassword: pw });
      delete t.temporaryPasswords[username];
    } else await s.login(pw);
  } catch (e) {
    if (!(e instanceof ApiError) || ![401, 409].includes(e.status)) throw e;
    // the persona exists with another password: the administrator resets it (temporary password, changed at sign-in)
    const u = listOf(await t.admin.get('/users', { search: username, perPage: 5 })).find((x) => x.username === username);
    if (!u) throw new Error(`User ${username} is not on TARGET`);
    const r = dataOf(await t.admin.post(`/users/${u.userId || u.id}/reset-password`, {}));
    ctx.log.hide(r.temporaryPassword);
    await s.login(r.temporaryPassword, { newPassword: pw });
  }
  s.userId = s.user?.userId || s.user?.id;
  t.personas[username] = s;
  return s;
}

/** Sign the administrators of both environments in again (after the reset removed the sign-in sessions of TARGET). */
export async function signInAdmins(ctx) {
  await ctx.src.admin.login(ctx.cfg.sourcePassword);
  await ctx.tgt.admin.login(ctx.cfg.targetPassword);
}

/** Forget TARGET persona sessions (the reset removes every sign-in session). */
export function dropPersonaSessions(ctx) {
  ctx.tgt.personas = {};
}
