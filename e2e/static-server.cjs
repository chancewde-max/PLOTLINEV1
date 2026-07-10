// Minimal static file server for the dist/ build (no websockets).
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = 'C:\\Users\\Administrator\\PLOTLINEV1\\dist'
const PORT = 5191
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'
  // SPA fallback: serve index.html for non-asset routes
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
server.listen(PORT, '127.0.0.1', () => console.log('static server on ' + PORT))
