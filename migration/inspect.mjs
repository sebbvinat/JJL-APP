// Inspecciona extracted.json: lista cursos y bundles para identificar
// cuáles son sueltos vs del programa, y muestra una lección con su meta
// para entender qué claves usar al importar.

import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('migration/extracted.json', 'utf8'));

const byId = new Map(data.posts.map((p) => [p.ID, p]));
const metaByPost = new Map();
for (const m of data.postmeta) {
  if (!metaByPost.has(m.post_id)) metaByPost.set(m.post_id, []);
  metaByPost.get(m.post_id).push(m);
}

const courses = data.posts.filter((p) => p.post_type === 'courses');
const bundles = data.posts.filter((p) => p.post_type === 'course-bundle');

console.log(`\n=== CURSOS (${courses.length}) ===`);
for (const c of courses) {
  const topicCount = data.posts.filter(
    (p) => p.post_type === 'topics' && p.post_parent === c.ID
  ).length;
  const topicIds = new Set(
    data.posts.filter((p) => p.post_type === 'topics' && p.post_parent === c.ID).map((t) => t.ID)
  );
  const lessonCount = data.posts.filter(
    (p) => p.post_type === 'lesson' && topicIds.has(p.post_parent)
  ).length;
  console.log(
    `  [${c.ID}] ${c.post_status.padEnd(8)} "${c.post_title}" → ${topicCount} secciones, ${lessonCount} lecciones · /${c.post_name}`
  );
}

console.log(`\n=== BUNDLES (${bundles.length}) ===`);
for (const b of bundles) {
  const meta = metaByPost.get(b.ID) ?? [];
  const bundleCourses = meta.find((m) => m.meta_key === 'bundle-course-ids');
  console.log(`  [${b.ID}] ${b.post_status.padEnd(8)} "${b.post_title}" · /${b.post_name}`);
  if (bundleCourses) console.log(`        bundle-course-ids = ${bundleCourses.meta_value}`);
}

// Muestra una lección de Front Headlock con sus meta keys
const fh = courses.find((c) => /front.?headlock/i.test(c.post_title));
if (fh) {
  console.log(`\n=== SAMPLE: Front Headlock (id=${fh.ID}) ===`);
  const topics = data.posts.filter((p) => p.post_type === 'topics' && p.post_parent === fh.ID);
  console.log(`  Secciones: ${topics.length}`);
  for (const t of topics.slice(0, 3)) {
    const lessons = data.posts.filter((p) => p.post_type === 'lesson' && p.post_parent === t.ID);
    console.log(`    - "${t.post_title}" (${lessons.length} lecciones)`);
  }
  // Una lección con sus meta
  const someTopic = topics[0];
  if (someTopic) {
    const oneLesson = data.posts.find((p) => p.post_type === 'lesson' && p.post_parent === someTopic.ID);
    if (oneLesson) {
      console.log(`\n  Sample lesson [${oneLesson.ID}] "${oneLesson.post_title}":`);
      console.log(`    post_content (primeros 200 chars): ${(oneLesson.post_content ?? '').slice(0, 200)}`);
      const meta = metaByPost.get(oneLesson.ID) ?? [];
      console.log(`    meta keys: ${meta.map((m) => m.meta_key).join(', ')}`);
      const video = meta.find((m) => m.meta_key === '_video');
      if (video) {
        console.log(`    _video (primeros 300 chars):\n      ${video.meta_value.slice(0, 300)}`);
      }
    }
  }
  // course meta
  const courseMeta = metaByPost.get(fh.ID) ?? [];
  console.log(`\n  Course meta keys: ${courseMeta.map((m) => m.meta_key).join(', ')}`);
  const price = courseMeta.find((m) => m.meta_key === 'tutor_course_price' || m.meta_key === '_price');
  if (price) console.log(`    price meta: ${price.meta_key} = ${price.meta_value}`);
}

console.log(`\n=== USUARIOS (${data.users.length}) ===  primeros 5:`);
data.users.slice(0, 5).forEach((u) => console.log(`  [${u.ID}] ${u.user_email} · ${u.display_name}`));
console.log(`\n=== ENROLLMENTS (${data.posts.filter((p) => p.post_type === 'tutor_enrolled').length}) ===`);
