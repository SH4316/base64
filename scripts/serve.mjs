import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, relative, extname, sep } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, fallback) => { const index = args.lastIndexOf(name); return index < 0 ? fallback : args[index + 1] }
const root = resolve(flag('--root', '.'))
const port = Number(flag('--port', process.env.PORT || '5173'))
const host = flag('--host', '127.0.0.1')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' }
const headers = {}
try {
  for (const line of (await readFile(resolve(root, '_headers'), 'utf8')).split('\n')) {
    if (!line.startsWith('  ')) continue
    const colon = line.indexOf(':')
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
} catch { /* Optional Cloudflare headers file. */ }
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return }
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    let file = resolve(root, `.${path}`)
    const rel = relative(root, file)
    if (rel.startsWith(`..${sep}`) || rel === '..') { response.writeHead(403).end(); return }
    try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html') }
    catch { if (!extname(path)) file = resolve(root, 'index.html') }
    const content = await readFile(file)
    response.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found') }
})
server.listen(port, host, () => console.log(`Local: http://${host}:${port}`))
