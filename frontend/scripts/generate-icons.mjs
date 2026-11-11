// Rasterizes scripts/mashahir-logo.svg into the PWA / iOS / Capacitor icon set.
// Usage: node scripts/generate-icons.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = await readFile(path.join(root, 'scripts', 'mashahir-logo.svg'));

// Maskable icons need ~10% clear zone per side; the art must sit inside the
// safe zone, so scale it down and center it on a full-bleed gradient square.
const maskableSvg = svg
  .toString('utf8')
  .replace('viewBox="0 0 512 512"', 'viewBox="-51.2 -51.2 614.4 614.4"');

await mkdir(path.join(root, 'public', 'icons'), { recursive: true });

const jobs = [
  { file: 'favicon.svg', input: svg },
  { file: 'apple-touch-icon.png', input: svg, size: 180 },
  { file: 'pwa-192x192.png', input: svg, size: 192 },
  { file: 'pwa-512x512.png', input: svg, size: 512 },
  { file: 'pwa-maskable-512x512.png', input: Buffer.from(maskableSvg), size: 512 },
];

for (const job of jobs) {
  const target = path.join(root, 'public', 'icons', job.file);
  if (job.file.endsWith('.svg')) {
    await writeFile(target, job.input);
    continue;
  }
  await sharp(job.input).resize(job.size, job.size).png().toFile(target);
  console.log('generated', job.file);
}
console.log('icon set complete');
