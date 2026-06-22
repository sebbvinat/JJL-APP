// Inspecciona wp_wc_order_addresses (formato HPOS de WooCommerce).
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const stream = createReadStream('C:/Users/sebas/Downloads/u863922915_re2q1.sql', { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

let capture = false;
let buf = [];
let createStmt = null;
let inserts = 0;

for await (const line of rl) {
  if (line.startsWith('CREATE TABLE `wp_wc_order_addresses`')) {
    capture = true; buf = [line]; continue;
  }
  if (capture) {
    buf.push(line);
    if (line.includes(';')) { capture = false; createStmt = buf.join('\n'); }
  }
  if (line.startsWith('INSERT INTO `wp_wc_order_addresses`')) inserts++;
}
console.log('=== CREATE TABLE wp_wc_order_addresses ===');
console.log(createStmt);
console.log(`\nINSERT INTO wp_wc_order_addresses (header lines): ${inserts}`);

// Mostrar primeras 5 tuples
const stream2 = createReadStream('C:/Users/sebas/Downloads/u863922915_re2q1.sql', { encoding: 'utf8' });
const rl2 = createInterface({ input: stream2, crlfDelay: Infinity });
let mode = null; let shown = 0;
for await (const line of rl2) {
  if (line.startsWith('INSERT INTO `wp_wc_order_addresses`')) { mode = true; continue; }
  if (!mode) continue;
  if (!line.startsWith('(')) { mode = false; continue; }
  console.log(line.slice(0, 600));
  shown++;
  if (shown >= 5) break;
}
