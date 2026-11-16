# Tulpar emoji packs

Emoji packs that Tulpar servers can install from the admin page. A server reads
`registry.json`, downloads `pack.json` and every asset once to validate them,
and clients then load the assets from jsDelivr pinned to a commit SHA.

## Layout

```
registry.json            catalog of packs and versions; assetBase is the CDN
                         address with {ref} replaced by a version's commit SHA
<pack-id>/pack.json      emoji -> asset file (+ sha256)
<pack-id>/<asset>        Lottie JSON (type "lottie")
tools/                   scripts that build packs
```

## Packs

| Pack | Emoji | Source |
|---|---|---|
| `noto-animated` | animated Noto emoji, Lottie | [Noto Emoji Animation](https://googlefonts.github.io/noto-emoji-animation/) by Google |

Rebuild: `node tools/build-noto.mjs` (needs Node 18+). After pushing a new version,
update `registry.json` with the commit SHA and run `node tools/warm-cdn.mjs` so jsDelivr
has every file cached before servers install it. Files over the size limit
or containing Lottie expressions are left out; Tulpar falls back to the regular
large emoji for those.
