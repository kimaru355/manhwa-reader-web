// One-off: npx tsx --env-file=.env.local scripts/seed.mts <recommendations.json>
import { readFileSync } from 'node:fs';
import { listRecs, parseImport, replaceAll } from '../lib/db';

const file = process.argv[2];
if (!file) throw new Error('Pass the path to a recommendations.json');
const existing = await listRecs();
if (existing.length && !process.argv.includes('--force')) {
  throw new Error(`Table already has ${existing.length} rows. Pass --force to replace them.`);
}
const { recs, sources } = parseImport(readFileSync(file, 'utf8'));
await replaceAll(recs, sources);
console.log(`Seeded ${recs.length} recommendations.`);
