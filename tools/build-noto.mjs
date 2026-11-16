#!/usr/bin/env node
// Noto animasyonlu emojilerini indirir, dogrular ve noto-animated/ paketini uretir.
// Kullanim: node tools/build-noto.mjs
// Kaynak: https://googlefonts.github.io/noto-emoji-animation/
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { mkdir, writeFile, rm } from 'node:fs/promises'

const API = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json'
const ASSET = code => `https://fonts.gstatic.com/s/e/notoemoji/latest/${code}/lottie.json`
const OUT = 'noto-animated'
// CDN dosyayi sikistirarak gonderir; sinir aktarim boyutunda. Ham boyut ust
// siniri bozuk ya da asiri buyuk dosyaya karsi.
const MAX_RAW_BYTES = 1024 * 1024
const MAX_GZIP_BYTES = 100 * 1024
const CONCURRENCY = 16

const api = await (await fetch(API)).json()
const icons = api.icons.filter(i => !i.unsupported_families?.includes('Animated Emoji'))

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// Lottie dogrulamasi: Tulpar sunucusu kurulumda ayni kurallari uygular.
function validate(code, raw) {
  if (raw.length > MAX_RAW_BYTES) throw new Error(`${code}: ham ${raw.length} bayt, sinir ${MAX_RAW_BYTES}`)
  const gz = gzipSync(raw).length
  if (gz > MAX_GZIP_BYTES) throw new Error(`${code}: gzip ${gz} bayt, sinir ${MAX_GZIP_BYTES}`)
  const json = JSON.parse(raw)
  for (const key of ['v', 'fr', 'ip', 'op', 'layers']) {
    if (!(key in json)) throw new Error(`${code}: '${key}' alani yok`)
  }
  // Expression: 'x' alaninda metin. lottie_light calistirmaz ama paket temiz olmali.
  const stack = [json]
  while (stack.length) {
    const node = stack.pop()
    if (node && typeof node === 'object') {
      if (!Array.isArray(node) && typeof node.x === 'string') throw new Error(`${code}: expression iceriyor`)
      for (const v of Object.values(node)) if (v && typeof v === 'object') stack.push(v)
    }
  }
}

const emojis = {}
const failed = []
let next = 0
async function worker() {
  while (next < icons.length) {
    const icon = icons[next++]
    const code = icon.codepoint
    try {
      const res = await fetch(ASSET(code))
      if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`)
      const raw = await res.text()
      validate(code, raw)
            // Ondalik sayilar 3 basamaga yuvarlanir: gozle fark yok, dosya belirgin kuculur
      // (jsDelivr GitHub deposu boyut siniri icin onemli).
      const min = JSON.stringify(JSON.parse(raw), (_k, v) =>
        typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v)
      const file = `${code}.json`
      await writeFile(`${OUT}/${file}`, min)
      const emoji = String.fromCodePoint(...code.split('_').map(h => parseInt(h, 16)))
      emojis[emoji] = {
        file,
        sha256: createHash('sha256').update(min).digest('hex'),
        tags: icon.tags ?? [],
      }
    }
    catch (err) {
      failed.push(String(err.message ?? err))
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const sorted = Object.fromEntries(Object.entries(emojis).sort(([, a], [, b]) => a.file.localeCompare(b.file)))
const pack = {
  schemaVersion: 1,
  id: 'noto-animated',
  type: 'lottie',
  emojis: sorted,
}
await writeFile(`${OUT}/pack.json`, JSON.stringify(pack, null, 2) + '\n')
console.log(`paket: ${Object.keys(sorted).length} emoji, hata: ${failed.length}`)
for (const f of failed) console.log('  ' + f)
