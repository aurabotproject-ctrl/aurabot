// One-time migration: moves every base64 image currently stored in the
// database (in cards, card_database, pack_images, home_pinboard) up to
// Cloudflare R2, and rewrites each row's URL column to point at the
// uploaded file instead.
//
// Safe to re-run — anything that's already a real URL (not a base64
// "data:" string) is skipped automatically, so you can run this multiple
// times without re-uploading or breaking anything.
//
// SETUP:
//   1. npm install   (picks up aws4fetch + @supabase/supabase-js if not
//      already installed)
//   2. Create a .env.migration file in the project root (same folder as
//      package.json) with:
//
//        SUPABASE_URL=https://yourproject.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   (Supabase dashboard → Settings → API)
//        R2_ACCOUNT_ID=your-cloudflare-account-id
//        R2_ACCESS_KEY_ID=your-r2-access-key-id
//        R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
//        R2_BUCKET_NAME=your-bucket-name
//        R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev        (no trailing slash)
//
//   3. Run:  node scripts/migrate-images-to-r2.mjs
//
// This only needs to be run ONCE per environment (e.g. once for
// production). It will print a summary of how many images were migrated,
// skipped, or failed for each table.

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.migration manually (no extra dependency needed) ──────────
function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf-8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.error(`Could not read ${path} — make sure you created .env.migration in the project root.`);
    process.exit(1);
  }
}
loadEnvFile(join(__dirname, '..', '.env.migration'));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

const required = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL };
for (const [k, v] of Object.entries(required)) {
  if (!v) { console.error(`Missing ${k} in .env.migration`); process.exit(1); }
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });

async function uploadToR2(dataUrl, folder) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Could not parse data URL');
  const contentType = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  const ext = (contentType.split('/')[1] || 'webp').split('+')[0];
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
  const res = await r2.fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes });
  if (!res.ok) throw new Error(`R2 upload failed: ${await res.text().catch(() => res.statusText)}`);
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

async function migrateTable(table, idCol, urlCol, folder) {
  console.log(`\n— ${table}.${urlCol} —`);
  let migrated = 0, failed = 0, offset = 0;
  const BATCH = 25;

  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(`${idCol}, ${urlCol}`)
      .like(urlCol, 'data:%')
      .range(0, BATCH - 1); // always re-query the front of the remaining base64 rows

    if (error) { console.error(`  Query failed: ${error.message}`); break; }
    if (!data || data.length === 0) break;

    let batchMigrated = 0;
    for (const row of data) {
      const id = row[idCol];
      const dataUrl = row[urlCol];
      try {
        const newUrl = await uploadToR2(dataUrl, folder);
        const { error: updateErr } = await sb.from(table).update({ [urlCol]: newUrl }).eq(idCol, id);
        if (updateErr) throw updateErr;
        migrated++; batchMigrated++;
        process.stdout.write(`\r  Migrated ${migrated}, failed ${failed}…`);
      } catch (err) {
        failed++;
        console.error(`\n  Row ${id} failed: ${err.message}`);
      }
    }

    // If an entire batch failed with zero progress, something systemic is
    // wrong (e.g. bad R2 credentials) — stop instead of retrying forever.
    if (batchMigrated === 0) {
      console.error(`  No progress made on this batch — stopping ${table}.${urlCol} early. Check your R2 credentials and try again.`);
      break;
    }

    offset += data.length;
    // Safety valve in case something is stuck (shouldn't happen since
    // successfully-migrated rows no longer match the 'data:%' filter)
    if (offset > 200000) { console.error('  Stopped after 200,000 rows — check for a stuck loop.'); break; }
  }

  console.log(`\n  Done: ${migrated} migrated, ${failed} failed.`);
  return { migrated, failed };
}

async function main() {
  console.log('Starting image migration to Cloudflare R2…');
  console.log(`Bucket: ${R2_BUCKET_NAME}  →  Public base: ${R2_PUBLIC_URL}`);

  const results = [];
  results.push(await migrateTable('cards', 'id', 'image_url', 'cards'));
  results.push(await migrateTable('card_database', 'id', 'image_url', 'cards'));
  results.push(await migrateTable('pack_images', 'pack_id', 'image_url', 'packs'));
  results.push(await migrateTable('home_pinboard', 'id', 'photo_url', 'pinboard'));

  const totalMigrated = results.reduce((s, r) => s + r.migrated, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  console.log(`\n=== Migration complete: ${totalMigrated} images migrated, ${totalFailed} failed. ===`);
  if (totalFailed > 0) {
    console.log('Re-running this script is safe — it will only retry rows still containing base64 data.');
  }
}

main().catch(err => { console.error('Migration script crashed:', err); process.exit(1); });
