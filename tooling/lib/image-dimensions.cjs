const { readFileSync } = require('node:fs');

function imageDimensions(path) {
  const data = readFileSync(path);
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < data.length) {
    if (data[offset] !== 0xff) return null;
    while (data[offset + 1] === 0xff) offset += 1;
    const marker = data[offset + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (offset + 4 > data.length) return null;
    const length = data.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > data.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return null;
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

module.exports = { imageDimensions };
