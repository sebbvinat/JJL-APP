// Convierte los covers PNG de /public/cursos/covers a WebP (calidad 82,
// ancho máx 1200px) y opcionalmente actualiza cover_url en cursos_courses.
//
//   node scripts/optimize-covers.mjs            → solo convierte (genera .webp)
//   node scripts/optimize-covers.mjs --update-db → además apunta la DB a .webp
//
// Los PNG originales NO se borran (rollback fácil: revertir cover_url).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const COVERS_DIR = new URL('../public/cursos/covers/', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1'); // fix Windows path

const files = readdirSync(COVERS_DIR).filter((f) => f.endsWith('.png'));
console.log(`Covers PNG encontrados: ${files.length}\n`);

let totalBefore = 0, totalAfter = 0;
for (const file of files) {
  const src = join(COVERS_DIR, file);
  const dst = src.replace(/\.png$/, '.webp');
  const before = statSync(src).size;

  await sharp(src)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(dst);

  const after = statSync(dst).size;
  totalBefore += before;
  totalAfter += after;
  const pct = Math.round((1 - after / before) * 100);
  console.log(`  ${file}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB  (-${pct}%)`);
}

console.log(`\nTOTAL: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024).toFixed(0)} KB  (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`);

if (process.argv.includes('--update-db')) {
  const env = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: courses, error } = await sb.from('cursos_courses').select('id, slug, cover_url');
  if (error) { console.error('DB error:', error.message); process.exit(1); }

  let updated = 0;
  for (const c of courses || []) {
    if (!c.cover_url || !c.cover_url.endsWith('.png')) continue;
    const next = c.cover_url.replace(/\.png$/, '.webp');
    const { error: upErr } = await sb.from('cursos_courses').update({ cover_url: next }).eq('id', c.id);
    if (upErr) { console.error(`  ✗ ${c.slug}: ${upErr.message}`); continue; }
    console.log(`  ✓ ${c.slug} → ${next}`);
    updated++;
  }
  console.log(`\nDB actualizada: ${updated} covers apuntan a .webp`);
}
