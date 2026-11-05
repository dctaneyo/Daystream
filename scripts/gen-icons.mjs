import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(here, "..", "public", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, crc]);
}

function encodePng(size, draw) {
  const pixels = Buffer.alloc(size * size * 4);
  const plot = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
    pixels[offset + 3] = a;
  };
  draw(plot);

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let row = 0; row < size; row += 1) {
    raw[row * stride] = 0; // no filter
    pixels.copy(raw, row * stride + 1, row * size * 4, (row + 1) * size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/*
 * The mark is the product: a hairline spine, three ruled lines, one accent dot.
 * It is drawn from pixels so the repo carries no icon dependency and the icons
 * stay reproducible from `npm run icons`.
 */
function art(size, padding) {
  return (plot) => {
    const paper = [249, 248, 246];
    const ink = [26, 26, 24];
    const rule = [201, 198, 192];
    const accent = [74, 93, 78];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) plot(x, y, ...paper);
    }

    const inset = size * padding;
    const inner = size - inset * 2;
    const spineX = Math.round(inset + inner * 0.34);
    const spineWidth = Math.max(2, Math.round(size * 0.012));
    const top = Math.round(inset + inner * 0.16);
    const bottom = Math.round(inset + inner * 0.84);
    const lineWidth = Math.max(1, Math.round(size * 0.009));

    for (let y = top; y <= bottom; y += 1) {
      for (let x = spineX; x < spineX + spineWidth; x += 1) plot(x, y, ...ink);
    }

    [0.3, 0.5, 0.7].forEach((ratio, index) => {
      const y = Math.round(inset + inner * ratio);
      const start = Math.round(inset + inner * 0.46);
      const end = Math.round(inset + inner * (index === 1 ? 0.76 : 0.88));
      for (let line = 0; line < lineWidth; line += 1) {
        for (let x = start; x < end; x += 1) plot(x, y + line, ...rule);
      }
    });

    const cx = spineX + spineWidth / 2;
    const cy = inset + inner * 0.5;
    const radius = size * (padding > 0.18 ? 0.05 : 0.056);
    for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) plot(x, y, ...accent);
      }
    }
  };
}

await mkdir(outputDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, padding: 0.12 },
  { file: "icon-512.png", size: 512, padding: 0.12 },
  { file: "icon-maskable-512.png", size: 512, padding: 0.22 },
  { file: "apple-touch-icon.png", size: 180, padding: 0.12 },
];

for (const target of targets) {
  const png = encodePng(target.size, art(target.size, target.padding));
  await writeFile(path.join(outputDir, target.file), png);
}

console.log(`[icons] wrote ${targets.length} icons to public/icons`);
