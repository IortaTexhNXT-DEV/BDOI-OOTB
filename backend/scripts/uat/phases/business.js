/** The business of the scenario, phase by phase (each phase records its own steps). */
import { goLive } from './golive.js';
import { retail } from './retail.js';
import { corporate } from './corporate.js';
import { compliance } from './compliance.js';
import { billing } from './billing.js';
import { servicing } from './servicing.js';
import { money } from './money.js';
import { reconciliation } from './reconciliation.js';
import { monthEnd } from './monthend.js';
import { extras } from './extras.js';

export async function runBusiness(ctx) {
  await goLive(ctx);
  await retail(ctx);
  await corporate(ctx);
  await compliance(ctx);
  await billing(ctx);
  await servicing(ctx);
  await money(ctx);
  await extras(ctx);
  await reconciliation(ctx);
  await monthEnd(ctx);
}
