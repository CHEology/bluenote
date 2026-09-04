// One-off local importer. Source photos are never modified. No image dependency in CI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function withICC(jpeg, profile) {
  if (!profile) throw new Error('A verified sRGB ICC profile is required.');
  const chunks = [], size = 65519, count = Math.ceil(profile.length / size);
  for (let i = 0; i < count; i++) {
    const part = profile.subarray(i * size, (i + 1) * size);
    const header = Buffer.alloc(18);
    header[0] = 255; header[1] = 226;
    header.writeUInt16BE(part.length + 16, 2);
    header.write('ICC_PROFILE\0', 4, 'ascii');
    header[16] = i + 1; header[17] = count;
    chunks.push(header, part);
  }
  return Buffer.concat([jpeg.subarray(0, 2), ...chunks, jpeg.subarray(2)]);
}

function hasPrivateMetadata(bytes) {
  // jpegtran removes all source APP/COM records; only ICC is restored afterward.
  let offset = 2;
  while (offset < bytes.length && bytes[offset] === 255) {
    const marker = bytes[offset + 1];
    if (marker === 218 || marker === 217) break;
    const length = bytes.readUInt16BE(offset + 2);
    if ([225, 237, 254].includes(marker)) return true;
    offset += length + 2;
  }
  return false;
}

async function run() {
  const input = process.argv[2];
  if (!input || !path.isAbsolute(input)) throw new Error('Usage: node tooling/import-selected-gallery.cjs /absolute/source/directory');
  const sharp = require(process.env.GALLERY_SHARP || 'sharp');
  const jpegtran = process.env.GALLERY_JPEGTRAN || 'jpegtran';
  const root = path.join(__dirname, '..');
  const selection = JSON.parse(fs.readFileSync(path.join(__dirname, 'gallery-selection.json')));
  if (selection.entries.length !== selection.expectedCount || new Set(selection.entries.map(p => p.file)).size !== selection.expectedCount) throw new Error('Incomplete selection.');
  const directory = 'images/selected/2026-09';
  const output = path.join(root, 'source', directory);
  if (fs.existsSync(output)) throw new Error('Destination already exists; refusing to overwrite ' + output);
  // Verify selection and source profile before creating any publication asset.
  for (const photo of selection.entries) {
    if (path.basename(photo.file) !== photo.file) throw new Error('Unsafe source path');
    const file = path.join(input, photo.file);
    const tags = execFileSync('xattr', ['-p', 'com.apple.metadata:_kMDItemUserTags', file]);
    if (!tags.includes(Buffer.from('Red')) && !tags.includes(Buffer.from('Orange'))) throw new Error('Missing Red/Orange selection tag: ' + photo.file);
    const meta = await sharp(file).metadata();
    if (meta.format !== 'jpeg' || (meta.orientation && meta.orientation !== 1) || !meta.icc || !meta.icc.includes(Buffer.from('sRGB'))) throw new Error('Needs explicit orientation/color review: ' + photo.file);
  }
  fs.mkdirSync(output, { recursive: true });
  const manifest = { version: 1, photos: [] };
  let sourceBytes = 0, fullBytes = 0, previewBytes = 0;
  for (const photo of selection.entries) {
    const inputFile = path.join(input, photo.file);
    const source = fs.readFileSync(inputFile);
    const meta = await sharp(source).metadata();
    const fullFile = path.join(output, photo.id + '.jpg');
    const transformed = execFileSync(jpegtran, ['-copy', 'none', '-optimize', '-progressive'], { input: source, maxBuffer: 64 * 1024 * 1024 });
    const full = withICC(transformed, meta.icc);
    if (hasPrivateMetadata(full)) throw new Error('Unexpected private metadata');
    fs.writeFileSync(fullFile, full);
    const hashPixels = async image => crypto.createHash('sha256').update(await sharp(image).raw().toBuffer()).digest('hex');
    const originalHash = await hashPixels(source);
    if (originalHash !== await hashPixels(full)) throw new Error('Decoded pixels changed: ' + photo.file);
    const resultMeta = await sharp(full).metadata();
    if (meta.width !== resultMeta.width || meta.height !== resultMeta.height || !meta.icc.equals(resultMeta.icc)) throw new Error('Dimensions/profile changed: ' + photo.file);
    const entry = {
      id: photo.id, alt: photo.alt, spread: photo.spread,
      ...(photo.sequence ? { sequence: photo.sequence } : {}),
      full: { src: '/' + directory + '/' + photo.id + '.jpg', width: meta.width, height: meta.height },
      previews: []
    };
    for (const edge of [800, 1600, 2880]) {
      const name = photo.id + '-' + edge + '.jpg';
      const image = await sharp(source).resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        .withIccProfile('srgb').jpeg({ quality: 92, progressive: true, chromaSubsampling: '4:4:4' }).toBuffer({ resolveWithObject: true });
      if (hasPrivateMetadata(image.data)) throw new Error('Preview retains private metadata');
      fs.writeFileSync(path.join(output, name), image.data);
      entry.previews.push({ src: '/' + directory + '/' + name, width: image.info.width, height: image.info.height });
      previewBytes += image.data.length;
    }
    manifest.photos.push(entry);
    sourceBytes += source.length; fullBytes += full.length;
    console.log(manifest.photos.length + '/50 ' + photo.id + ': identical decoded pixels, dimensions and ICC; previews prepared');
  }
  // Emit the manifest for apply_patch; do not write repository source configuration here.
  console.log('MANIFEST_START\n' + JSON.stringify(manifest, null, 2) + '\nMANIFEST_END');
  console.log(JSON.stringify({ sourceBytes, fullBytes, previewBytes, totalBytes: fullBytes + previewBytes }));
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { withICC, hasPrivateMetadata };
