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
  let saved = 0;

  for (const file of images) {
    const input = join(IMG_DIR, file);
    const output = input.replace(/\.(jpg|jpeg|png)$/i, ".webp");

    const inputStat = await stat(input);
    const inputSize = inputStat.size;

    await sharp(input).webp({ quality: QUALITY }).toFile(output);

    const outputStat = await stat(output);
    const pct = Math.round((1 - outputStat.size / inputSize) * 100);
    saved += inputSize - outputStat.size;
    converted++;

    console.log(`${file} → ${outputStat.size}B (${pct}% smaller)`);
  }

  const savedMB = (saved / (1024 * 1024)).toFixed(1);
  console.log(`\nConverted ${converted} images. Saved ${savedMB} MB.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
