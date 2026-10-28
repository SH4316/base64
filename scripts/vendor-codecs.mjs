import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdir, rm, readdir, readFile, writeFile, cp } from 'node:fs/promises'
import path from 'node:path'

const directory = 'vendor'
await rm(directory, { recursive: true, force: true })
await mkdir(`${directory}/licenses`, { recursive: true })
const result = await build({
  stdin: {
    contents: "import iconv from 'iconv-lite'; import chardet from 'chardet'; import { Buffer } from 'buffer'; export { iconv, Buffer }; export const analyse = chardet.analyse;",
    resolveDir: process.cwd(),
  },
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  minify: true, legalComments: 'linked', metafile: true,
  outfile: `${directory}/codecs.js`,
  banner: { js: '/* Offline browser codecs. Upstream versions, licenses and complete notices: ./manifest.json and ./licenses/. */' },
})
const packageRoots = [...new Set(Object.keys(result.metafile.inputs).map(input => input.match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0]).filter(Boolean))].sort()
const packages = []
for (const root of packageRoots) {
  const metadata = JSON.parse(await readFile(`${root}/package.json`, 'utf8'))
  if (!['MIT', 'BSD-3-Clause'].includes(metadata.license)) throw new Error(`Review unexpected codec license: ${metadata.name}: ${metadata.license}`)
  const notices = (await readdir(root)).filter(name => /^(?:licen[cs]e|notice|copying|authors|third[-_ ]party[-_ ]notices)(?:[._-].*)?$/i.test(name)).sort()
  if (!notices.some(name => /^licen[cs]e(?:[._-]|$)/i.test(name))) throw new Error(`Missing codec license: ${metadata.name}`)
  const files = []
  for (const name of notices) {
    const destination = `licenses/${metadata.name.replaceAll('/', '-')}-${name}`
    await cp(path.join(root, name), `${directory}/${destination}`)
    files.push(destination)
  }
  packages.push({ name: metadata.name, version: metadata.version, license: metadata.license, notices: files })
}
const files = ['codecs.js', ...packages.flatMap(pkg => pkg.notices)]
try { await readFile(`${directory}/codecs.js.LEGAL.txt`); files.push('codecs.js.LEGAL.txt') } catch (error) { if (error.code !== 'ENOENT') throw error }
const hashes = Object.fromEntries(await Promise.all(files.sort().map(async file => [file, createHash('sha256').update(await readFile(`${directory}/${file}`)).digest('hex')])))
await writeFile(`${directory}/manifest.json`, JSON.stringify({ packages, buildTool: { name: 'esbuild', version: JSON.parse(await readFile('node_modules/esbuild/package.json', 'utf8')).version, license: 'MIT', shipped: false }, files: hashes }, null, 2) + '\n')
console.log(`Vendored offline codecs and full permissive license notices for ${packages.length} runtime packages.`)
