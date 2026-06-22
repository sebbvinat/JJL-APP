// Diagnostico: que meta_keys hay en wp_usermeta y, si no aparece phone alli,
// busca billing_phone en wp_postmeta (ordenes de WooCommerce).

import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const SQL_PATH = 'C:/Users/sebas/Downloads/u863922915_re2q1.sql';

const usermetaKeys = new Map();
const postmetaKeys = new Map();
const samplesByKey = new Map();
const tupleRe = new RegExp(
  "\\((\\d+),(\\d+),'([^']*)','((?:[^'\\\\]|\\\\.)*)'\\)",
  'g'
);

const stream = createReadStream(SQL_PATH, { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

let line_n = 0;
for await (const line of rl) {
  line_n++;
  const isUsermeta = line.startsWith('INSERT INTO `wp_usermeta`');
  const isPostmeta = line.startsWith('INSERT INTO `wp_postmeta`');
  if (!isUsermeta && !isPostmeta) continue;

  tupleRe.lastIndex = 0;
  let m;
  while ((m = tupleRe.exec(line)) !== null) {
    const key = m[3];
    const val = m[4];
    const bucket = isUsermeta ? usermetaKeys : postmetaKeys;
    bucket.set(key, (bucket.get(key) || 0) + 1);
    if (key.includes('phone') || key.includes('telef') || key.includes('mobile')) {
      if (!samplesByKey.has(key)) samplesByKey.set(key, []);
      const arr = samplesByKey.get(key);
      if (arr.length < 3) arr.push({ where: isUsermeta ? 'usermeta' : 'postmeta', user_or_post_id: m[2], val });
    }
  }
}

const topUsermeta = [...usermetaKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('=== top 30 wp_usermeta meta_keys ===');
topUsermeta.forEach(([k, c]) => console.log(`  ${c.toString().padStart(6)}  ${k}`));

const phoneKeys = [...usermetaKeys.entries()].filter(([k]) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('telef') || k.toLowerCase().includes('mobile'));
console.log(`\n=== wp_usermeta keys con "phone/telef/mobile": ${phoneKeys.length} ===`);
phoneKeys.forEach(([k, c]) => console.log(`  ${c}  ${k}`));

const phonePostKeys = [...postmetaKeys.entries()].filter(([k]) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('telef') || k.toLowerCase().includes('mobile'));
console.log(`\n=== wp_postmeta keys con "phone/telef/mobile": ${phonePostKeys.length} ===`);
phonePostKeys.slice(0, 20).forEach(([k, c]) => console.log(`  ${c}  ${k}`));

console.log(`\n=== samples ===`);
for (const [k, arr] of samplesByKey) {
  console.log(`  ${k} (${arr[0]?.where}):`);
  arr.forEach((s) => console.log(`    [${s.user_or_post_id}] ${s.val}`));
}
