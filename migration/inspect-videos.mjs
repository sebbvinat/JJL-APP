// Estadística de fuentes de video en las lecciones target.
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('migration/extracted.json', 'utf8'));

const TARGET_COURSE_IDS = new Set([26595, 26701, 26702, 28433, 28557, 28643, 28692, 29023]);

const metaByPost = new Map();
for (const m of data.postmeta) {
  if (!metaByPost.has(m.post_id)) metaByPost.set(m.post_id, []);
  metaByPost.get(m.post_id).push(m);
}

const topicIds = new Set(
  data.posts.filter((p) => p.post_type === 'topics' && TARGET_COURSE_IDS.has(p.post_parent)).map((t) => t.ID)
);
const lessons = data.posts.filter((p) => p.post_type === 'lesson' && topicIds.has(p.post_parent));

const re = (key) => new RegExp(`s:\\d+:"${key}";s:\\d+:"([^"]*)"`);

const counts = {};
const samples = {};
let youtubeIds = 0,
  mp4Urls = 0,
  externalUrls = 0,
  empty = 0;

for (const lesson of lessons) {
  const meta = metaByPost.get(lesson.ID) ?? [];
  const v = meta.find((m) => m.meta_key === '_video');
  if (!v) {
    counts.no_meta = (counts.no_meta ?? 0) + 1;
    continue;
  }
  const val = v.meta_value;
  const source = (val.match(re('source')) ?? [])[1] ?? 'unknown';
  counts[source] = (counts[source] ?? 0) + 1;
  if (!samples[source]) {
    const yt = (val.match(re('source_youtube')) ?? [])[1] ?? '';
    const html5 = (val.match(re('source_html5')) ?? [])[1] ?? '';
    const ext = (val.match(re('source_external_url')) ?? [])[1] ?? '';
    samples[source] = {
      lesson: lesson.post_title,
      youtube: yt,
      html5,
      external: ext,
    };
  }
  // Categorizar por presencia
  const yt = (val.match(re('source_youtube')) ?? [])[1] ?? '';
  const html5 = (val.match(re('source_html5')) ?? [])[1] ?? '';
  const ext = (val.match(re('source_external_url')) ?? [])[1] ?? '';
  if (yt) youtubeIds++;
  else if (html5) mp4Urls++;
  else if (ext) externalUrls++;
  else empty++;
}

console.log(`Total lecciones target: ${lessons.length}`);
console.log(`\nPor campo "source" en _video:`);
for (const [k, c] of Object.entries(counts)) console.log(`  ${k}: ${c}`);
console.log(`\nPor URL presente:`);
console.log(`  con source_youtube (YouTube ID): ${youtubeIds}`);
console.log(`  con source_html5 (MP4 en WP):    ${mp4Urls}`);
console.log(`  con source_external_url:         ${externalUrls}`);
console.log(`  sin nada (vacío):                ${empty}`);

console.log(`\nSamples por source type:`);
for (const [k, s] of Object.entries(samples)) {
  console.log(`  [${k}] "${s.lesson}"`);
  if (s.youtube) console.log(`    youtube: ${s.youtube}`);
  if (s.html5) console.log(`    html5:   ${s.html5}`);
  if (s.external) console.log(`    ext:     ${s.external}`);
}
