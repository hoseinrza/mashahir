// Rasterizes scripts/mashahir-logo.svg into the PWA / Android launcher icon set.
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

// --- Android launcher mipmaps ---
// Legacy square/round PNGs keep the full logo (its own rounded-rect backdrop);
// the adaptive-icon foreground drops the backdrop and expands the viewBox so
// the art fills only the inner 66/108dp safe zone every launcher mask shows.
const foregroundSvg = svg
  .toString('utf8')
  .replace('<rect width="512" height="512" rx="112" fill="url(#bg)"/>', '')
  .replace('viewBox="0 0 512 512"', 'viewBox="-163.2 -163.2 838.4 838.4"');

const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = path.join(androidRes, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await sharp(svg).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(svg).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  console.log('generated', `mipmap-${density}/ic_launcher*.png (${size}px)`);
}
for (const [density, size] of Object.entries(foregroundSizes)) {
  const dir = path.join(androidRes, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await sharp(Buffer.from(foregroundSvg)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  console.log('generated', `mipmap-${density}/ic_launcher_foreground.png (${size}px)`);
}

// --- iOS home-screen icon (AppIcon.appiconset) ---
// iOS masks the corners itself: the backdrop becomes a full-bleed SQUARE
// (rx removed — transparent corners would make Xcode reject the icon) and
// the PNG is flattened opaque. The appiconset references the single
// universal 1024 icon, so this one file covers every home-screen size.
const iosSvg = svg
  .toString('utf8')
  .replace('<rect width="512" height="512" rx="112" fill="url(#bg)"/>', '<rect width="512" height="512" fill="url(#bg)"/>');

const appIconSet = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
await mkdir(appIconSet, { recursive: true });
await sharp(Buffer.from(iosSvg))
  .resize(1024, 1024)
  .flatten({ background: '#173E96' })
  .png()
  .toFile(path.join(appIconSet, 'AppIcon-512@2x.png'));
console.log('generated AppIcon.appiconset/AppIcon-512@2x.png (1024px, full-bleed)');

console.log('icon set complete');
