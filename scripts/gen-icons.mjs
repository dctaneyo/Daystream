import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Dependency-free PNG icons for the PWA (no canvas/sharp needed). */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [11, 12, 16];
const ACCENT = [124, 140, 255];

function shade(alpha) {
  return [
    Math.round(BG[0] + (ACCENT[0] - BG[0]) * alpha),
    Math.round(BG[1] + (ACCENT[1] - BG[1]) * alpha),
    Math.round(BG[2] + (ACCENT[2] - BG[2]) * alpha),
  ];
}

function render(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  const safe = maskable ? 0.2 : 0.12;

  const bars = [
    { y: 0.355, w: 0.44, alpha: 1 },
    { y: 0.47, w: 0.31, alpha: 0.82 },
    { y: 0.585, w: 0.19, alpha: 0.62 },
  ];

  const insideRounded = (x, y) => {
    if (radius === 0) return true;
    const r = radius;
    const nearLeft = x < r;
    const nearRight = x > size - r;
    const nearTop = y < r;
    const nearBottom = y > size - r;
    if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
      const cx = nearLeft ? r : size - r;
      const cy = nearTop ? r : size - r;
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    return true;
  };

  const barAt = (nx, ny) => {
    for (const bar of bars) {
      const top = bar.y;
      const bottom = bar.y + 0.0625;
      const left = 0.5 - bar.w / 2;
      const right = 0.5 + bar.w / 2;
      if (ny >= top && ny <= bottom && nx >= left && nx <= right) return bar.alpha;
    }
    return null;
  };

  const samples = 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (!insideRounded(px, py)) continue;
          const nx = (px / size - 0.5) / (1 - safe) + 0.5;
          const ny = (py / size - 0.5) / (1 - safe) + 0.5;
          const bar = barAt(nx, ny);
          const color = bar === null ? BG : shade(bar);
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }
      const total = samples * samples;
      const index = (y * size + x) * 4;
      if (a === 0) continue;
      const covered = a / 255;
      pixels[index] = Math.round(r / covered);
      pixels[index + 1] = Math.round(g / covered);
      pixels[index + 2] = Math.round(b / covered);
      pixels[index + 3] = Math.round((a / total) * 1);
    }
  }

  return encodePng(size, size, pixels);
}

const outDir = path.join(process.cwd(), "public", "icons");
await mkdir(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
];

for (const [name, size, options] of targets) {
  await writeFile(path.join(outDir, name), render(size, options));
  console.log(`[icons] wrote ${name} (${size}x${size})`);
}
