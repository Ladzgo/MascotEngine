import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const POSES = [
  "neutral", "explain_left", "explain_right", "pointing_up", "thinking", "happy", "excited",
  "thumbs_up", "smug", "worried", "shocked", "sweating", "sad", "angry", "confused", "facepalm",
  "counting_money", "holding_sign", "reading", "writing",
];
const W = 1200, H = 1500;
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Decoded { width: number; height: number; alpha: Uint8Array }

function decodePng(buf: Buffer): Decoded {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let off = 8;
  let width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  const idat: Buffer[] = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (!width || !height) throw new Error("missing IHDR");
  if (depth !== 8 || (ctype !== 6 && ctype !== 4) || interlace !== 0) {
    if (ctype !== 6 && ctype !== 4 && depth === 8 && interlace === 0) {
      // no alpha channel: still report size via caller
      return { width, height, alpha: new Uint8Array(0) };
    }
    throw new Error(`unsupported format (depth ${depth}, colortype ${ctype}, interlace ${interlace})`);
  }
  const bpp = ctype === 6 ? 4 : 2;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error("truncated image data");
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      switch (f) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`bad filter ${f}`);
      }
      out[dst + x] = v & 255;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = out[i * bpp + bpp - 1];
  return { width, height, alpha };
}

interface Row {
  file: string;
  size: string;
  alpha: string;
  baseline: number | null;
  cx: number | null;
  errors: string[];
  warns: string[];
}

function analyze(file: string, full: string): Row {
  const row: Row = { file, size: "?", alpha: "?", baseline: null, cx: null, errors: [], warns: [] };
  try {
    const d = decodePng(fs.readFileSync(full));
    row.size = `${d.width}x${d.height}`;
    if (d.width !== W || d.height !== H) row.errors.push(`size ${row.size}, expected ${W}x${H}`);
    if (d.alpha.length === 0) {
      row.alpha = "none";
      row.errors.push("no alpha channel");
      return row;
    }
    let transparent = 0, minX = Infinity, maxX = -1, base = -1;
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const a = d.alpha[y * d.width + x];
        if (a === 0) transparent++;
        if (a > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          base = y;
        }
      }
    }
    if (transparent === 0) {
      row.alpha = "opaque";
      row.errors.push("alpha channel has no transparent pixels");
    } else row.alpha = "ok";
    if (base >= 0) {
      row.baseline = base;
      row.cx = (minX + maxX) / 2;
      if (Math.abs(row.cx - W / 2) > 60) row.warns.push(`off-centre (cx ${row.cx.toFixed(0)})`);
      if (base < H - 1 - 20) row.warns.push(`baseline ${base} not within 20px of bottom`);
    } else row.warns.push("no opaque pixels");
  } catch (e) {
    row.errors.push((e as Error).message);
  }
  return row;
}

function main(): void {
  const dir = path.resolve(process.argv[2] ?? "assets/character");
  if (!fs.existsSync(dir)) {
    console.error(`ERROR: directory not found: ${dir}`);
    process.exit(1);
  }
  console.log(`Checking ${dir}`);
  const missing = POSES.filter((p) => !fs.existsSync(path.join(dir, `${p}.png`)));
  if (missing.length) console.log(`WARN missing poses (${missing.length}): ${missing.join(", ")}`);

  const files: string[] = [];
  for (const p of POSES)
    for (const suffix of ["", "_talk"]) {
      const f = `${p}${suffix}.png`;
      if (fs.existsSync(path.join(dir, f))) files.push(f);
    }
  const rows = files.map((f) => analyze(f, path.join(dir, f)));

  const bases = rows.map((r) => r.baseline).filter((b): b is number => b !== null).sort((a, b) => a - b);
  if (bases.length) {
    const median = bases.length % 2 ? bases[(bases.length - 1) / 2] : (bases[bases.length / 2 - 1] + bases[bases.length / 2]) / 2;
    for (const r of rows)
      if (r.baseline !== null && Math.abs(r.baseline - median) > 12)
        r.warns.push(`baseline ${r.baseline} differs from median ${median}`);
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`${pad("file", 28)}${pad("size", 11)}${pad("alpha", 8)}${pad("base", 6)}${pad("cx", 6)}status`);
  let errCount = 0, warnCount = missing.length ? 1 : 0;
  for (const r of rows) {
    const status = r.errors.length ? "ERROR" : r.warns.length ? "WARN" : "OK";
    console.log(
      `${pad(r.file, 28)}${pad(r.size, 11)}${pad(r.alpha, 8)}${pad(String(r.baseline ?? "-"), 6)}${pad(r.cx === null ? "-" : r.cx.toFixed(0), 6)}${status}`,
    );
    for (const e of r.errors) console.log(`    error: ${e}`);
    for (const w of r.warns) console.log(`    warn: ${w}`);
    errCount += r.errors.length;
    warnCount += r.warns.length;
  }

  const mf = path.join(dir, "manifest.json");
  if (fs.existsSync(mf)) {
    try {
      JSON.parse(fs.readFileSync(mf, "utf8"));
      console.log("manifest.json: valid JSON");
    } catch (e) {
      console.log(`manifest.json: INVALID JSON (${(e as Error).message})`);
      errCount++;
    }
  }
  console.log(`Summary: ${rows.length} files, ${errCount} errors, ${warnCount} warnings`);
  process.exit(errCount > 0 ? 1 : 0);
}

main();
