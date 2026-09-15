/**
 * One-off: pull the sponsor logo files supplied by the team into
 * public/sponsors/ at web size. Trims the transparent (or white) margins so
 * each mark fills its tile, and caps the longest edge at 800px — the tiles
 * are at most ~200px wide, so anything larger is wasted bandwidth.
 *
 *   node scripts/prepare-sponsor-logos.mjs [source-dir]
 *
 * Re-run whenever the team hands over a new or updated logo. Uses the sharp
 * that Next.js already installs, so there is nothing extra to add.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = process.argv[2] ?? 'D:/SKILLCETERA/TEDX/Logo'
const out = path.join(here, '..', 'public', 'sponsors')

/** Source file per sponsor — the variant each brand supplies for a light
 *  background, since the section is white. Goodblend's colour version has a
 *  white wordmark, so its black on-light variant is used instead. */
const LOGOS = [
  {slug: 'net-corp', file: 'drive-download-20260915T152333Z-1-001/NET CORP TÁCH NỀN-01.png'},
  {slug: 'onto', file: 'Logo.jpg'},
  {slug: 'goodblend', file: 'GoodBlend/[GB]Logo-Vertical-Black-100.jpg'},
  {slug: 'thalic-voice', file: '[TEDxFPTU26 x Thalic Voice] Logo.png'},
  {slug: 'cake', file: 'drive-download-20260915T152726Z-1-001/Cake logo_Primary.png'},
  {slug: 'okkas', file: 'drive-download-20260915T073547Z-1-001/SECONDARY LOGO-1.png'},
  {
    slug: 'banh-mi-que-chip',
    file: '1788057233257_5469819456633239129_g9010483744290874298_6bfbfeb1d8d62ac8e2ea36e680677b4c.jpg',
    // The JPG has a stray dark speck in its top-left corner. Trim treats it
    // as part of the artwork and stretches the bounding box up to it, which
    // leaves the actual mark sitting low and right of centre. Cut the corner
    // off before trimming.
    inset: {top: 0.05, left: 0.03},
  },
  {slug: 'diep-truong-phat', file: 'DTP_Logo ( Xoá nền )-18.png'},
]

fs.mkdirSync(out, {recursive: true})

for (const {slug, file, inset} of LOGOS) {
  const input = path.join(src, file)
  const output = path.join(out, `${slug}.webp`)

  let image = sharp(input).rotate() // no-arg rotate applies EXIF orientation

  // Optional fractional crop from the top/left, for sources with an artefact
  // in a corner that would otherwise fool the trim. Done as its own pass:
  // sharp runs trim before a pre-resize extract whatever order they are
  // called in, so chaining them would crop an already-trimmed image.
  if (inset) {
    const {data, info} = await image.toBuffer({resolveWithObject: true})
    const left = Math.round(info.width * (inset.left ?? 0))
    const top = Math.round(info.height * (inset.top ?? 0))
    const cropped = await sharp(data)
      .extract({left, top, width: info.width - left, height: info.height - top})
      .toBuffer()
    image = sharp(cropped)
  }

  // WebP keeps the alpha channel and lands far smaller than PNG on the
  // gradient-heavy marks, which is what matters at tile size.
  const info = await image
    .trim({threshold: 12})
    .resize({width: 800, height: 800, fit: 'inside', withoutEnlargement: true})
    .webp({quality: 90, alphaQuality: 100, effort: 6})
    .toFile(output)
  const kb = Math.round(fs.statSync(output).size / 1024)
  console.log(`${slug.padEnd(20)} ${String(info.width).padStart(4)}x${String(info.height).padEnd(4)} ${String(kb).padStart(4)}KB  <- ${file}`)
}
