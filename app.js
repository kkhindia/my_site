/* ==========================================================================
   my_site Client Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const valStatus = document.getElementById('val-status');
  const valPing = document.getElementById('val-ping');
  const valUptime = document.getElementById('val-uptime');
  const valRequests = document.getElementById('val-requests');
  const pingBadge = document.getElementById('ping-badge-status');
  const displayServerUrl = document.getElementById('display-server-url');
  const overlayHost = document.getElementById('overlay-host');
  const portBadge = document.getElementById('port-badge');
  const infoNodeVersion = document.getElementById('info-node-version');
  const infoOsPlatform = document.getElementById('info-os-platform');
  const infoMemory = document.getElementById('info-memory');
  const apiResponseCode = document.getElementById('api-response-code');
  const apiCallTime = document.getElementById('api-call-time');
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');

  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnCopyUrlInline = document.getElementById('btn-copy-url-inline');
  const navCopyBtn = document.getElementById('nav-copy-btn');
  const btnTestPing = document.getElementById('btn-test-ping');
  const btnRunApi = document.getElementById('btn-run-api');

  const apiTabs = document.querySelectorAll('.api-tab');
  const themeDots = document.querySelectorAll('.theme-dot');

  let currentEndpoint = '/api/status';
  let currentMethod = 'GET';
  let serverPort = window.location.port || '3000';
  let currentServerUrl = `${window.location.protocol}//${window.location.hostname}${serverPort ? ':' + serverPort : ''}`;

  // Update URL displays
  if (displayServerUrl) displayServerUrl.textContent = currentServerUrl;
  if (overlayHost) overlayHost.textContent = `${window.location.hostname}:${serverPort}`;
  if (portBadge) portBadge.textContent = `PORT ${serverPort}`;

  // Toast Helper
  let toastTimer = null;
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // Copy to Clipboard
  function copyServerAddress() {
    navigator.clipboard.writeText(currentServerUrl).then(() => {
      showToast(`로컬 서버 주소(${currentServerUrl})가 복사되었습니다!`);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = currentServerUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast(`로컬 서버 주소가 복사되었습니다!`);
    });
  }

  if (btnCopyUrl) btnCopyUrl.addEventListener('click', copyServerAddress);
  if (btnCopyUrlInline) btnCopyUrlInline.addEventListener('click', copyServerAddress);
  if (navCopyBtn) navCopyBtn.addEventListener('click', copyServerAddress);

  // Measure Real Latency / Ping
  async function checkPing() {
    const t0 = performance.now();
    try {
      btnTestPing.disabled = true;
      btnTestPing.textContent = '측정 중...';
      const res = await fetch('/api/status?t=' + Date.now());
      const t1 = performance.now();
      const latency = Math.round(t1 - t0);
      
      valPing.textContent = `${latency} ms`;
      if (latency < 20) {
        pingBadge.textContent = `초저지연 (${latency}ms)`;
        pingBadge.style.color = 'var(--success)';
      } else {
        pingBadge.textContent = `양호 (${latency}ms)`;
      }

      if (res.ok) {
        const data = await res.json();
        updateTelemetry(data);
      }
    } catch (err) {
      valPing.textContent = '오류';
      pingBadge.textContent = '연결 지연';
      pingBadge.style.color = 'var(--danger)';
    } finally {
      btnTestPing.disabled = false;
      btnTestPing.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        핑 재측정
      `;
    }
  }

  if (btnTestPing) btnTestPing.addEventListener('click', checkPing);

  // Update Telemetry Display
  function updateTelemetry(data) {
    if (!data) return;
    if (valStatus) valStatus.textContent = 'ONLINE';
    if (valUptime) valUptime.textContent = data.uptimeFormatted || `${data.uptimeSeconds}s`;
    if (valRequests) valRequests.textContent = data.requestCount || '1';

    if (data.environment) {
      if (infoNodeVersion) infoNodeVersion.textContent = data.environment.nodeVersion || 'Node.js';
      if (infoOsPlatform) infoOsPlatform.textContent = `${data.environment.platform} (${data.environment.arch})`;
      if (infoMemory && data.environment.freeMemMB) {
        infoMemory.textContent = `${data.environment.freeMemMB}MB 가용 / ${data.environment.totalMemMB}MB`;
      }
    }
  }

  // Theme Switcher
  themeDots.forEach(dot => {
    dot.addEventListener('click', () => {
      themeDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const theme = dot.getAttribute('data-pick');
      document.body.setAttribute('data-theme', theme);
      showToast(`${theme.toUpperCase()} 테마가 적용되었습니다.`);
    });
  });

  // API Playground Tabs
  apiTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      apiTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentEndpoint = tab.getAttribute('data-endpoint');
      currentMethod = tab.getAttribute('data-method') || 'GET';
      runApiTest();
    });
  });

  // Execute API Request
  async function runApiTest() {
    apiResponseCode.textContent = `// ${currentMethod} ${currentEndpoint} 요청 실행 중...`;
    const t0 = performance.now();
    try {
      let options = { method: currentMethod };
      if (currentMethod === 'POST') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({
          client: 'my_site_dashboard',
          message: '로컬 서버 에코 테스트 메시지입니다.',
          timestamp: new Date().toISOString()
        });
      }

      const response = await fetch(currentEndpoint, options);
      const data = await response.json();
      const t1 = performance.now();
      const duration = Math.round(t1 - t0);

      apiCallTime.textContent = `응답 시간: ${duration}ms (HTTP ${response.status})`;
      apiResponseCode.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      apiCallTime.textContent = `오류 발생`;
      apiResponseCode.textContent = `// 요청 실패: ${err.message}`;
    }
  }

  if (btnRunApi) btnRunApi.addEventListener('click', runApiTest);

  // Initial load
  checkPing();
  runApiTest();

  // Polling every 5 seconds for telemetry updates
  setInterval(checkPing, 5000);
});
