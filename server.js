const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const INITIAL_PORT = 3000;
const HOST = '127.0.0.1';
const ROOT_DIR = __dirname;
const START_TIME = Date.now();

let requestCount = 0;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function handleApiRequest(req, res, parsedUrl) {
  const method = req.method;
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/status' && method === 'GET') {
    const uptimeSec = (Date.now() - START_TIME) / 1000;
    const data = {
      status: 'online',
      message: '서버가 정상적으로 실행 중입니다.',
      port: currentPort,
      url: `http://${HOST}:${currentPort}`,
      uptimeSeconds: Math.floor(uptimeSec),
      uptimeFormatted: formatUptime(uptimeSec),
      requestCount: requestCount,
      environment: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        hostName: os.hostname(),
        cpus: os.cpus().length,
        freeMemMB: Math.round(os.freemem() / 1024 / 1024),
        totalMemMB: Math.round(os.totalmem() / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data, null, 2));
    return true;
  }

  if (pathname === '/api/routes' && method === 'GET') {
    const routes = [
      { path: '/', method: 'GET', description: '홈페이지 (Dashboard UI)' },
      { path: '/api/status', method: 'GET', description: '서버 상태 및 시스템 메트릭 조회' },
      { path: '/api/routes', method: 'GET', description: '사용 가능한 엔드포인트 목록' },
      { path: '/api/echo', method: 'POST', description: '데이터 에코 테스트 엔드포인트' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ routes }, null, 2));
    return true;
  }

  if (pathname === '/api/echo' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body || '{}');
      } catch (e) {
        parsed = { raw: body };
      }
      const response = {
        message: 'Echo response received successfully',
        receivedData: parsed,
        serverReceivedAt: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(response, null, 2));
    });
    return true;
  }

  return false;
}

let currentPort = INITIAL_PORT;

const server = http.createServer((req, res) => {
  requestCount++;
  const startTime = Date.now();
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // API endpoints check
  if (parsedUrl.pathname.startsWith('/api/')) {
    const handled = handleApiRequest(req, res, parsedUrl);
    if (handled) {
      logRequest(req.method, parsedUrl.pathname, res.statusCode || 200, Date.now() - startTime);
      return;
    }
  }

  // Static file serving
  let requestPath = parsedUrl.pathname;
  if (requestPath === '/' || requestPath === '') {
    requestPath = '/index.html';
  }

  // Prevent path traversal
  const safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="ko">
        <head><meta charset="utf-8"><title>404 Not Found</title></head>
        <body style="background:#0a0d14;color:#f0f4f8;font-family:sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#ef4444;">404 - Not Found</h1>
          <p>요청하신 파일을 찾을 수 없습니다: <code>${escapeHtml(requestPath)}</code></p>
          <a href="/" style="color:#38bdf8;text-decoration:none;">홈으로 돌아가기 &rarr;</a>
        </body>
        </html>
      `);
      logRequest(req.method, requestPath, 404, Date.now() - startTime);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Content-Length': stats.size
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('end', () => {
      logRequest(req.method, requestPath, 200, Date.now() - startTime);
    });
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
    });
  });
});

function logRequest(method, pathname, status, duration) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
  console.log(`[${time}] ${method.padEnd(6)} ${pathname.padEnd(25)} ${statusColor}${status}\x1b[0m ${duration}ms`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function startListening(port) {
  currentPort = port;
  server.listen(port, HOST, () => {
    console.log('\n======================================================');
    console.log(`🚀 [my_site] 로컬 개발 서버가 성공적으로 시작되었습니다!`);
    console.log(`🌐 로컬 주소:      http://${HOST}:${port}`);
    console.log(`📡 네트워크 주소:  http://localhost:${port}`);
    console.log(`📁 작업 디렉터리:  ${ROOT_DIR}`);
    console.log(`⚡ Node.js 버전:   ${process.version}`);
    console.log('======================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ 포트 ${port}번이 이미 사용 중입니다. 다음 포트 ${port + 1}번으로 전환합니다...`);
      startListening(port + 1);
    } else {
      console.error('서버 오류:', err);
    }
  });
}

startListening(INITIAL_PORT);
