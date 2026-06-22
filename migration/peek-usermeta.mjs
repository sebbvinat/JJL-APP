// Imprime el inicio del primer INSERT INTO wp_usermeta para ver el formato real.
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
const stream = createReadStream('C:/Users/sebas/Downloads/u863922915_re2q1.sql', { encoding: 'utf8' });
const rl = createInterface({ input: stream, crlfDelay: Infinity });
let count = 0;
for await (const line of rl) {
  if (!line.startsWith('INSERT INTO `wp_usermeta`')) continue;
  console.log(`--- usermeta line ${++count} (len=${line.length}) ---`);
  console.log(line.slice(0, 2000));
  console.log('...');
  console.log(line.slice(-500));
  console.log();
  if (count >= 3) break;
}
