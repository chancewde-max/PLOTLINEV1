// Self-contained e2e runner: builds the app, serves dist/ on a local port,
// runs the Playwright (Firefox) smoke + auth + nav checks against it, then
// exits non-zero on any failure. Used by `npm run test:e2e`.
//
// Requires: `npx playwright install firefox` (already done in this env).
// Usage: node e2e/run-all.cjs   (or: npm run test:e2e)

const { spawn, spawnSync } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const PORT = 5191
const BASE = `http://127.0.0.1:${PORT}`
const ROOT = path.join(__dirname, '..', 'dist')

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts })
    p.on('exit', (code) => resolve(code ?? 1))
  })
}

function serveDist() {
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon',
  }
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0])
    if (urlPath === '/') urlPath = '/index.html'
    let filePath = path.join(ROOT, urlPath)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (!path.extname(urlPath)) filePath = path.join(ROOT, 'index.html')
    }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return }
      const ext = path.extname(filePath)
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    })
  })
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)))
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((res, rej) => {
        http.get(BASE, (r) => { r.resume(); res() }).on('error', rej)
      })
      return true
    } catch { await new Promise((r) => setTimeout(r, 300)) }
  }
  return false
}

async function main() {
  console.log('▶ Building…')
  const buildCode = await run('npm', ['run', 'build'])
  if (buildCode !== 0) { console.error('build failed'); process.exit(1) }

  console.log(`▶ Serving dist/ on ${BASE}`)
  const server = await serveDist()
  if (!(await waitForServer())) { console.error('server did not start'); server.close(); process.exit(1) }

  const env = { ...process.env, BASE, NODE_OPTIONS: '--max-old-space-size=4096' }
  const suites = [
    ['smoke', 'e2e/smoke.cjs'],
    ['auth', 'e2e/auth-check.cjs'],
    ['nav', 'e2e/nav-check.cjs'],
  ]
  let failed = 0
  for (const [name, file] of suites) {
    console.log(`\n=== e2e: ${name} ===`)
    const code = await run('node', [file], { env, cwd: path.join(__dirname, '..') })
    if (code !== 0) { console.error(`✗ ${name} failed`); failed++ }
    else console.log(`✓ ${name} passed`)
  }

  server.close()
  console.log(failed === 0 ? '\n✅ ALL E2E SUITES PASSED' : `\n❌ ${failed} suite(s) failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
