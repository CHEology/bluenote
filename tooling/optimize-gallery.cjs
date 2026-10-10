// Generate a separate publication tree from an untouched Gallery source backup.
// Sharp is a local preparation dependency; the site build does not need it.
const fs = require('node:fs');
const path = require('node:path');
const { hasPrivateMetadata } = require('./import-selected-gallery.cjs');
const isSrgb = profile => profile && (profile.includes(Buffer.from('sRGB')) ||
  profile.includes(Buffer.from([0, 115, 0, 82, 0, 71, 0, 66])));

async function run() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || !path.isAbsolute(input) || !path.isAbsolute(output)) {
    throw new Error('Usage: node tooling/optimize-gallery.cjs /original/source /new/output');
  }
  if (fs.existsSync(output)) throw new Error('Output must be a new directory.');
  const sharp = require(process.env.GALLERY_SHARP || 'sharp');
  const manifest = JSON.parse(fs.readFileSync(path.join(input, '_data/gallery.json')));
  const { validateGallery } = require('./lib/gallery.cjs');
  validateGallery(manifest, input);
  const report = { quality: 90, chromaSubsampling: '4:4:4', fullEdge: 3840, before: 0, after: 0, files: [] };
  for (const photo of manifest.photos) {
    // Every size is encoded directly from the original full-resolution file.
    const original = fs.readFileSync(path.join(input, photo.full.src));
    const originalMeta = await sharp(original).metadata();
    if (!isSrgb(originalMeta.icc) ||
        (originalMeta.orientation && originalMeta.orientation !== 1)) {
      throw new Error('Source requires color/orientation review: ' + photo.id);
    }
    for (const [index, image] of [photo.full, ...photo.previews].entries()) {
      const previous = fs.readFileSync(path.join(input, image.src));
      const edge = index === 0 ? 3840 : Math.max(image.width, image.height);
      const encoded = await sharp(original).resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        .withIccProfile('srgb').jpeg({ quality: 90, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
        .toBuffer();
      // Already-small JPEGs should not grow or lose quality through re-encoding.
      const keptExisting = encoded.length >= previous.length;
      const bytes = keptExisting ? previous : encoded;
      const meta = await sharp(bytes).metadata();
      if (hasPrivateMetadata(bytes) || !isSrgb(meta.icc) ||
          Math.min(Math.abs(meta.height - originalMeta.height * meta.width / originalMeta.width),
            Math.abs(meta.width - originalMeta.width * meta.height / originalMeta.height)) > 2) {
        throw new Error('Metadata/framing check failed: ' + image.src);
      }
      image.width = meta.width;
      image.height = meta.height;
      const target = path.join(output, image.src);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      report.before += previous.length;
      report.after += bytes.length;
      report.files.push({ src: image.src, before: previous.length, after: bytes.length, width: meta.width, height: meta.height, keptExisting });
    }
    console.log('Prepared ' + photo.id);
  }
  validateGallery(manifest, output);
  fs.mkdirSync(path.join(output, '_data'), { recursive: true });
  fs.writeFileSync(path.join(output, '_data/gallery.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'compression-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ beforeMiB: report.before / 1048576, afterMiB: report.after / 1048576,
    savedPercent: 100 * (1 - report.after / report.before), keptExisting: report.files.filter(f => f.keptExisting).length }));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
