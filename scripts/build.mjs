import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { cp, mkdir, rm, access } from 'node:fs/promises'
import { verifyCodecs } from './verify-codecs.mjs'

await access('index.html')
await verifyCodecs()
await rm('dist', { recursive: true, force: true })
await mkdir('dist')
for (const path of ['index.html', 'styles.css', 'app.js', 'converter.worker.js', 'lib', 'vendor', 'assets', '_headers', 'LICENSE', 'THIRD-PARTY-NOTICES.txt']) {
  await cp(path, `dist/${path}`, { recursive: true })
}
console.log('Static HTML, CSS, and JavaScript copied to dist/. No bundler required.')

if (await readFile('dist/LICENSE', 'utf8') !== await readFile('LICENSE', 'utf8')) throw new Error('The distributed MIT License does not match the source.')
console.log('Verified MIT License is included in dist/.')

// Keep the exact reviewed font and its redistribution notices in every deployment.
for (const root of ['.', 'dist']) {
  const font = await readFile(root + '/assets/fonts/ibm-plex-sans.woff2')
  if (createHash('sha256').update(font).digest('hex') !== 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470') throw new Error('IBM Plex Sans changed: review its version and license before updating the checksum.')
  const license = await readFile(root + '/assets/licenses/IBMPlexSans-OFL.txt', 'utf8')
  const notices = await readFile(root + '/THIRD-PARTY-NOTICES.txt', 'utf8')
  if (!license.includes('Copyright 2019 IBM Corp.') || !license.includes('SIL OPEN FONT LICENSE Version 1.1') || !notices.includes('e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470')) throw new Error('Required IBM Plex Sans notices are missing.')
}
console.log('Verified IBM Plex Sans checksum and redistribution notices.')
await verifyCodecs('dist')
console.log('Verified offline codec versions, checksums, and all direct/transitive redistribution notices.')
