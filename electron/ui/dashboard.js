document.addEventListener('DOMContentLoaded', async () => {
  const api = window.electronAPI;

  if (!api) {
    console.error('window.electronAPI is undefined!');
    alert('Failed to connect to Electron backend bridge.');
    return;
  }

  // DOM Elements
  const overallBadge = document.getElementById('overall-status-badge');
  const overallText = document.getElementById('overall-status-text');

  const serverStatusVal = document.getElementById('server-status-val');
  const btnToggleServer = document.getElementById('btn-toggle-server');
  const localUrlText = document.getElementById('local-url-text');

  const subdomainInput = document.getElementById('subdomain-input');
  const tokenInput = document.getElementById('token-input');
  const btnToggleTunnel = document.getElementById('btn-toggle-tunnel');
  const tunnelBadge = document.getElementById('tunnel-badge');

  const shareUrlInput = document.getElementById('share-url-input');
  const btnCopyUrl = document.getElementById('btn-copy-url');

  const btnLaunchAppVtt = document.getElementById('btn-launch-app-vtt');
  const btnLaunchBrowserVtt = document.getElementById('btn-launch-browser-vtt');

  const btnOpenDataDir = document.getElementById('btn-open-data-dir');
  const btnBackupCampaign = document.getElementById('btn-backup-campaign');
  const dataPathPreview = document.getElementById('data-path-preview');

  const logTerminal = document.getElementById('log-terminal');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const cfAvailText = document.getElementById('cf-avail-text');

  let currentStatus = null;

  function appendLogLine(logMsg) {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = logMsg;
    logTerminal.appendChild(div);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  function updateUI(status) {
    currentStatus = status;

    // Server state
    if (status.isServerRunning) {
      serverStatusVal.textContent = 'Active (Port 5050)';
      serverStatusVal.style.color = '#34d399';
      btnToggleServer.textContent = 'Stop Server';
      btnToggleServer.className = 'btn btn-secondary';
    } else {
      serverStatusVal.textContent = 'Stopped';
      serverStatusVal.style.color = '#ef4444';
      btnToggleServer.textContent = 'Start Server';
      btnToggleServer.className = 'btn btn-primary';
    }

    localUrlText.textContent = status.localUrl;

    // Tunnel state
    if (status.isTunnelRunning) {
      tunnelBadge.textContent = 'Tunnel Active';
      tunnelBadge.className = 'badge badge-online';
      btnToggleTunnel.innerHTML = '<span class="icon">⏹️</span> Stop Tunnel';
      btnToggleTunnel.className = 'btn btn-secondary';
      shareUrlInput.value = `${status.registeredUrl}/vtt.html`;
    } else {
      tunnelBadge.textContent = 'Tunnel Offline';
      tunnelBadge.className = 'badge badge-accent';
      btnToggleTunnel.innerHTML = '<span class="icon">🚀</span> Start Online Tunnel';
      btnToggleTunnel.className = 'btn btn-accent';
      shareUrlInput.value = `${status.localUrl}/vtt.html`;
    }

    // Overall status badge
    if (status.isTunnelRunning) {
      overallText.textContent = 'Online Hosting Active';
      overallBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      overallBadge.style.color = '#10b981';
    } else if (status.isServerRunning) {
      overallText.textContent = 'Local Server Active';
      overallBadge.style.background = 'rgba(59, 130, 246, 0.15)';
      overallBadge.style.color = '#60a5fa';
    } else {
      overallText.textContent = 'Offline';
      overallBadge.style.background = 'rgba(239, 68, 68, 0.15)';
      overallBadge.style.color = '#f87171';
    }

    if (status.dataDir) {
      dataPathPreview.textContent = status.dataDir;
    }

    if (cfAvailText) {
      cfAvailText.textContent = status.cloudflaredAvailable ? 'Bundled & Ready' : 'System PATH';
    }
  }

  // Initial Data Fetch
  try {
    const initialStatus = await api.getStatus();
    updateUI(initialStatus);

    const initialLogs = await api.getLogs();
    initialLogs.forEach(appendLogLine);
  } catch (err) {
    console.error('Failed to fetch initial status:', err);
  }

  // Real-time Event Subscriptions
  api.onStatusUpdate((status) => {
    updateUI(status);
  });

  api.onLogUpdate((log) => {
    appendLogLine(log);
  });

  // Action Listeners
  btnToggleServer.addEventListener('click', async () => {
    if (currentStatus?.isServerRunning) {
      await api.stopServer();
    } else {
      await api.startServer();
    }
  });

  btnToggleTunnel.addEventListener('click', async () => {
    if (currentStatus?.isTunnelRunning) {
      await api.stopTunnel();
    } else {
      const subdomain = subdomainInput.value.trim();
      const token = tokenInput.value.trim();
      btnToggleTunnel.disabled = true;
      btnToggleTunnel.textContent = 'Connecting...';
      try {
        await api.startTunnel({ subdomain, token });
      } finally {
        btnToggleTunnel.disabled = false;
      }
    }
  });

  btnCopyUrl.addEventListener('click', () => {
    shareUrlInput.select();
    navigator.clipboard.writeText(shareUrlInput.value);
    btnCopyUrl.textContent = '✅ Copied!';
    setTimeout(() => {
      btnCopyUrl.textContent = '📋 Copy Link';
    }, 2000);
  });

  btnLaunchAppVtt.addEventListener('click', () => {
    api.openVttApp();
  });

  btnLaunchBrowserVtt.addEventListener('click', () => {
    api.openVttBrowser(shareUrlInput.value);
  });

  btnOpenDataDir.addEventListener('click', () => {
    api.openDataFolder();
  });

  btnBackupCampaign.addEventListener('click', async () => {
    const res = await api.backupCampaign();
    if (res.success) {
      appendLogLine(`[Backup] Campaign data successfully exported to: ${res.path}`);
    } else if (res.error) {
      appendLogLine(`[Backup Error] ${res.error}`);
    }
  });

  btnClearLogs.addEventListener('click', () => {
    logTerminal.innerHTML = '';
  });
});
