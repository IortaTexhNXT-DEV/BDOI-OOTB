/**
 * Build an importable brand pack (.brandpack.zip) from a brand pack folder: theme.json plus the image files it names.
 * The zip is what Master > System Settings > Theme and Branding > Import brand pack takes.
 *
 *   node scripts/build-brand-pack.js ../docs/package/04_Onboarding_and_Go_Live/Brand_Packs/toyota-insurance-services
 *
 * The theme is checked first (same rules as the screen: hex colours, the font list, WCAG AA contrast), so a pack that
 * the application would refuse is never built.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from '../src/lib/zip.js';
import { validateTheme } from '../src/modules/branding/service.js';

export function buildBrandPack(folder) {
  const dir = path.resolve(folder);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
  if (manifest.format !== 'brokerverse-brand-pack') throw new Error('theme.json must have "format": "brokerverse-brand-pack"');
  const { errors, warnings } = validateTheme(manifest.theme);
  if (errors.length) throw new Error(`The theme is not valid:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
  const names = [...new Set(Object.values(manifest.assets || {}).filter(Boolean))];
  const files = [{ name: 'theme.json', data: fs.readFileSync(path.join(dir, 'theme.json')) },
    ...names.map((n) => ({ name: n, data: fs.readFileSync(path.join(dir, n)) }))];
  if (fs.existsSync(path.join(dir, 'README.md'))) files.push({ name: 'README.md', data: fs.readFileSync(path.join(dir, 'README.md')) });
  const slug = String(manifest.name || path.basename(dir)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const out = path.join(dir, `${slug}.brandpack.zip`);
  // a fixed date keeps the zip byte-identical between builds
  fs.writeFileSync(out, createZip(files, new Date('2026-10-01T00:00:00Z')));
  return { out, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  if (!folder) {
    console.error('Usage: node scripts/build-brand-pack.js <brand pack folder>');
    process.exit(1);
  }
  try {
    const { out, warnings } = buildBrandPack(folder);
    for (const w of warnings) console.warn(`warning: ${w.path}: ${w.message}`);
    console.log(`written ${out}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
