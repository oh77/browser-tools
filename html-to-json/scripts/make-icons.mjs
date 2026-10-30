// Generates public/icon/{16,32,48,96,128}.png: a blue rounded tile with a white table grid.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(size) {
  const s = 4; // supersampling
  const n = size * s;
  const r = n * 0.18;
  const inset = n * 0.2;
  const line = Math.max(s, Math.round(n * 0.07));
  const inside = (x, y) => {
    const dx = Math.max(r - x, 0, x - (n - 1 - r));
    const dy = Math.max(r - y, 0, y - (n - 1 - r));
    return dx * dx + dy * dy <= r * r;
  };
  const isGrid = (x, y) => {
    if (x < inset || x > n - inset || y < inset || y > n - inset) return false;
    const gx = (x - inset) / (n - 2 * inset);
    const gy = (y - inset) / (n - 2 * inset);
    const near = (v, t) => Math.abs(v - t) * (n - 2 * inset) < line / 2;
    const header = gy < 0.3;
    return [0, 1].some((t) => near(gx, t) || near(gy, t)) || near(gx, 0.5) || near(gy, 0.3) || near(gy, 0.65) || header;
  };
  return png(size, (x, y) => {
    let a = 0, w = 0;
    for (let i = 0; i < s; i++)
      for (let j = 0; j < s; j++) {
        const px = x * s + i, py = y * s + j;
        if (!inside(px, py)) continue;
        a++;
        if (isGrid(px, py)) w++;
      }
    const t = s * s;
    if (!a) return [0, 0, 0, 0];
    const k = w / a;
    const blend = (bg, fg) => Math.round(bg + (fg - bg) * k);
    return [blend(0x1a, 0xff), blend(0x66, 0xff), blend(0xd6, 0xff), Math.round((a / t) * 255)];
  });
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 96, 128]) writeFileSync(`public/icon/${size}.png`, icon(size));
console.log('icons written');
