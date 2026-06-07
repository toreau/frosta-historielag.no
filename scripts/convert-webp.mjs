import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

const IMG_DIR = "public/images";
const QUALITY = 82;

async function main() {
  const files = await readdir(IMG_DIR);
  const images = files.filter((f) => {
    const ext = extname(f).toLowerCase();
    return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
  });

  let converted = 0;
  let skipped = 0;
  let saved = 0;

  for (const file of images) {
    const input = join(IMG_DIR, file);
    const output = input.replace(/\.(jpg|jpeg|png)$/i, ".webp");

    const inputStat = await stat(input);

    try {
      const outStat = await stat(output);
      if (outStat.mtime >= inputStat.mtime) {
        skipped++;
        continue;
      }
    } catch {
      // output doesn't exist yet, proceed with conversion
    }

    const inputSize = inputStat.size;
    await sharp(input).webp({ quality: QUALITY }).toFile(output);

    const outputStat = await stat(output);
    const pct = Math.round((1 - outputStat.size / inputSize) * 100);
    saved += inputSize - outputStat.size;
    converted++;

    console.log(`${file} → ${outputStat.size}B (${pct}% smaller)`);
  }

  const savedMB = (saved / (1024 * 1024)).toFixed(1);
  console.log(`\nConverted ${converted}, skipped ${skipped}. Saved ${savedMB} MB.`);

  const WIDTHS = [480, 960, 1440];
  let resized = 0;
  let resizeSkipped = 0;

  for (const file of images) {
    const webpFile = file.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const webpPath = join(IMG_DIR, webpFile);

    let sourceWidth;
    try {
      const meta = await sharp(webpPath).metadata();
      sourceWidth = meta.width;
    } catch {
      continue;
    }
    if (!sourceWidth) continue;

    for (const w of WIDTHS) {
      const target = Math.min(w, sourceWidth);
      const variant = webpPath.replace(/\.webp$/, `-${w}w.webp`);

      try {
        const outStat = await stat(variant);
        const inStat = await stat(webpPath);
        if (outStat.mtime >= inStat.mtime) {
          resizeSkipped++;
          continue;
        }
      } catch {
        // variant doesn't exist yet
      }

      await sharp(webpPath).resize(target).webp({ quality: QUALITY }).toFile(variant);
      resized++;
    }
  }

  if (resized > 0) {
    console.log(`Responsive: generated ${resized} variants, skipped ${resizeSkipped}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
