import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function verifyCodecs(root = '.') {
  const manifest = JSON.parse(await readFile(path.join(root, 'vendor/manifest.json'), 'utf8'))
  const notices = await readFile(path.join(root, 'THIRD-PARTY-NOTICES.txt'), 'utf8')
  for (const item of manifest.packages) {
    if (!['MIT', 'BSD-3-Clause'].includes(item.license) || !notices.includes(`${item.name} ${item.version}`) || !item.notices.length) throw new Error(`Missing codec notices: ${item.name}`)
    for (const file of item.notices) if (!manifest.files[file]) throw new Error(`Unaudited codec notice: ${file}`)
  }
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (file.includes('..') || path.isAbsolute(file)) throw new Error('Invalid codec manifest path')
    const bytes = await readFile(path.join(root, 'vendor', file))
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Codec asset changed or license missing: ${file}; regenerate and review vendor assets.`)
  }
  if (root === '.') {
    for (const item of manifest.packages) {
      const installed = JSON.parse(await readFile(path.join('node_modules', item.name, 'package.json'), 'utf8'))
      if (installed.version !== item.version || installed.license !== item.license) throw new Error(`Installed codec version or license changed: ${item.name}; regenerate and review vendor assets.`)
    }
  }
  return manifest
}
