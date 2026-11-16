#!/usr/bin/env node
// Yeni bir surum yayinlandiktan sonra calistir: paketteki her dosyayi jsDelivr'den
// bir kez ister. jsDelivr dosyayi GitHub'dan ilk kez cekerken kisa sure 404/503
// verebiliyor; isitilmis dosyalar sonra hep hazir.
// Kullanim: node tools/warm-cdn.mjs [pack-id]   (varsayilan: registry'deki tum paketler)
import { readFile } from 'node:fs/promises'

const registry = JSON.parse(await readFile('registry.json', 'utf8'))
const only = process.argv[2]
const CONCURRENCY = 32

for (const pack of registry.packs.filter(p => !only || p.id === only)) {
  const version = pack.versions.find(v => v.version === pack.latest)
  const dir = version.path.replace(/\/pack\.json$/, '')
  const base = registry.assetBase.replace('{ref}', version.ref) + dir + '/'
  const manifest = JSON.parse(await readFile(`${dir}/pack.json`, 'utf8'))
  let pending = [...new Set(Object.values(manifest.emojis).map(e => e.file)), 'pack.json']

  for (let round = 1; round <= 4 && pending.length; round++) {
    const failed = []
    let i = 0
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (i < pending.length) {
        const file = pending[i++]
        const res = await fetch(base + file).catch(() => null)
        if (!res || res.status !== 200) failed.push(file)
        else await res.arrayBuffer()
      }
    }))
    console.log(`${pack.id} tur ${round}: ${pending.length - failed.length}/${pending.length} hazir`)
    pending = failed
    if (pending.length) await new Promise(r => setTimeout(r, 3000))
  }
  if (pending.length) {
    console.error(`${pack.id}: hazir olmayan ${pending.length} dosya: ${pending.slice(0, 10).join(', ')}`)
    process.exitCode = 1
  }
}
