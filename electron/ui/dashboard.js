document.addEventListener('DOMContentLoaded', async () => {
  const api = window.electronAPI;

  if (!api) {
    console.error('window.electronAPI is undefined!');
    alert('Failed to connect to Electron backend bridge.');
    return;
  }

  // --- NAVIGATION TABS ---
  const tabBtns = document.querySelectorAll('.nav-tab');
  const views = document.querySelectorAll('.dashboard-view');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const targetView = document.getElementById(btn.getAttribute('data-target'));
      if (targetView) targetView.classList.add('active');

      // Refresh campaigns if switching to GM dashboard
      if (btn.getAttribute('data-target') === 'view-gm') {
        loadGmCampaigns();
        loadGmCredentials();
      }
    });
  });

  // --- HOSTING & SERVER DOM ELEMENTS ---
  const overallBadge = document.getElementById('overall-status-badge');
  const overallText = document.getElementById('overall-status-text');

  const serverStatusVal = document.getElementById('server-status-val');
  const btnToggleServer = document.getElementById('btn-toggle-server');
  const localUrlText = document.getElementById('local-url-text');

  const modeBtnSubdomain = document.getElementById('mode-btn-subdomain');
  const modeBtnCustom = document.getElementById('mode-btn-custom');
  const subdomainGroup = document.getElementById('subdomain-group');
  const customDomainGroup = document.getElementById('custom-domain-group');
  const subdomainInput = document.getElementById('subdomain-input');
  const customDomainInput = document.getElementById('custom-domain-input');
  const tokenInput = document.getElementById('token-input');
  const btnToggleTunnel = document.getElementById('btn-toggle-tunnel');
  const tunnelBadge = document.getElementById('tunnel-badge');

  const shareUrlInput = document.getElementById('share-url-input');
  const btnCopyUrl = document.getElementById('btn-copy-url');

  const btnLaunchAppVtt = document.getElementById('btn-launch-app-vtt');
  const btnLaunchBrowserVtt = document.getElementById('btn-launch-browser-vtt');

  const dataPathPreview = document.getElementById('data-path-preview');
  const backupsPathPreview = document.getElementById('backups-path-preview');
  const btnChangeDataDir = document.getElementById('btn-change-data-dir');
  const btnOpenDataDir = document.getElementById('btn-open-data-dir');
  const btnChangeBackupsDir = document.getElementById('btn-change-backups-dir');
  const btnOpenBackupsDir = document.getElementById('btn-open-backups-dir');
  const btnBackupCampaign = document.getElementById('btn-backup-campaign');

  const logTerminal = document.getElementById('log-terminal');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const cfAvailText = document.getElementById('cf-avail-text');

  // --- GM DASHBOARD DOM ELEMENTS ---
  const gmUsernameInput = document.getElementById('gm-username-input');
  const gmPasswordInput = document.getElementById('gm-password-input');
  const btnTogglePwVisibility = document.getElementById('btn-toggle-pw-visibility');
  const btnSaveGmCreds = document.getElementById('btn-save-gm-creds');
  const gmCredStatusBadge = document.getElementById('gm-cred-status-badge');

  const btnGmNewCampaign = document.getElementById('btn-gm-new-campaign');
  const btnRefreshCampaigns = document.getElementById('btn-refresh-campaigns');
  const gmCampaignList = document.getElementById('gm-campaign-list');

  const editorCampHeading = document.getElementById('editor-camp-heading');
  const editorCampIdDisplay = document.getElementById('editor-camp-id-display');
  const editorCampName = document.getElementById('editor-camp-name');
  const editorCampDesc = document.getElementById('editor-camp-desc');
  const editorNewPlayerName = document.getElementById('editor-new-player-name');
  const btnAddAllowlistPlayer = document.getElementById('btn-add-allowlist-player');
  const editorAllowlistPills = document.getElementById('editor-allowlist-pills');
  const statMapsCount = document.getElementById('stat-maps-count');
  const statPlayersCount = document.getElementById('stat-players-count');
  const btnSaveCampaignDetails = document.getElementById('btn-save-campaign-details');
  const btnDeleteCampaign = document.getElementById('btn-delete-campaign');

  // Modal elements
  const modalCreateCampaign = document.getElementById('modal-create-campaign');
  const btnCreateModalClose = document.getElementById('btn-create-modal-close');
  const btnCreateModalCancel = document.getElementById('btn-create-modal-cancel');
  const btnCreateModalSubmit = document.getElementById('btn-create-modal-submit');
  const newCampNameInput = document.getElementById('new-camp-name-input');
  const newCampDescInput = document.getElementById('new-camp-desc-input');

  let currentStatus = null;
  let activeHostingMode = 'forgedvtt'; // 'forgedvtt' | 'custom'
  let currentCampaigns = [];
  let selectedCampaign = null;
  let currentAllowlist = [];

  function appendLogLine(logMsg) {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = logMsg;
    logTerminal.appendChild(div);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  // --- HOSTING MODE CONTROLS ---
  function setHostingMode(mode) {
    activeHostingMode = mode;
    if (mode === 'custom') {
      modeBtnCustom.classList.add('active');
      modeBtnSubdomain.classList.remove('active');
      customDomainGroup.classList.remove('vtt-hidden');
      subdomainGroup.classList.add('vtt-hidden');
    } else {
      modeBtnSubdomain.classList.add('active');
      modeBtnCustom.classList.remove('active');
      subdomainGroup.classList.remove('vtt-hidden');
      customDomainGroup.classList.add('vtt-hidden');
    }
    updateShareLinkDisplay();
  }

  modeBtnSubdomain.addEventListener('click', () => setHostingMode('forgedvtt'));
  modeBtnCustom.addEventListener('click', () => setHostingMode('custom'));

  function updateShareLinkDisplay() {
    if (!currentStatus) return;
    if (currentStatus.isTunnelRunning) {
      shareUrlInput.value = `${currentStatus.registeredUrl}/vtt.html`;
    } else {
      if (activeHostingMode === 'custom' && customDomainInput.value.trim()) {
        const dom = customDomainInput.value.trim().replace(/^https?:\/\//i, '');
        shareUrlInput.value = `https://${dom}/vtt.html`;
      } else {
        shareUrlInput.value = `${currentStatus.localUrl}/vtt.html`;
      }
    }
  }

  // --- STATUS SYNC ---
  function updateUI(status) {
    currentStatus = status;

    // Server state
    if (status.isServerRunning) {
      serverStatusVal.textContent = `Active (${status.port || 5050})`;
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
      updateShareLinkDisplay();
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

    // Paths
    if (status.dataDir) {
      dataPathPreview.textContent = status.dataDir;
      dataPathPreview.title = status.dataDir;
    }
    if (status.backupsDir) {
      backupsPathPreview.textContent = status.backupsDir;
      backupsPathPreview.title = status.backupsDir;
    }

    // Domain preferences
    if (status.subdomain && !subdomainInput.value) {
      subdomainInput.value = status.subdomain;
    }
    if (status.customDomain && !customDomainInput.value) {
      customDomainInput.value = status.customDomain;
    }
    if (status.tunnelToken && !tokenInput.value) {
      tokenInput.value = status.tunnelToken;
    }
    if (status.hostingMode && status.hostingMode !== activeHostingMode) {
      setHostingMode(status.hostingMode);
    }

    if (cfAvailText) {
      cfAvailText.textContent = status.cloudflaredAvailable ? 'Bundled & Ready' : 'System PATH';
    }

    // Update GM badge
    updateGmBadge(status.gmUsername, status.hasGmPassword);
  }

  function updateGmBadge(username, hasPassword) {
    if (username) {
      if (hasPassword) {
        gmCredStatusBadge.textContent = `Active: ${username} (Protected)`;
        gmCredStatusBadge.className = 'badge badge-online';
      } else {
        gmCredStatusBadge.textContent = `Active: ${username} (No Password)`;
        gmCredStatusBadge.className = 'badge badge-accent';
      }
    } else {
      gmCredStatusBadge.textContent = 'No GM Credentials Set';
      gmCredStatusBadge.className = 'badge';
    }
  }

  // --- GM CREDENTIALS LOGIC ---
  async function loadGmCredentials() {
    try {
      const creds = await api.getGmCredentials();
      if (creds) {
        if (creds.username) gmUsernameInput.value = creds.username;
        updateGmBadge(creds.username, creds.hasPassword);
      }
    } catch (e) {
      console.warn('Could not load GM credentials:', e);
    }
  }

  btnTogglePwVisibility.addEventListener('click', () => {
    if (gmPasswordInput.type === 'password') {
      gmPasswordInput.type = 'text';
      btnTogglePwVisibility.textContent = '🔒';
    } else {
      gmPasswordInput.type = 'password';
      btnTogglePwVisibility.textContent = '👁️';
    }
  });

  btnSaveGmCreds.addEventListener('click', async () => {
    const username = gmUsernameInput.value.trim();
    const password = gmPasswordInput.value;

    if (!username) {
      alert('Please enter a GM Username.');
      return;
    }

    btnSaveGmCreds.disabled = true;
    btnSaveGmCreds.textContent = 'Saving...';
    try {
      const res = await api.setGmCredentials({ username, password });
      if (res.success) {
        appendLogLine(`[GM Security] Saved master GM credentials for "${username}".`);
        updateGmBadge(res.username, res.hasPassword);
        gmPasswordInput.value = '';
        alert('GM Tabletop Credentials saved successfully!');
      } else {
        alert(`Error saving credentials: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btnSaveGmCreds.disabled = false;
      btnSaveGmCreds.textContent = '💾 Save Credentials';
    }
  });

  // --- GM CAMPAIGNS MANAGEMENT ---
  async function loadGmCampaigns() {
    gmCampaignList.innerHTML = '<div class="loading-placeholder">Loading campaigns...</div>';
    try {
      const res = await api.gmGetCampaigns();
      if (res.success && res.campaigns) {
        currentCampaigns = res.campaigns;
        renderCampaignList();
        if (currentCampaigns.length > 0) {
          // Keep current selection or select first
          const toSelect = selectedCampaign ? currentCampaigns.find(c => c.id === selectedCampaign.id) || currentCampaigns[0] : currentCampaigns[0];
          selectCampaign(toSelect);
        } else {
          clearCampaignEditor();
        }
      }
    } catch (err) {
      gmCampaignList.innerHTML = `<div class="loading-placeholder" style="color:var(--danger)">Failed to load campaigns: ${err.message}</div>`;
    }
  }

  function renderCampaignList() {
    gmCampaignList.innerHTML = '';
    if (currentCampaigns.length === 0) {
      gmCampaignList.innerHTML = '<div class="loading-placeholder">No campaigns found. Create one!</div>';
      return;
    }

    currentCampaigns.forEach(c => {
      const item = document.createElement('div');
      item.className = 'campaign-item' + (selectedCampaign && selectedCampaign.id === c.id ? ' active' : '');
      item.innerHTML = `
        <span class="camp-item-name">${c.name || 'Untitled Campaign'}</span>
        <span class="camp-item-meta">ID: ${c.id} • ${c.mapsCount || 1} maps</span>
      `;
      item.addEventListener('click', () => selectCampaign(c));
      gmCampaignList.appendChild(item);
    });
  }

  function selectCampaign(c) {
    selectedCampaign = c;
    renderCampaignList();

    editorCampHeading.textContent = c.name || 'Untitled Campaign';
    editorCampIdDisplay.textContent = `ID: ${c.id}`;
    editorCampName.value = c.name || '';
    editorCampDesc.value = c.description || '';

    currentAllowlist = Array.isArray(c.allowedUsers) ? [...c.allowedUsers] : [];
    renderAllowlistPills();

    statMapsCount.textContent = c.mapsCount || 1;
    statPlayersCount.textContent = c.playersCount || (c.knownPlayers ? c.knownPlayers.length : 0);
  }

  function clearCampaignEditor() {
    selectedCampaign = null;
    editorCampHeading.textContent = 'No Campaign Selected';
    editorCampIdDisplay.textContent = '';
    editorCampName.value = '';
    editorCampDesc.value = '';
    currentAllowlist = [];
    renderAllowlistPills();
    statMapsCount.textContent = '0';
    statPlayersCount.textContent = '0';
  }

  function renderAllowlistPills() {
    editorAllowlistPills.innerHTML = '';
    if (currentAllowlist.length === 0) {
      editorAllowlistPills.innerHTML = '<span class="allowlist-empty-note">Allowlist is empty. Anyone can join as Player.</span>';
      return;
    }

    currentAllowlist.forEach((user, idx) => {
      const pill = document.createElement('span');
      pill.className = 'allowlist-pill';
      pill.innerHTML = `
        <span>${user}</span>
        <span class="allowlist-pill-remove" title="Remove">&times;</span>
      `;
      pill.querySelector('.allowlist-pill-remove').addEventListener('click', () => {
        currentAllowlist.splice(idx, 1);
        renderAllowlistPills();
      });
      editorAllowlistPills.appendChild(pill);
    });
  }

  btnAddAllowlistPlayer.addEventListener('click', () => {
    const val = editorNewPlayerName.value.trim();
    if (!val) return;
    if (!currentAllowlist.includes(val)) {
      currentAllowlist.push(val);
      renderAllowlistPills();
    }
    editorNewPlayerName.value = '';
  });

  editorNewPlayerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnAddAllowlistPlayer.click();
    }
  });

  btnSaveCampaignDetails.addEventListener('click', async () => {
    if (!selectedCampaign) return;
    const name = editorCampName.value.trim();
    if (!name) {
      alert('Campaign name cannot be empty.');
      return;
    }

    btnSaveCampaignDetails.disabled = true;
    btnSaveCampaignDetails.textContent = 'Saving...';

    try {
      const updatedData = {
        id: selectedCampaign.id,
        name,
        description: editorCampDesc.value.trim(),
        allowedUsers: currentAllowlist
      };

      const res = await api.gmSaveCampaign(updatedData);
      if (res.success) {
        selectedCampaign.name = name;
        selectedCampaign.description = updatedData.description;
        selectedCampaign.allowedUsers = currentAllowlist;
        editorCampHeading.textContent = name;
        renderCampaignList();
        appendLogLine(`[Campaigns] Updated campaign "${name}" (${selectedCampaign.id}).`);
        alert('Campaign details saved successfully!');
      } else {
        alert(`Failed to save: ${res.error}`);
      }
    } catch (e) {
      alert(`Error saving: ${e.message}`);
    } finally {
      btnSaveCampaignDetails.disabled = false;
      btnSaveCampaignDetails.textContent = '💾 Save Campaign Details';
    }
  });

  btnDeleteCampaign.addEventListener('click', async () => {
    if (!selectedCampaign) return;
    if (!confirm(`Are you sure you want to delete campaign "${selectedCampaign.name}"?\nThis action cannot be undone.`)) {
      return;
    }

    btnDeleteCampaign.disabled = true;
    try {
      const res = await api.gmDeleteCampaign(selectedCampaign.id);
      if (res.success) {
        appendLogLine(`[Campaigns] Deleted campaign: ${selectedCampaign.id}`);
        await loadGmCampaigns();
      } else {
        alert(`Failed to delete: ${res.error}`);
      }
    } catch (e) {
      alert(`Error deleting campaign: ${e.message}`);
    } finally {
      btnDeleteCampaign.disabled = false;
    }
  });

  btnRefreshCampaigns.addEventListener('click', () => {
    loadGmCampaigns();
  });

  // Modal Create Campaign
  btnGmNewCampaign.addEventListener('click', () => {
    newCampNameInput.value = '';
    newCampDescInput.value = '';
    modalCreateCampaign.classList.remove('vtt-hidden');
    newCampNameInput.focus();
  });

  btnCreateModalClose.addEventListener('click', () => {
    modalCreateCampaign.classList.add('vtt-hidden');
  });

  btnCreateModalCancel.addEventListener('click', () => {
    modalCreateCampaign.classList.add('vtt-hidden');
  });

  btnCreateModalSubmit.addEventListener('click', async () => {
    const name = newCampNameInput.value.trim();
    if (!name) {
      alert('Please enter a campaign name.');
      return;
    }

    btnCreateModalSubmit.disabled = true;
    btnCreateModalSubmit.textContent = 'Creating...';

    try {
      const res = await api.gmCreateCampaign({
        name,
        description: newCampDescInput.value.trim(),
        allowedUsers: []
      });

      if (res.success && res.campaign) {
        modalCreateCampaign.classList.add('vtt-hidden');
        appendLogLine(`[Campaigns] Created new campaign: "${name}" (${res.campaign.id})`);
        await loadGmCampaigns();
        // Select the newly created campaign
        const created = currentCampaigns.find(c => c.id === res.campaign.id);
        if (created) selectCampaign(created);
      } else {
        alert(`Error creating campaign: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      btnCreateModalSubmit.disabled = false;
      btnCreateModalSubmit.textContent = 'Create Campaign';
    }
  });

  // --- INITIAL DATA FETCH ---
  try {
    const initialStatus = await api.getStatus();
    updateUI(initialStatus);

    const initialLogs = await api.getLogs();
    initialLogs.forEach(appendLogLine);

    await loadGmCredentials();
  } catch (err) {
    console.error('Failed to fetch initial status:', err);
  }

  // --- REAL-TIME EVENT SUBSCRIPTIONS ---
  api.onStatusUpdate((status) => {
    updateUI(status);
  });

  api.onLogUpdate((log) => {
    appendLogLine(log);
  });

  // --- ACTION LISTENERS ---
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
      const customDomain = customDomainInput.value.trim();
      const token = tokenInput.value.trim();
      btnToggleTunnel.disabled = true;
      btnToggleTunnel.textContent = 'Connecting...';
      try {
        await api.startTunnel({
          mode: activeHostingMode,
          subdomain,
          customDomain,
          token
        });
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

  // Folders handlers
  btnOpenDataDir.addEventListener('click', () => {
    api.openDataFolder();
  });

  btnOpenBackupsDir.addEventListener('click', () => {
    api.openBackupsFolder();
  });

  btnChangeDataDir.addEventListener('click', async () => {
    const res = await api.selectDataFolder();
    if (res.success) {
      dataPathPreview.textContent = res.path;
      appendLogLine(`[Folders] Active Campaign Data folder changed to: ${res.path}${res.imported ? ' (Existing data copied)' : ''}`);
      if (document.getElementById('view-gm').classList.contains('active')) {
        loadGmCampaigns();
      }
    }
  });

  btnChangeBackupsDir.addEventListener('click', async () => {
    const res = await api.selectBackupsFolder();
    if (res.success) {
      backupsPathPreview.textContent = res.path;
      appendLogLine(`[Folders] Backups destination folder changed to: ${res.path}`);
    }
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
