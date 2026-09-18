import {
  calcAbilityModifier,
  createBlankEntity,
  entityToJson,
  jsonToEntity
} from './builder-schemas.js';

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

      // Refresh sources if switching to Sources dashboard
      if (btn.getAttribute('data-target') === 'view-sources') {
        loadCampaignsForSourceScope();
        loadAllSources();
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

  const dismissCreateCampaignModal = (force = false) => {
    if (modalCreateCampaign.classList.contains('vtt-hidden')) return;
    const isDirty = (newCampNameInput.value.trim() !== '' || newCampDescInput.value.trim() !== '');
    if (!force && isDirty) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    modalCreateCampaign.classList.add('vtt-hidden');
  };

  modalCreateCampaign.addEventListener('click', (e) => {
    if (e.target === modalCreateCampaign) {
      dismissCreateCampaignModal(false);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (!modalCreateCampaign.classList.contains('vtt-hidden')) {
        dismissCreateCampaignModal(false);
      }
    }
  });

  btnCreateModalClose.addEventListener('click', () => {
    dismissCreateCampaignModal(false);
  });

  btnCreateModalCancel.addEventListener('click', () => {
    dismissCreateCampaignModal(false);
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

  // =========================================================================
  // DATABASE SOURCES & HOMEBREW DASHBOARD LOGIC
  // =========================================================================
  const btnRefreshSources = document.getElementById('btn-refresh-sources');
  const sourcesCampaignScope = document.getElementById('sources-campaign-scope');
  const sourcesPresetSelect = document.getElementById('sources-preset-select');
  const btnApplyPreset = document.getElementById('btn-apply-preset');
  const sourcesStatusFilter = document.getElementById('sources-status-filter');
  const sourcesSearchInput = document.getElementById('sources-search-input');
  const btnClearSourceSearch = document.getElementById('btn-clear-source-search');
  const btnExpandAllCats = document.getElementById('btn-expand-all-cats');
  const btnCollapseAllCats = document.getElementById('btn-collapse-all-cats');
  const statTotalSources = document.getElementById('stat-total-sources');
  const statEnabledSources = document.getElementById('stat-enabled-sources');
  const statCustomSources = document.getElementById('stat-custom-sources');
  const sourcesCategoriesAccordion = document.getElementById('sources-categories-accordion');

  // Edit Source Modal & Visual Studio
  const modalEditSource = document.getElementById('modal-edit-source');
  const modalEditSourceTitle = document.getElementById('modal-edit-source-title');
  const modalEditSourceBadge = document.getElementById('modal-edit-source-badge');
  const modalEditCustomBadge = document.getElementById('modal-edit-custom-badge');
  const btnExportSource = document.getElementById('btn-export-source');
  const btnEditModalClose = document.getElementById('btn-edit-modal-close');
  const btnEditModalCancel = document.getElementById('btn-edit-modal-cancel');
  const btnEditModalSave = document.getElementById('btn-edit-modal-save');
  const tabBtnEditEntities = document.getElementById('tab-btn-edit-entities');
  const tabBtnEditMeta = document.getElementById('tab-btn-edit-meta');
  const tabBtnEditJson = document.getElementById('tab-btn-edit-json');
  const tabEditEntities = document.getElementById('tab-edit-entities');
  const tabEditMeta = document.getElementById('tab-edit-meta');
  const tabEditJson = document.getElementById('tab-edit-json');
  const sourceEntryBadgeCount = document.getElementById('source-entry-badge-count');

  // Master-Detail Entity Explorer
  const entitySearchInput = document.getElementById('entity-search-input');
  const btnAddEntryMenu = document.getElementById('btn-add-entry-menu');
  const menuAddEntryOptions = document.getElementById('menu-add-entry-options');
  const btnActionCreateBlank = document.getElementById('btn-action-create-blank');
  const btnActionCloneCompendium = document.getElementById('btn-action-clone-compendium');
  const entityListContainer = document.getElementById('entity-list-container');

  // Master-Detail Entity Studio
  const activeEntityDisplayName = document.getElementById('active-entity-display-name');
  const activeEntityCategoryBadge = document.getElementById('active-entity-category-badge');
  const btnModeVisual = document.getElementById('btn-mode-visual');
  const btnModeJson = document.getElementById('btn-mode-json');
  const btnSaveActiveEntry = document.getElementById('btn-save-active-entry');
  const entityVisualFormsWrap = document.getElementById('entity-visual-forms-wrap');
  const entityEmptyState = document.getElementById('entity-empty-state');

  // Category Builder Forms
  const formCategoryBestiary = document.getElementById('form-category-bestiary');
  const formCategorySpells = document.getElementById('form-category-spells');
  const formCategoryItems = document.getElementById('form-category-items');
  const formCategoryClasses = document.getElementById('form-category-classes');
  const formCategoryRaces = document.getElementById('form-category-races');
  const formCategoryFeats = document.getElementById('form-category-feats');
  const formCategoryBackgrounds = document.getElementById('form-category-backgrounds');
  const formCategoryAdventures = document.getElementById('form-category-adventures');

  // Active Entity JSON Editor
  const entityEntryJsonWrap = document.getElementById('entity-entry-json-wrap');
  const entityEntryJsonTextarea = document.getElementById('entity-entry-json-textarea');
  const entityJsonSyntaxStatus = document.getElementById('entity-json-syntax-status');
  const btnFormatEntityJson = document.getElementById('btn-format-entity-json');

  // Clone from Compendium Modal
  const modalCloneCompendium = document.getElementById('modal-clone-compendium');
  const btnCloseCloneModal = document.getElementById('btn-close-clone-modal');
  const btnCancelClone = document.getElementById('btn-cancel-clone');
  const cloneCategoryBadge = document.getElementById('clone-category-badge');
  const cloneCompendiumSearch = document.getElementById('clone-compendium-search');
  const cloneCompendiumResults = document.getElementById('clone-compendium-results');

  // Metadata tab fields
  const editSourceCode = document.getElementById('edit-source-code');
  const editSourceName = document.getElementById('edit-source-name');
  const editSourceCategory = document.getElementById('edit-source-category');
  const editSourceAuthor = document.getElementById('edit-source-author');
  const editSourceVersion = document.getElementById('edit-source-version');
  const editSourceDesc = document.getElementById('edit-source-desc');
  const editSourceFilepath = document.getElementById('edit-source-filepath');
  const btnRevealSourceFile = document.getElementById('btn-reveal-source-file');
  const jsonSyntaxStatus = document.getElementById('json-syntax-status');
  const jsonEntryCounter = document.getElementById('json-entry-counter');
  const btnInsertTemplate = document.getElementById('btn-insert-template');
  const btnFormatJson = document.getElementById('btn-format-json');
  const editSourceJsonEditor = document.getElementById('edit-source-json-editor');
  const jsonErrorBanner = document.getElementById('json-error-banner');
  const jsonErrorMessage = document.getElementById('json-error-message');
  const editSaveStatus = document.getElementById('edit-save-status');

  // Create Custom Source Modal
  const modalCreateCustomSource = document.getElementById('modal-create-custom-source');
  const btnCreateSourceClose = document.getElementById('btn-create-source-close');
  const btnCreateSourceCancel = document.getElementById('btn-create-source-cancel');
  const btnCreateSourceSubmit = document.getElementById('btn-create-source-submit');
  const createSrcCategory = document.getElementById('create-src-category');
  const createSrcCode = document.getElementById('create-src-code');
  const createSrcName = document.getElementById('create-src-name');
  const createSrcAuthor = document.getElementById('create-src-author');
  const createSrcDesc = document.getElementById('create-src-desc');

  // Maximize / Restore modal button
  const btnToggleMaximizeModal = document.getElementById('btn-toggle-maximize-modal');

  // Global Compendium Search & Statblock Quick-Preview Drawer
  const btnOpenBulkImport = document.getElementById('btn-open-bulk-import');
  const globalCompendiumSearchInput = document.getElementById('global-compendium-search-input');
  const btnClearGlobalSearch = document.getElementById('btn-clear-global-search');
  const globalSearchCategoryChips = document.getElementById('global-search-category-chips');
  const globalSearchResultsPanel = document.getElementById('global-search-results-panel');

  const statblockDrawerBackdrop = document.getElementById('statblock-drawer-backdrop');
  const drawerStatblockPreview = document.getElementById('drawer-statblock-preview');
  const sbDrawerCatBadge = document.getElementById('sb-drawer-cat-badge');
  const sbDrawerTitle = document.getElementById('sb-drawer-title');
  const sbDrawerContent = document.getElementById('sb-drawer-content');
  const sbDrawerSourceText = document.getElementById('sb-drawer-source-text');
  const btnCloseSbDrawer = document.getElementById('btn-close-sb-drawer');
  const btnDrawerOpenEditor = document.getElementById('btn-drawer-open-editor');

  // Bulk Sourcebook Import Wizard
  const modalBulkImport = document.getElementById('modal-bulk-import');
  const btnCloseBulkImport = document.getElementById('btn-close-bulk-import');
  const btnCancelBulkImport = document.getElementById('btn-cancel-bulk-import');
  const bulkDropZone = document.getElementById('bulk-drop-zone');
  const btnBrowseImportFiles = document.getElementById('btn-browse-import-files');
  const btnBrowseImportFolder = document.getElementById('btn-browse-import-folder');
  const btnBrowseImportZip = document.getElementById('btn-browse-import-zip');
  const bulkTargetSourceCode = document.getElementById('bulk-target-source-code');
  const bulkConflictDefaultMode = document.getElementById('bulk-conflict-default-mode');
  const bulkFilesCountBadge = document.getElementById('bulk-files-count-badge');
  const bulkPreviewTable = document.getElementById('bulk-preview-table');
  const bulkPreviewTableBody = document.getElementById('bulk-preview-table-body');
  const bulkSelectAllCheckbox = document.getElementById('bulk-select-all-checkbox');
  const bulkImportStatusText = document.getElementById('bulk-import-status-text');
  const btnExecuteBulkImport = document.getElementById('btn-execute-bulk-import');
  const bulkImportBtnCount = document.getElementById('bulk-import-btn-count');

  // Conflict Resolution Modal
  const modalImportConflict = document.getElementById('modal-import-conflict');
  const conflictFilenameDisplay = document.getElementById('conflict-filename-display');
  const conflictCategoryDisplay = document.getElementById('conflict-category-display');
  const conflictRenamePreview = document.getElementById('conflict-rename-preview');
  const conflictApplyToAll = document.getElementById('conflict-apply-to-all');
  const btnConfirmConflictChoice = document.getElementById('btn-confirm-conflict-choice');

  let activeGlobalCatFilter = '';
  let activePreviewTarget = null; // { category, name, source }
  let currentBulkCandidates = [];
  let globalSearchDebounceTimer = null;

  let currentSourcesData = null;
  let activeEditingSource = null;
  let activeSourceEntities = [];
  let activeSourceRawData = null;
  let activeEntityIndex = -1;
  let activeStudioMode = 'visual'; // 'visual' | 'json'
  let activeClassLevel = 1;
  let expandedCategories = new Set(['bestiary', 'spells']);
  let activeSourceSearch = '';
  let activeStatusFilter = 'all';
  let activeCampaignScope = '';

  async function loadCampaignsForSourceScope() {
    if (!sourcesCampaignScope) return;
    const currentVal = sourcesCampaignScope.value;
    try {
      const res = await api.gmGetCampaigns();
      if (res.success && Array.isArray(res.campaigns)) {
        sourcesCampaignScope.innerHTML = '<option value="">Global Defaults (All Campaigns)</option>';
        for (const camp of res.campaigns) {
          const opt = document.createElement('option');
          opt.value = camp.id;
          opt.textContent = `Campaign: ${camp.name || camp.id}`;
          sourcesCampaignScope.appendChild(opt);
        }
        sourcesCampaignScope.value = currentVal;
      }
    } catch (e) {
      console.error('Failed to populate campaign scope options:', e);
    }
  }

  async function loadAllSources() {
    if (!sourcesCategoriesAccordion) return;
    try {
      sourcesCategoriesAccordion.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading database sources...</div>';
      const res = await api.sourcesGetAll(activeCampaignScope || null);
      if (res && res.success && Array.isArray(res.categories)) {
        currentSourcesData = res;
        updateSourceStats(res.categories);
        renderCategoriesAccordion();
      } else {
        sourcesCategoriesAccordion.innerHTML = '<div class="loading-placeholder text-danger">Failed to load database sources.</div>';
      }
    } catch (err) {
      console.error('Error loading sources:', err);
      sourcesCategoriesAccordion.innerHTML = `<div class="loading-placeholder text-danger">Error: ${err.message}</div>`;
    }
  }

  function updateSourceStats(categories) {
    let total = 0;
    let enabled = 0;
    let custom = 0;

    for (const cat of categories) {
      for (const src of cat.sources) {
        total++;
        if (src.enabled) enabled++;
        if (src.isCustom) custom++;
      }
    }

    if (statTotalSources) statTotalSources.textContent = total;
    if (statEnabledSources) statEnabledSources.textContent = enabled;
    if (statCustomSources) statCustomSources.textContent = custom;
  }

  function renderCategoriesAccordion() {
    if (!currentSourcesData || !sourcesCategoriesAccordion) return;
    sourcesCategoriesAccordion.innerHTML = '';

    const term = activeSourceSearch.toLowerCase().trim();

    for (const cat of currentSourcesData.categories) {
      // Filter items according to search query and status filter
      const matchingSources = cat.sources.filter(src => {
        if (activeStatusFilter === 'active' && !src.enabled) return false;
        if (activeStatusFilter === 'inactive' && src.enabled) return false;
        if (activeStatusFilter === 'custom' && !src.isCustom) return false;

        if (!term) return true;
        return (
          (src.name && src.name.toLowerCase().includes(term)) ||
          (src.code && src.code.toLowerCase().includes(term)) ||
          (src.author && src.author.toLowerCase().includes(term))
        );
      });

      // If search or filter is active and category has no matches, omit it
      if ((term || activeStatusFilter !== 'all') && matchingSources.length === 0) continue;

      const isExpanded = term ? true : expandedCategories.has(cat.id);
      const enabledInCat = cat.sources.filter(s => s.enabled).length;

      const card = document.createElement('div');
      card.className = `source-category-card ${isExpanded ? 'expanded' : ''}`;
      card.id = `cat-card-${cat.id}`;

      card.innerHTML = `
        <div class="category-header-wrap" data-cat-id="${cat.id}">
          <div class="category-title-left">
            <span class="category-icon">${cat.icon || '📁'}</span>
            <div class="category-title-text">
              <h3>
                ${cat.name}
                <span class="category-badge-count" id="cat-count-${cat.id}">
                  ${enabledInCat} / ${cat.sources.length} Active
                </span>
              </h3>
            </div>
          </div>
          <div class="category-header-actions" onclick="event.stopPropagation();">
            <button class="btn-cat-action" data-action="enable-all" data-cat="${cat.id}" title="Enable all sources in ${cat.name}">Enable All</button>
            <button class="btn-cat-action" data-action="disable-all" data-cat="${cat.id}" title="Disable all sources in ${cat.name}">Disable All</button>
            <button class="btn-cat-action btn-cat-add" data-action="add-file" data-cat="${cat.id}" title="Import external JSON file into ${cat.name}">➕ Add File</button>
            <button class="btn-cat-action btn-cat-custom" data-action="add-custom" data-cat="${cat.id}" title="Create new homebrew source in ${cat.name}">✨ Add Custom</button>
            <span class="accordion-chevron">▼</span>
          </div>
        </div>
        <div class="category-content-wrap">
          <div class="source-items-grid" id="grid-${cat.id}">
            <!-- Source items -->
          </div>
        </div>
      `;

      // Header click toggles expand/collapse
      const headerWrap = card.querySelector('.category-header-wrap');
      headerWrap.addEventListener('click', () => {
        if (expandedCategories.has(cat.id)) {
          expandedCategories.delete(cat.id);
          card.classList.remove('expanded');
        } else {
          expandedCategories.add(cat.id);
          card.classList.add('expanded');
        }
      });

      // Actions in header
      card.querySelectorAll('.btn-cat-action').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          const catId = btn.getAttribute('data-cat');

          if (action === 'enable-all' || action === 'disable-all') {
            const enable = (action === 'enable-all');
            const targetCat = currentSourcesData.categories.find(c => c.id === catId);
            if (!targetCat) return;
            const codes = targetCat.sources.map(s => s.code);
            btn.disabled = true;
            try {
              await api.sourcesBatchToggle({ codes, enabled: enable, campaignId: activeCampaignScope || null });
              for (const s of targetCat.sources) s.enabled = enable;
              updateSourceStats(currentSourcesData.categories);
              renderCategoriesAccordion();
            } finally {
              btn.disabled = false;
            }
          } else if (action === 'add-file') {
            const res = await api.sourcesAddFile({ category: catId });
            if (res && res.success) {
              await loadAllSources();
            }
          } else if (action === 'add-custom') {
            openCreateCustomModal(catId);
          }
        });
      });

      // Populate source items
      const grid = card.querySelector(`#grid-${cat.id}`);
      if (matchingSources.length === 0) {
        grid.innerHTML = '<div class="loading-placeholder">No matching sources found in this category.</div>';
      } else {
        for (const src of matchingSources) {
          const itemCard = document.createElement('div');
          itemCard.className = `source-item-card ${src.enabled ? '' : 'disabled'}`;
          itemCard.id = `src-card-${src.category}-${src.code}`;

          const sizeKb = src.fileSize ? `${Math.round(src.fileSize / 1024)} KB` : '';
          const countLabel = src.entryCount !== undefined ? `${src.entryCount} entries` : '';

          itemCard.innerHTML = `
            <div class="source-item-top">
              <div class="source-item-info">
                <div class="source-item-title-row">
                  <span class="source-dot ${src.enabled ? 'active' : ''}"></span>
                  <span class="source-item-title" title="${src.name || src.code}">${src.name || src.code}</span>
                  <span class="source-code-badge ${src.isCustom ? 'custom' : ''}">${src.code}</span>
                  ${src.isCustom ? '<span class="badge badge-accent" style="font-size: 9px; padding: 1px 5px;">Custom</span>' : ''}
                </div>
                <div class="source-item-author">${src.author || 'Official Rulebook'}</div>
              </div>
            </div>

            <div class="source-item-meta-row">
              ${countLabel ? `<span>📊 ${countLabel}</span>` : ''}
              ${sizeKb ? `<span>💾 ${sizeKb}</span>` : ''}
              ${src.version ? `<span>v${src.version}</span>` : ''}
            </div>

            <div class="source-item-bottom">
              <div class="source-actions-left">
                <button class="btn-source-action" data-action="edit" data-cat="${src.category}" data-code="${src.code}" title="Edit metadata or JSON">
                  ✏️ Edit
                </button>
                ${src.isCustom ? `
                  <button class="btn-source-action btn-source-delete" data-action="delete" data-cat="${src.category}" data-code="${src.code}" title="Delete this custom source">
                    🗑️ Delete
                  </button>
                ` : ''}
              </div>

              <div class="source-actions-right">
                <label class="switch-label" title="${src.enabled ? 'Enabled in VTT' : 'Disabled in VTT'}">
                  <span class="switch-text">${src.enabled ? 'On' : 'Off'}</span>
                  <input type="checkbox" class="source-toggle-cb" data-cat="${src.category}" data-code="${src.code}" ${src.enabled ? 'checked' : ''} />
                  <span class="switch-slider"></span>
                </label>
              </div>
            </div>
          `;

          // Switch toggle event
          const toggleCb = itemCard.querySelector('.source-toggle-cb');
          const switchText = itemCard.querySelector('.switch-text');
          const sourceDot = itemCard.querySelector('.source-dot');

          toggleCb.addEventListener('change', async () => {
            const isChecked = toggleCb.checked;
            switchText.textContent = isChecked ? 'On' : 'Off';
            if (isChecked) {
              itemCard.classList.remove('disabled');
              sourceDot.classList.add('active');
            } else {
              itemCard.classList.add('disabled');
              sourceDot.classList.remove('active');
            }

            src.enabled = isChecked;
            updateSourceStats(currentSourcesData.categories);

            // Update category active badge count
            const currentCat = currentSourcesData.categories.find(c => c.id === src.category);
            if (currentCat) {
              const activeCount = currentCat.sources.filter(s => s.enabled).length;
              const countEl = card.querySelector(`#cat-count-${src.category}`);
              if (countEl) countEl.textContent = `${activeCount} / ${currentCat.sources.length} Active`;
            }

            await api.sourcesToggle({
              code: src.code,
              enabled: isChecked,
              campaignId: activeCampaignScope || null
            });
          });

          // Edit button
          itemCard.querySelector('[data-action="edit"]').addEventListener('click', () => {
            openEditSourceModal(src.category, src.code);
          });

          // Delete button (if custom)
          const delBtn = itemCard.querySelector('[data-action="delete"]');
          if (delBtn) {
            delBtn.addEventListener('click', async () => {
              if (confirm(`Are you sure you want to delete custom database source "${src.name || src.code}"?\nThis action cannot be undone.`)) {
                delBtn.disabled = true;
                const res = await api.sourcesDeleteCustom({ category: src.category, code: src.code });
                if (res.success) {
                  await loadAllSources();
                } else {
                  alert(`Failed to delete source: ${res.error}`);
                  delBtn.disabled = false;
                }
              }
            });
          }

          grid.appendChild(itemCard);
        }
      }

      sourcesCategoriesAccordion.appendChild(card);
    }
  }

  // Search input handlers
  if (sourcesSearchInput) {
    sourcesSearchInput.addEventListener('input', () => {
      activeSourceSearch = sourcesSearchInput.value;
      if (btnClearSourceSearch) {
        if (activeSourceSearch) btnClearSourceSearch.classList.remove('vtt-hidden');
        else btnClearSourceSearch.classList.add('vtt-hidden');
      }
      renderCategoriesAccordion();
    });
  }

  if (btnClearSourceSearch) {
    btnClearSourceSearch.addEventListener('click', () => {
      sourcesSearchInput.value = '';
      activeSourceSearch = '';
      btnClearSourceSearch.classList.add('vtt-hidden');
      renderCategoriesAccordion();
    });
  }

  // Campaign scope dropdown handler
  if (sourcesCampaignScope) {
    sourcesCampaignScope.addEventListener('change', () => {
      activeCampaignScope = sourcesCampaignScope.value;
      loadAllSources();
    });
  }

  if (btnRefreshSources) {
    btnRefreshSources.addEventListener('click', () => {
      loadAllSources();
    });
  }

  // Preset selector handler
  if (btnApplyPreset && sourcesPresetSelect) {
    btnApplyPreset.addEventListener('click', async () => {
      const preset = sourcesPresetSelect.value;
      const presetName = sourcesPresetSelect.options[sourcesPresetSelect.selectedIndex]?.text || preset;
      if (!confirm(`Apply rulebook preset "${presetName}"?\nThis will update active/inactive sourcebooks according to this preset configuration.`)) {
        return;
      }

      btnApplyPreset.disabled = true;
      btnApplyPreset.textContent = 'Applying...';
      try {
        const res = await api.sourcesApplyPreset({
          preset,
          campaignId: activeCampaignScope || null
        });

        if (res && res.success) {
          await loadAllSources();
        } else {
          alert(`Failed to apply preset: ${res?.error || 'Unknown error'}`);
        }
      } catch (err) {
        alert(`Error applying preset: ${err.message}`);
      } finally {
        btnApplyPreset.disabled = false;
        btnApplyPreset.textContent = 'Apply';
      }
    });
  }

  // Status filter dropdown handler
  if (sourcesStatusFilter) {
    sourcesStatusFilter.addEventListener('change', () => {
      activeStatusFilter = sourcesStatusFilter.value;
      renderCategoriesAccordion();
    });
  }

  // Expand / Collapse all category accordions
  if (btnExpandAllCats) {
    btnExpandAllCats.addEventListener('click', () => {
      if (!currentSourcesData) return;
      for (const cat of currentSourcesData.categories) {
        expandedCategories.add(cat.id);
      }
      renderCategoriesAccordion();
    });
  }

  if (btnCollapseAllCats) {
    btnCollapseAllCats.addEventListener('click', () => {
      expandedCategories.clear();
      renderCategoriesAccordion();
    });
  }

  // =========================================================================
  // EDIT SOURCE MODAL & MASTER-DETAIL STUDIO LOGIC
  // =========================================================================
  async function openEditSourceModal(category, code) {
    if (!modalEditSource) return;

    btnEditModalSave.disabled = true;
    editSaveStatus.textContent = 'Loading source details...';
    modalEditSource.classList.remove('vtt-hidden');

    try {
      const res = await api.sourcesGetDetails({ category, code });
      if (!res || !res.success) {
        alert(res?.error || 'Failed to load source details.');
        modalEditSource.classList.add('vtt-hidden');
        return;
      }

      activeEditingSource = {
        ...res.source,
        rawJson: res.rawJson
      };

      // Populate header
      modalEditSourceTitle.textContent = res.source.name || res.source.code;
      modalEditSourceBadge.textContent = res.source.code;
      if (res.source.isCustom) modalEditCustomBadge.classList.remove('vtt-hidden');
      else modalEditCustomBadge.classList.add('vtt-hidden');

      // Populate metadata tab
      editSourceCode.value = res.source.code;
      editSourceName.value = res.source.name || '';
      editSourceCategory.value = res.source.category.toUpperCase();
      editSourceAuthor.value = res.source.author || '';
      editSourceVersion.value = res.source.version || '';
      editSourceDesc.value = res.source.description || '';
      editSourceFilepath.textContent = res.source.filePath || 'Unknown';

      // If built-in, lock metadata fields
      const isCustom = !!res.source.isCustom;
      editSourceName.readOnly = !isCustom;
      editSourceAuthor.readOnly = !isCustom;
      editSourceVersion.readOnly = !isCustom;
      editSourceDesc.readOnly = !isCustom;

      // Populate JSON tab
      editSourceJsonEditor.value = res.rawJson || '';
      validateJsonEditor();

      // Parse entities for Master-Detail Studio
      parseSourceEntities(category, res.source.code, res.rawJson);

      // Default to Studio Entities tab
      switchEditModalTab('entities');

      btnEditModalSave.disabled = false;
      editSaveStatus.textContent = '';
    } catch (e) {
      alert(`Error loading source details: ${e.message}`);
      modalEditSource.classList.add('vtt-hidden');
    }
  }

  function parseSourceEntities(category, sourceCode, rawJsonString) {
    activeSourceEntities = [];
    activeSourceRawData = { isArray: true, key: null, raw: null };

    if (!rawJsonString || !rawJsonString.trim()) {
      renderEntitySidebarList();
      selectActiveEntity(-1);
      return;
    }

    try {
      const parsed = JSON.parse(rawJsonString);
      activeSourceRawData.raw = parsed;

      if (Array.isArray(parsed)) {
        activeSourceRawData.isArray = true;
        activeSourceEntities = parsed.map(item => jsonToEntity(category, item, sourceCode));
      } else if (typeof parsed === 'object' && parsed !== null) {
        activeSourceRawData.isArray = false;
        // Search for primary array key
        const preferredKeys = [category, category.slice(0, -1), 'monster', 'spell', 'item', 'class', 'race', 'feat', 'background', 'adventure', 'data'];
        let foundKey = preferredKeys.find(k => Array.isArray(parsed[k]));
        if (!foundKey) {
          foundKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
        }

        if (foundKey && Array.isArray(parsed[foundKey])) {
          activeSourceRawData.key = foundKey;
          activeSourceEntities = parsed[foundKey].map(item => jsonToEntity(category, item, sourceCode));
        } else {
          activeSourceRawData.key = category;
          activeSourceEntities = [];
        }
      }
    } catch (err) {
      console.warn('Failed to parse rawJson into structured entities:', err);
      activeSourceEntities = [];
    }

    renderEntitySidebarList();
    if (activeSourceEntities.length > 0) {
      selectActiveEntity(0);
    } else {
      selectActiveEntity(-1);
    }
  }

  function switchEditModalTab(tabKey) {
    tabBtnEditEntities.classList.remove('active');
    tabBtnEditMeta.classList.remove('active');
    tabBtnEditJson.classList.remove('active');
    tabEditEntities.classList.remove('active');
    tabEditMeta.classList.remove('active');
    tabEditJson.classList.remove('active');

    if (tabKey === 'entities') {
      tabBtnEditEntities.classList.add('active');
      tabEditEntities.classList.add('active');
    } else if (tabKey === 'meta') {
      tabBtnEditMeta.classList.add('active');
      tabEditMeta.classList.add('active');
    } else if (tabKey === 'json') {
      tabBtnEditJson.classList.add('active');
      tabEditJson.classList.add('active');
      // Sync raw JSON from activeSourceEntities
      syncSourceEntitiesToJsonEditor();
      validateJsonEditor();
    }
  }

  if (tabBtnEditEntities) tabBtnEditEntities.addEventListener('click', () => switchEditModalTab('entities'));
  if (tabBtnEditMeta) tabBtnEditMeta.addEventListener('click', () => switchEditModalTab('meta'));
  if (tabBtnEditJson) tabBtnEditJson.addEventListener('click', () => switchEditModalTab('json'));

  // Reveal file in native file explorer
  if (btnRevealSourceFile) {
    btnRevealSourceFile.addEventListener('click', () => {
      if (activeEditingSource && activeEditingSource.filePath) {
        api.sourcesRevealFile(activeEditingSource.filePath);
      }
    });
  }

  // Export current sourcebook
  if (btnExportSource) {
    btnExportSource.addEventListener('click', async () => {
      if (!activeEditingSource) return;
      btnExportSource.disabled = true;
      btnExportSource.textContent = 'Exporting...';
      try {
        // Save current entity changes first
        saveActiveEntity(false);
        syncSourceEntitiesToJsonEditor();

        const res = await api.sourcesExport({
          category: activeEditingSource.category,
          code: activeEditingSource.code
        });

        if (res && res.success) {
          alert(`Source successfully exported to:\n${res.filePath}`);
        } else {
          alert(`Export failed: ${res?.error || 'Unknown error'}`);
        }
      } catch (err) {
        alert(`Error exporting source: ${err.message}`);
      } finally {
        btnExportSource.disabled = false;
        btnExportSource.innerHTML = '<span class="icon">📤</span> Export / Share';
      }
    });
  }

  // =========================================================================
  // MASTER-DETAIL SIDEBAR & ENTITY SELECTION
  // =========================================================================
  function renderEntitySidebarList() {
    if (!entityListContainer) return;
    entityListContainer.innerHTML = '';

    const searchTerm = (entitySearchInput?.value || '').toLowerCase().trim();
    const cat = activeEditingSource?.category || 'bestiary';

    if (sourceEntryBadgeCount) {
      sourceEntryBadgeCount.textContent = activeSourceEntities.length;
    }

    const filtered = activeSourceEntities.map((entity, idx) => ({ entity, index: idx })).filter(item => {
      if (!searchTerm) return true;
      const name = (item.entity.name || '').toLowerCase();
      const code = (item.entity.source || '').toLowerCase();
      return name.includes(searchTerm) || code.includes(searchTerm);
    });

    if (filtered.length === 0) {
      entityListContainer.innerHTML = `
        <div class="entity-list-empty">
          <p>${searchTerm ? 'No matching entries found.' : 'No entries yet in this sourcebook.'}</p>
          <button type="button" class="btn btn-xs btn-primary mt-8" id="btn-empty-add-blank">➕ Add First Entry</button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById('btn-empty-add-blank');
      if (btnEmptyAdd) {
        btnEmptyAdd.addEventListener('click', () => {
          addNewBlankEntity();
        });
      }
      return;
    }

    filtered.forEach(({ entity, index }) => {
      const card = document.createElement('div');
      card.className = `entity-card-item ${index === activeEntityIndex ? 'active' : ''}`;

      // Subtitle pill based on category
      let pillText = '';
      if (cat === 'bestiary') pillText = `CR ${entity.cr ?? '-'}`;
      else if (cat === 'spells') pillText = entity.level === 0 ? 'Cantrip' : `Lvl ${entity.level}`;
      else if (cat === 'items') pillText = entity.rarity || entity.itemType || 'Item';
      else if (cat === 'classes') pillText = entity.hitDie || 'Class';
      else if (cat === 'races') pillText = entity.size || 'Race';
      else if (cat === 'feats') pillText = 'Feat';
      else if (cat === 'backgrounds') pillText = 'Background';
      else if (cat === 'adventures') pillText = 'Adventure';

      card.innerHTML = `
        <div class="entity-card-info">
          <div class="entity-card-title">${entity.name || 'Untitled Entry'}</div>
          <div class="entity-card-meta">
            ${pillText ? `<span class="entity-badge">${pillText}</span>` : ''}
            <span class="entity-badge-source">${entity.source || activeEditingSource?.code || ''}</span>
          </div>
        </div>
        <div class="entity-card-actions">
          <button type="button" class="btn-card-action btn-duplicate" title="Duplicate entry">📋</button>
          <button type="button" class="btn-card-action btn-delete" title="Delete entry">🗑️</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-action')) return;
        selectActiveEntity(index);
      });

      const btnDup = card.querySelector('.btn-duplicate');
      btnDup.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateEntity(index);
      });

      const btnDel = card.querySelector('.btn-delete');
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteEntity(index);
      });

      entityListContainer.appendChild(card);
    });
  }

  if (entitySearchInput) {
    entitySearchInput.addEventListener('input', () => {
      renderEntitySidebarList();
    });
  }

  function selectActiveEntity(index) {
    if (index < 0 || index >= activeSourceEntities.length) {
      activeEntityIndex = -1;
      if (entityVisualFormsWrap) entityVisualFormsWrap.classList.add('vtt-hidden');
      if (entityEmptyState) entityEmptyState.classList.remove('vtt-hidden');
      if (activeEntityDisplayName) activeEntityDisplayName.textContent = 'No Entry Selected';
      if (activeEntityCategoryBadge) activeEntityCategoryBadge.textContent = (activeEditingSource?.category || '').toUpperCase();
      if (entityEntryJsonTextarea) entityEntryJsonTextarea.value = '';
      return;
    }

    activeEntityIndex = index;
    if (entityEmptyState) entityEmptyState.classList.add('vtt-hidden');

    const cat = activeEditingSource?.category || 'bestiary';
    const entity = activeSourceEntities[index];

    if (activeEntityDisplayName) activeEntityDisplayName.textContent = entity.name || 'Untitled Entry';
    if (activeEntityCategoryBadge) activeEntityCategoryBadge.textContent = cat.toUpperCase();

    // Show appropriate category builder form
    showCategoryForm(cat);

    // Populate visual form
    populateVisualForm(cat, entity);

    // Sync active entry JSON
    syncActiveEntityToJson();

    // Re-render sidebar highlights
    const cards = entityListContainer?.querySelectorAll('.entity-card-item');
    cards?.forEach((c, idx) => {
      c.classList.toggle('active', idx === activeEntityIndex);
    });

    // Update studio mode display (visual vs json)
    setStudioMode(activeStudioMode);
  }

  function showCategoryForm(cat) {
    const allForms = [
      formCategoryBestiary, formCategorySpells, formCategoryItems,
      formCategoryClasses, formCategoryRaces, formCategoryFeats,
      formCategoryBackgrounds, formCategoryAdventures
    ];
    allForms.forEach(f => f?.classList.add('vtt-hidden'));

    const map = {
      bestiary: formCategoryBestiary,
      spells: formCategorySpells,
      items: formCategoryItems,
      classes: formCategoryClasses,
      races: formCategoryRaces,
      feats: formCategoryFeats,
      backgrounds: formCategoryBackgrounds,
      adventures: formCategoryAdventures
    };

    if (map[cat]) map[cat].classList.remove('vtt-hidden');
  }

  function setStudioMode(mode) {
    activeStudioMode = mode;
    if (mode === 'json') {
      btnModeJson?.classList.add('active');
      btnModeVisual?.classList.remove('active');
      entityVisualFormsWrap?.classList.add('vtt-hidden');
      entityEntryJsonWrap?.classList.remove('vtt-hidden');
      syncActiveEntityToJson();
    } else {
      btnModeVisual?.classList.add('active');
      btnModeJson?.classList.remove('active');
      entityVisualFormsWrap?.classList.remove('vtt-hidden');
      entityEntryJsonWrap?.classList.add('vtt-hidden');
    }
  }

  if (btnModeVisual) btnModeVisual.addEventListener('click', () => setStudioMode('visual'));
  if (btnModeJson) btnModeJson.addEventListener('click', () => setStudioMode('json'));

  // Format active entry JSON
  if (btnFormatEntityJson) {
    btnFormatEntityJson.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(entityEntryJsonTextarea.value);
        entityEntryJsonTextarea.value = JSON.stringify(parsed, null, 2);
        entityJsonSyntaxStatus.textContent = '✅ Valid JSON';
        entityJsonSyntaxStatus.className = 'json-status-tag';
      } catch (e) {
        entityJsonSyntaxStatus.textContent = '❌ Syntax Error';
        entityJsonSyntaxStatus.className = 'json-status-tag invalid';
      }
    });
  }

  if (entityEntryJsonTextarea) {
    entityEntryJsonTextarea.addEventListener('input', () => {
      try {
        JSON.parse(entityEntryJsonTextarea.value);
        entityJsonSyntaxStatus.textContent = '✅ Valid JSON';
        entityJsonSyntaxStatus.className = 'json-status-tag';
      } catch (e) {
        entityJsonSyntaxStatus.textContent = '❌ Syntax Error';
        entityJsonSyntaxStatus.className = 'json-status-tag invalid';
      }
    });
  }

  function syncActiveEntityToJson() {
    if (activeEntityIndex < 0 || !activeSourceEntities[activeEntityIndex]) return;
    const cat = activeEditingSource?.category || 'bestiary';
    const raw5eJson = entityToJson(cat, activeSourceEntities[activeEntityIndex]);
    if (entityEntryJsonTextarea) {
      entityEntryJsonTextarea.value = JSON.stringify(raw5eJson, null, 2);
    }
    if (entityJsonSyntaxStatus) {
      entityJsonSyntaxStatus.textContent = '✅ Valid JSON';
      entityJsonSyntaxStatus.className = 'json-status-tag';
    }
  }

  function syncSourceEntitiesToJsonEditor() {
    if (!editSourceJsonEditor || !activeEditingSource) return;
    const cat = activeEditingSource.category;
    const jsonEntities = activeSourceEntities.map(e => entityToJson(cat, e));

    if (activeSourceRawData.isArray) {
      editSourceJsonEditor.value = JSON.stringify(jsonEntities, null, 2);
    } else {
      const outputObj = activeSourceRawData.raw ? { ...activeSourceRawData.raw } : {};
      const key = activeSourceRawData.key || cat;
      outputObj[key] = jsonEntities;
      editSourceJsonEditor.value = JSON.stringify(outputObj, null, 2);
    }
  }

  // =========================================================================
  // VISUAL FORM POPULATION & READERS
  // =========================================================================
  function populateVisualForm(category, entity) {
    switch (category) {
      case 'bestiary':
        populateBestiaryForm(entity);
        break;
      case 'spells':
        populateSpellsForm(entity);
        break;
      case 'items':
        populateItemsForm(entity);
        break;
      case 'classes':
        populateClassesForm(entity);
        break;
      case 'races':
        populateRacesForm(entity);
        break;
      case 'feats':
        populateFeatsForm(entity);
        break;
      case 'backgrounds':
        populateBackgroundsForm(entity);
        break;
      case 'adventures':
        populateAdventuresForm(entity);
        break;
    }
  }

  function readVisualForm(category) {
    if (activeEntityIndex < 0 || !activeSourceEntities[activeEntityIndex]) return null;
    const current = activeSourceEntities[activeEntityIndex];

    switch (category) {
      case 'bestiary':
        return readBestiaryForm(current);
      case 'spells':
        return readSpellsForm(current);
      case 'items':
        return readItemsForm(current);
      case 'classes':
        return readClassesForm(current);
      case 'races':
        return readRacesForm(current);
      case 'feats':
        return readFeatsForm(current);
      case 'backgrounds':
        return readBackgroundsForm(current);
      case 'adventures':
        return readAdventuresForm(current);
      default:
        return current;
    }
  }

  // --- BESTIARY FORM ---
  function populateBestiaryForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('bf-beast-name', entity.name);
    setVal('bf-beast-size', entity.size || 'Medium');
    setVal('bf-beast-type', entity.type || 'Humanoid');
    setVal('bf-beast-alignment', entity.alignment || 'unaligned');
    setVal('bf-beast-cr', entity.cr ?? '1/4');
    setVal('bf-beast-ac', entity.ac ?? 12);
    setVal('bf-beast-ac-cond', entity.acCondition || '');
    setVal('bf-beast-hp-avg', entity.hpAvg ?? 22);
    setVal('bf-beast-hp-formula', entity.hpFormula || '');
    setVal('bf-beast-speed-walk', entity.speedWalk ?? 30);
    setVal('bf-beast-speed-fly', entity.speedFly ?? 0);
    setVal('bf-beast-speed-swim', entity.speedSwim ?? 0);
    setVal('bf-beast-speed-climb', entity.speedClimb ?? 0);
    setVal('bf-beast-speed-burrow', entity.speedBurrow ?? 0);

    const scores = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    scores.forEach(s => {
      setVal(`bf-beast-${s}`, entity[s] ?? 10);
      updateAbilityModDisplay(`bf-beast-${s}`, `mod-beast-${s}`);
    });

    setVal('bf-beast-senses', entity.senses || '');
    setVal('bf-beast-languages', entity.languages || '');
    setVal('bf-beast-resist', entity.resistances || '');
    setVal('bf-beast-immune', entity.immunities || '');
    setVal('bf-beast-cond-immune', entity.conditionImmunities || '');

    // Token & avatar
    const tokenUrlInput = document.getElementById('bf-beast-token-url');
    const tokenPreview = document.getElementById('bf-beast-token-preview');
    if (tokenUrlInput) tokenUrlInput.value = entity.tokenUrl || '';
    if (tokenPreview) {
      if (entity.tokenUrl) {
        tokenPreview.innerHTML = `<img src="${entity.tokenUrl}" alt="Token" onerror="this.parentElement.textContent='🐉'" />`;
      } else {
        tokenPreview.textContent = '🐉';
      }
    }

    // Dynamic cards
    renderCardBlockList('beast-traits-container', entity.traits || [], (arr) => { entity.traits = arr; });
    renderCardBlockList('beast-actions-container', entity.actions || [], (arr) => { entity.actions = arr; });
    renderCardBlockList('beast-reactions-container', entity.reactions || [], (arr) => { entity.reactions = arr; });
    renderCardBlockList('beast-legendary-container', entity.legendaryActions || [], (arr) => { entity.legendaryActions = arr; });
  }

  function readBestiaryForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseInt(document.getElementById(id)?.value, 10) || def;

    return {
      ...current,
      name: getVal('bf-beast-name', 'New Creature'),
      size: getVal('bf-beast-size', 'Medium'),
      type: getVal('bf-beast-type', 'Humanoid'),
      alignment: getVal('bf-beast-alignment', 'unaligned'),
      cr: getVal('bf-beast-cr', '1/4'),
      ac: getNum('bf-beast-ac', 10),
      acCondition: getVal('bf-beast-ac-cond'),
      hpAvg: getNum('bf-beast-hp-avg', 10),
      hpFormula: getVal('bf-beast-hp-formula', '2d8 + 2'),
      speedWalk: getNum('bf-beast-speed-walk', 30),
      speedFly: getNum('bf-beast-speed-fly', 0),
      speedSwim: getNum('bf-beast-speed-swim', 0),
      speedClimb: getNum('bf-beast-speed-climb', 0),
      speedBurrow: getNum('bf-beast-speed-burrow', 0),
      str: getNum('bf-beast-str', 10),
      dex: getNum('bf-beast-dex', 10),
      con: getNum('bf-beast-con', 10),
      int: getNum('bf-beast-int', 10),
      wis: getNum('bf-beast-wis', 10),
      cha: getNum('bf-beast-cha', 10),
      senses: getVal('bf-beast-senses'),
      languages: getVal('bf-beast-languages'),
      resistances: getVal('bf-beast-resist'),
      immunities: getVal('bf-beast-immune'),
      conditionImmunities: getVal('bf-beast-cond-immune'),
      tokenUrl: getVal('bf-beast-token-url')
    };
  }

  // --- SPELLS FORM ---
  function populateSpellsForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    setVal('bf-spell-name', entity.name);
    setVal('bf-spell-level', entity.level ?? 1);
    setVal('bf-spell-school', entity.school || 'Evocation');
    setVal('bf-spell-time-num', entity.castingTimeNum ?? 1);
    setVal('bf-spell-time-unit', entity.castingTimeUnit || 'action');
    setVal('bf-spell-range-dist', entity.rangeDistance ?? 60);
    setVal('bf-spell-range-type', entity.rangeType || 'feet');
    setVal('bf-spell-duration-unit', entity.durationUnit || 'instant');
    setVal('bf-spell-duration-amount', entity.durationAmount ?? 1);
    setCheck('bf-spell-comp-v', entity.componentV);
    setCheck('bf-spell-comp-s', entity.componentS);
    setCheck('bf-spell-comp-m', entity.componentM);
    setCheck('bf-spell-concentration', entity.isConcentration);
    setVal('bf-spell-materials-text', entity.materialsText || '');
    setVal('bf-spell-damage', entity.damageFormula || '');
    setVal('bf-spell-damage-type', entity.damageType || '');
    setVal('bf-spell-save', entity.savingThrow || '');
    setVal('bf-spell-upcast', entity.upcastBonus || '');
    setVal('bf-spell-classes', Array.isArray(entity.classes) ? entity.classes.join(', ') : (entity.classes || ''));
    setVal('bf-spell-desc', entity.description || '');
    setVal('bf-spell-higher-desc', entity.higherLevelsDesc || '');
  }

  function readSpellsForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseInt(document.getElementById(id)?.value, 10) || def;
    const getCheck = (id) => !!document.getElementById(id)?.checked;

    const rawClasses = getVal('bf-spell-classes');
    const classes = rawClasses ? rawClasses.split(',').map(s => s.trim()).filter(Boolean) : [];

    return {
      ...current,
      name: getVal('bf-spell-name', 'New Spell'),
      level: getNum('bf-spell-level', 1),
      school: getVal('bf-spell-school', 'Evocation'),
      castingTimeNum: getNum('bf-spell-time-num', 1),
      castingTimeUnit: getVal('bf-spell-time-unit', 'action'),
      rangeDistance: getNum('bf-spell-range-dist', 60),
      rangeType: getVal('bf-spell-range-type', 'feet'),
      durationUnit: getVal('bf-spell-duration-unit', 'instant'),
      durationAmount: getNum('bf-spell-duration-amount', 1),
      componentV: getCheck('bf-spell-comp-v'),
      componentS: getCheck('bf-spell-comp-s'),
      componentM: getCheck('bf-spell-comp-m'),
      isConcentration: getCheck('bf-spell-concentration'),
      materialsText: getVal('bf-spell-materials-text'),
      damageFormula: getVal('bf-spell-damage'),
      damageType: getVal('bf-spell-damage-type'),
      savingThrow: getVal('bf-spell-save'),
      upcastBonus: getVal('bf-spell-upcast'),
      classes,
      description: getVal('bf-spell-desc'),
      higherLevelsDesc: getVal('bf-spell-higher-desc')
    };
  }

  // --- ITEMS FORM ---
  function populateItemsForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    setVal('bf-item-name', entity.name);
    setVal('bf-item-type', entity.itemType || 'Wondrous Item');
    setVal('bf-item-rarity', entity.rarity || 'uncommon');
    setCheck('bf-item-req-attune', entity.reqAttune);
    setVal('bf-item-attune-details', entity.attuneDetails || '');
    setVal('bf-item-damage-dice', entity.damageDice || '');
    setVal('bf-item-damage-type', entity.damageType || '');
    setVal('bf-item-bonus-hit', entity.bonusHitDmg ?? 0);
    setVal('bf-item-base-ac', entity.baseAc ?? 0);
    setVal('bf-item-ac-bonus', entity.acBonus ?? 0);
    setVal('bf-item-weapon-properties', entity.weaponProperties || '');
    setVal('bf-item-value', entity.valueGp ?? 100);
    setVal('bf-item-weight', entity.weightLbs ?? 1);
    setVal('bf-item-charges', entity.charges ?? 0);
    setVal('bf-item-desc', entity.description || '');
  }

  function readItemsForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseFloat(document.getElementById(id)?.value) || def;
    const getCheck = (id) => !!document.getElementById(id)?.checked;

    return {
      ...current,
      name: getVal('bf-item-name', 'New Magic Item'),
      itemType: getVal('bf-item-type', 'Wondrous Item'),
      rarity: getVal('bf-item-rarity', 'uncommon'),
      reqAttune: getCheck('bf-item-req-attune'),
      attuneDetails: getVal('bf-item-attune-details'),
      damageDice: getVal('bf-item-damage-dice'),
      damageType: getVal('bf-item-damage-type'),
      bonusHitDmg: getNum('bf-item-bonus-hit', 0),
      baseAc: getNum('bf-item-base-ac', 0),
      acBonus: getNum('bf-item-ac-bonus', 0),
      weaponProperties: getVal('bf-item-weapon-properties'),
      valueGp: getNum('bf-item-value', 100),
      weightLbs: getNum('bf-item-weight', 1),
      charges: getNum('bf-item-charges', 0),
      description: getVal('bf-item-desc')
    };
  }

  // --- CLASSES FORM ---
  function populateClassesForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

    setVal('bf-class-name', entity.name);
    setVal('bf-class-hit-die', entity.hitDie || 'd8');
    setVal('bf-class-saves', Array.isArray(entity.savingThrows) ? entity.savingThrows.join(', ') : (entity.savingThrows || ''));
    setVal('bf-class-armor', entity.armorProf || '');
    setVal('bf-class-weapons', entity.weaponProf || '');
    setVal('bf-class-subclass-level', entity.subclassUnlockLevel ?? 3);

    // Initialize level progression matrix
    renderClassLevelsMatrix(entity);

    // Subclasses list
    renderCardBlockList('class-subclasses-container', (entity.subclasses || []).map(sc => ({
      name: sc.name || 'New Subclass',
      text: (sc.features || []).map(f => `**${f.name} (Lvl ${f.level}):** ${f.text}`).join('\n\n')
    })), (arr) => {
      entity.subclasses = arr.map(item => ({
        name: item.name,
        shortName: item.name,
        source: entity.source,
        features: [{ level: 3, name: item.name, text: item.text }]
      }));
    });
  }

  function renderClassLevelsMatrix(entity) {
    const matrixContainer = document.getElementById('class-levels-matrix');
    if (!matrixContainer) return;
    matrixContainer.innerHTML = '';

    if (!entity.levels) entity.levels = {};

    for (let lvl = 1; lvl <= 20; lvl++) {
      const hasFeatures = Array.isArray(entity.levels[lvl]) && entity.levels[lvl].length > 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `level-pill ${lvl === activeClassLevel ? 'active' : ''} ${hasFeatures ? 'has-features' : ''}`;
      btn.textContent = `Lvl ${lvl}`;
      btn.addEventListener('click', () => {
        activeClassLevel = lvl;
        renderClassLevelsMatrix(entity);
        renderActiveLevelFeatures(entity);
      });
      matrixContainer.appendChild(btn);
    }

    renderActiveLevelFeatures(entity);
  }

  function renderActiveLevelFeatures(entity) {
    const activeLabel = document.getElementById('active-level-label');
    if (activeLabel) activeLabel.textContent = `Level ${activeClassLevel} Features`;

    if (!entity.levels[activeClassLevel]) {
      entity.levels[activeClassLevel] = [];
    }

    renderCardBlockList('class-level-features-container', entity.levels[activeClassLevel], (arr) => {
      entity.levels[activeClassLevel] = arr;
      // Refresh pill indicator
      const pill = document.querySelectorAll('#class-levels-matrix .level-pill')[activeClassLevel - 1];
      if (pill) pill.classList.toggle('has-features', arr.length > 0);
    });
  }

  function readClassesForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseInt(document.getElementById(id)?.value, 10) || def;

    const rawSaves = getVal('bf-class-saves');
    const savingThrows = rawSaves ? rawSaves.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : ['STR', 'CON'];

    return {
      ...current,
      name: getVal('bf-class-name', 'New Class'),
      hitDie: getVal('bf-class-hit-die', 'd8'),
      savingThrows,
      armorProf: getVal('bf-class-armor'),
      weaponProf: getVal('bf-class-weapons'),
      subclassUnlockLevel: getNum('bf-class-subclass-level', 3)
    };
  }

  // --- RACES FORM ---
  function populateRacesForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('bf-race-name', entity.name);
    setVal('bf-race-size', entity.size || 'Medium');
    setVal('bf-race-speed', entity.speedWalk ?? 30);
    setVal('bf-race-darkvision', entity.darkvision ?? 60);
    setVal('bf-race-languages', entity.languages || 'Common');

    const scores = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    scores.forEach(s => {
      setVal(`bf-race-${s}`, entity.abilityIncreases?.[s] ?? 0);
    });

    renderCardBlockList('race-traits-container', entity.traits || [], (arr) => { entity.traits = arr; });
  }

  function readRacesForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseInt(document.getElementById(id)?.value, 10) || def;

    return {
      ...current,
      name: getVal('bf-race-name', 'New Race'),
      size: getVal('bf-race-size', 'Medium'),
      speedWalk: getNum('bf-race-speed', 30),
      darkvision: getNum('bf-race-darkvision', 60),
      languages: getVal('bf-race-languages', 'Common'),
      abilityIncreases: {
        str: getNum('bf-race-str', 0),
        dex: getNum('bf-race-dex', 0),
        con: getNum('bf-race-con', 0),
        int: getNum('bf-race-int', 0),
        wis: getNum('bf-race-wis', 0),
        cha: getNum('bf-race-cha', 0)
      }
    };
  }

  // --- FEATS FORM ---
  function populateFeatsForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('bf-feat-name', entity.name);
    setVal('bf-feat-prereq', entity.prerequisiteText || '');
    setVal('bf-feat-desc', entity.description || '');

    renderCardBlockList('feat-benefits-container', entity.benefits || [], (arr) => { entity.benefits = arr; });
  }

  function readFeatsForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    return {
      ...current,
      name: getVal('bf-feat-name', 'New Feat'),
      prerequisiteText: getVal('bf-feat-prereq'),
      description: getVal('bf-feat-desc')
    };
  }

  // --- BACKGROUNDS FORM ---
  function populateBackgroundsForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('bf-bg-name', entity.name);
    setVal('bf-bg-skills', entity.skillProficiencies || '');
    setVal('bf-bg-tools', entity.toolProficiencies || '');
    setVal('bf-bg-languages', entity.languages || '');
    setVal('bf-bg-equipment', entity.startingEquipment || '');
    setVal('bf-bg-feature-name', entity.featureName || '');
    setVal('bf-bg-feature-desc', entity.featureDescription || '');
  }

  function readBackgroundsForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    return {
      ...current,
      name: getVal('bf-bg-name', 'New Background'),
      skillProficiencies: getVal('bf-bg-skills'),
      toolProficiencies: getVal('bf-bg-tools'),
      languages: getVal('bf-bg-languages'),
      startingEquipment: getVal('bf-bg-equipment'),
      featureName: getVal('bf-bg-feature-name'),
      featureDescription: getVal('bf-bg-feature-desc')
    };
  }

  // --- ADVENTURES FORM ---
  function populateAdventuresForm(entity) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('bf-adv-name', entity.name);
    setVal('bf-adv-desc', entity.description || '');
  }

  function readAdventuresForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    return {
      ...current,
      name: getVal('bf-adv-name', 'New Adventure Note'),
      description: getVal('bf-adv-desc')
    };
  }

  // =========================================================================
  // CARD BLOCKS & QUICK-TAG INSERTION HELPER
  // =========================================================================
  function renderCardBlockList(containerId, itemsArray, onUpdate) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    itemsArray.forEach((item, idx) => {
      const block = document.createElement('div');
      block.className = 'card-block-item';
      block.innerHTML = `
        <div class="card-block-header">
          <input type="text" class="card-block-title-input" placeholder="Title / Name..." value="${escapeHtml(item.name || '')}" />
          <button type="button" class="btn-card-block-delete" title="Remove item">&times;</button>
        </div>
        <div class="card-block-body">
          <textarea class="card-block-textarea" rows="2" placeholder="Description / mechanical text...">${escapeHtml(item.text || '')}</textarea>
          <div class="quick-tags-bar">
            <span class="quick-tags-label">Quick Tag:</span>
            <button type="button" class="tag-pill" data-tag="{@damage 1d6}">{@damage}</button>
            <button type="button" class="tag-pill" data-tag="{@hit 4}">{@hit}</button>
            <button type="button" class="tag-pill" data-tag="{@dc 13}">{@dc}</button>
            <button type="button" class="tag-pill" data-tag="{@spell fireball}">{@spell}</button>
          </div>
        </div>
      `;

      const titleInput = block.querySelector('.card-block-title-input');
      const textarea = block.querySelector('.card-block-textarea');
      const btnDelete = block.querySelector('.btn-card-block-delete');

      titleInput.addEventListener('input', () => {
        itemsArray[idx].name = titleInput.value;
        onUpdate(itemsArray);
      });

      textarea.addEventListener('input', () => {
        itemsArray[idx].text = textarea.value;
        onUpdate(itemsArray);
      });

      btnDelete.addEventListener('click', () => {
        itemsArray.splice(idx, 1);
        onUpdate(itemsArray);
        renderCardBlockList(containerId, itemsArray, onUpdate);
      });

      // Quick tags insertion
      block.querySelectorAll('.tag-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const tagToInsert = pill.getAttribute('data-tag');
          insertTextAtCursor(textarea, tagToInsert);
          itemsArray[idx].text = textarea.value;
          onUpdate(itemsArray);
        });
      });

      container.appendChild(block);
    });
  }

  function insertTextAtCursor(textarea, textToInsert) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + textToInsert + after;
    textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
    textarea.focus();
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateAbilityModDisplay(inputId, modSpanId) {
    const input = document.getElementById(inputId);
    const span = document.getElementById(modSpanId);
    if (!input || !span) return;
    span.textContent = calcAbilityModifier(input.value);
  }

  // Hook ability score changes
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(s => {
    const input = document.getElementById(`bf-beast-${s}`);
    if (input) {
      input.addEventListener('input', () => updateAbilityModDisplay(`bf-beast-${s}`, `mod-beast-${s}`));
    }
  });

  // Card block Add buttons
  const addBlockMappings = [
    { btnId: 'btn-add-beast-trait', containerId: 'beast-traits-container', prop: 'traits', defaultName: 'New Trait' },
    { btnId: 'btn-add-beast-action', containerId: 'beast-actions-container', prop: 'actions', defaultName: 'New Action' },
    { btnId: 'btn-add-beast-reaction', containerId: 'beast-reactions-container', prop: 'reactions', defaultName: 'New Reaction' },
    { btnId: 'btn-add-beast-legendary', containerId: 'beast-legendary-container', prop: 'legendaryActions', defaultName: 'New Legendary Action' },
    { btnId: 'btn-add-level-feature', containerId: 'class-level-features-container', levelProp: true, defaultName: 'New Feature' },
    { btnId: 'btn-add-race-trait', containerId: 'race-traits-container', prop: 'traits', defaultName: 'New Racial Trait' },
    { btnId: 'btn-add-feat-benefit', containerId: 'feat-benefits-container', prop: 'benefits', defaultName: 'New Benefit' }
  ];

  addBlockMappings.forEach(({ btnId, containerId, prop, levelProp, defaultName }) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        if (activeEntityIndex < 0 || !activeSourceEntities[activeEntityIndex]) return;
        const entity = activeSourceEntities[activeEntityIndex];

        if (levelProp) {
          if (!entity.levels) entity.levels = {};
          if (!entity.levels[activeClassLevel]) entity.levels[activeClassLevel] = [];
          entity.levels[activeClassLevel].push({ name: defaultName, text: 'Feature effect details.' });
          renderActiveLevelFeatures(entity);
        } else {
          if (!entity[prop]) entity[prop] = [];
          entity[prop].push({ name: defaultName, text: 'Description of effect.' });
          renderCardBlockList(containerId, entity[prop], (arr) => { entity[prop] = arr; });
        }
      });
    }
  });

  // Token asset picker
  const btnBrowseToken = document.getElementById('btn-browse-token');
  if (btnBrowseToken) {
    btnBrowseToken.addEventListener('click', async () => {
      try {
        const res = await api.sourcesSelectAsset();
        if (res && res.success && res.filePath) {
          const input = document.getElementById('bf-beast-token-url');
          const preview = document.getElementById('bf-beast-token-preview');
          if (input) input.value = res.filePath;
          if (preview) {
            preview.innerHTML = `<img src="${res.filePath}" alt="Token" onerror="this.parentElement.textContent='🐉'" />`;
          }
        }
      } catch (err) {
        console.warn('Token asset picker cancelled or error:', err);
      }
    });
  }

  // Token URL text change
  const tokenUrlInput = document.getElementById('bf-beast-token-url');
  if (tokenUrlInput) {
    tokenUrlInput.addEventListener('input', () => {
      const preview = document.getElementById('bf-beast-token-preview');
      const val = tokenUrlInput.value.trim();
      if (preview) {
        if (val) {
          preview.innerHTML = `<img src="${val}" alt="Token" onerror="this.parentElement.textContent='🐉'" />`;
        } else {
          preview.textContent = '🐉';
        }
      }
    });
  }

  // =========================================================================
  // SAVING & ENTITY LIFECYCLE
  // =========================================================================
  function saveActiveEntity(showFeedback = true) {
    if (activeEntityIndex < 0 || !activeSourceEntities[activeEntityIndex]) return;

    const cat = activeEditingSource?.category || 'bestiary';
    let updatedEntity = null;

    if (activeStudioMode === 'json') {
      try {
        const parsed = JSON.parse(entityEntryJsonTextarea.value);
        updatedEntity = jsonToEntity(cat, parsed, activeEditingSource?.code || 'MYBREW');
      } catch (e) {
        alert('Cannot save active entry: JSON syntax error.');
        return;
      }
    } else {
      updatedEntity = readVisualForm(cat);
    }

    if (updatedEntity) {
      activeSourceEntities[activeEntityIndex] = updatedEntity;
      if (activeEntityDisplayName) activeEntityDisplayName.textContent = updatedEntity.name || 'Untitled Entry';
      renderEntitySidebarList();
      syncActiveEntityToJson();

      if (showFeedback && btnSaveActiveEntry) {
        const oldText = btnSaveActiveEntry.innerHTML;
        btnSaveActiveEntry.innerHTML = '✅ Entry Updated';
        btnSaveActiveEntry.style.borderColor = '#10b981';
        setTimeout(() => {
          btnSaveActiveEntry.innerHTML = oldText;
          btnSaveActiveEntry.style.borderColor = '';
        }, 1200);
      }
    }
  }

  if (btnSaveActiveEntry) {
    btnSaveActiveEntry.addEventListener('click', () => saveActiveEntity(true));
  }

  function addNewBlankEntity() {
    if (!activeEditingSource) return;
    const cat = activeEditingSource.category;
    const newEntity = createBlankEntity(cat, activeEditingSource.code);
    activeSourceEntities.push(newEntity);
    renderEntitySidebarList();
    selectActiveEntity(activeSourceEntities.length - 1);
  }

  function duplicateEntity(index) {
    if (index < 0 || index >= activeSourceEntities.length) return;
    const orig = activeSourceEntities[index];
    const dup = JSON.parse(JSON.stringify(orig));
    dup.id = `${catPrefix(activeEditingSource?.category)}_${Date.now()}`;
    dup.name = `${orig.name || 'Entry'} (Copy)`;
    activeSourceEntities.splice(index + 1, 0, dup);
    renderEntitySidebarList();
    selectActiveEntity(index + 1);
  }

  function catPrefix(cat) {
    switch (cat) {
      case 'bestiary': return 'creature';
      case 'spells': return 'spell';
      case 'items': return 'item';
      case 'classes': return 'class';
      case 'races': return 'race';
      case 'feats': return 'feat';
      case 'backgrounds': return 'background';
      case 'adventures': return 'adv';
      default: return 'entity';
    }
  }

  function deleteEntity(index) {
    if (index < 0 || index >= activeSourceEntities.length) return;
    const entity = activeSourceEntities[index];
    const confirmed = confirm(`Are you sure you want to delete "${entity.name || 'this entry'}"?`);
    if (!confirmed) return;

    activeSourceEntities.splice(index, 1);
    renderEntitySidebarList();

    if (activeSourceEntities.length === 0) {
      selectActiveEntity(-1);
    } else {
      const nextIdx = Math.min(index, activeSourceEntities.length - 1);
      selectActiveEntity(nextIdx);
    }
  }

  // Dropdown "+ Add Entry" menu
  if (btnAddEntryMenu) {
    btnAddEntryMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      menuAddEntryOptions?.classList.toggle('vtt-hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btn-add-entry-menu') && !e.target.closest('#menu-add-entry-options')) {
      menuAddEntryOptions?.classList.add('vtt-hidden');
    }
  });

  if (btnActionCreateBlank) {
    btnActionCreateBlank.addEventListener('click', () => {
      menuAddEntryOptions?.classList.add('vtt-hidden');
      addNewBlankEntity();
    });
  }

  // =========================================================================
  // CLONE FROM COMPENDIUM MODAL
  // =========================================================================
  let cloneDebounceTimer = null;

  if (btnActionCloneCompendium) {
    btnActionCloneCompendium.addEventListener('click', () => {
      menuAddEntryOptions?.classList.add('vtt-hidden');
      openCloneCompendiumModal();
    });
  }

  function openCloneCompendiumModal() {
    if (!modalCloneCompendium || !activeEditingSource) return;
    const cat = activeEditingSource.category;

    if (cloneCategoryBadge) cloneCategoryBadge.textContent = cat.toUpperCase();
    if (cloneCompendiumSearch) cloneCompendiumSearch.value = '';
    modalCloneCompendium.classList.remove('vtt-hidden');
    if (cloneCompendiumSearch) cloneCompendiumSearch.focus();

    performCompendiumSearch('');
  }

  const dismissCloneModal = () => {
    if (modalCloneCompendium) modalCloneCompendium.classList.add('vtt-hidden');
  };

  if (btnCloseCloneModal) btnCloseCloneModal.addEventListener('click', dismissCloneModal);
  if (btnCancelClone) btnCancelClone.addEventListener('click', dismissCloneModal);

  if (cloneCompendiumSearch) {
    cloneCompendiumSearch.addEventListener('input', () => {
      clearTimeout(cloneDebounceTimer);
      cloneDebounceTimer = setTimeout(() => {
        performCompendiumSearch(cloneCompendiumSearch.value.trim());
      }, 250);
    });
  }

  async function performCompendiumSearch(query) {
    if (!cloneCompendiumResults || !activeEditingSource) return;
    cloneCompendiumResults.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Searching 5e compendium catalog...</div>';

    try {
      const res = await api.sourcesSearchCompendium({
        category: activeEditingSource.category,
        query: query || '',
        limit: 35
      });

      if (!res || !res.success || !Array.isArray(res.results) || res.results.length === 0) {
        cloneCompendiumResults.innerHTML = `<div class="loading-placeholder">No compendium entries found for "${query}".</div>`;
        return;
      }

      cloneCompendiumResults.innerHTML = '';
      res.results.forEach(item => {
        const row = document.createElement('div');
        row.className = 'clone-result-card';
        row.innerHTML = `
          <div class="clone-card-info">
            <div class="clone-card-title">${escapeHtml(item.name || 'Unknown')}</div>
            <div class="clone-card-meta">
              <span class="clone-source-pill">${escapeHtml(item.source || 'SRD')}</span>
              ${item.details ? `<span class="clone-detail-pill">${escapeHtml(item.details)}</span>` : ''}
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-primary btn-clone-action">📥 Clone</button>
        `;

        const btnClone = row.querySelector('.btn-clone-action');
        btnClone.addEventListener('click', async () => {
          btnClone.disabled = true;
          btnClone.textContent = 'Cloning...';

          try {
            const detailRes = await api.sourcesGetEntityFull({
              category: activeEditingSource.category,
              name: item.name,
              source: item.source
            });

            if (detailRes && detailRes.success && detailRes.entity) {
              const cat = activeEditingSource.category;
              const converted = jsonToEntity(cat, detailRes.entity, activeEditingSource.code);
              converted.source = activeEditingSource.code;
              converted.name = `${converted.name} (Custom)`;

              activeSourceEntities.push(converted);
              dismissCloneModal();
              renderEntitySidebarList();
              selectActiveEntity(activeSourceEntities.length - 1);
            } else {
              alert(`Could not fetch full details for "${item.name}": ${detailRes?.error || 'Unknown error'}`);
              btnClone.disabled = false;
              btnClone.textContent = '📥 Clone';
            }
          } catch (e) {
            alert(`Error cloning entity: ${e.message}`);
            btnClone.disabled = false;
            btnClone.textContent = '📥 Clone';
          }
        });

        cloneCompendiumResults.appendChild(row);
      });
    } catch (err) {
      cloneCompendiumResults.innerHTML = `<div class="loading-placeholder text-danger">Search error: ${err.message}</div>`;
    }
  }

  // =========================================================================
  // SAVE ENTIRE SOURCEBOOK
  // =========================================================================
  if (btnEditModalSave) {
    btnEditModalSave.addEventListener('click', async () => {
      if (!activeEditingSource) return;

      // 1. Commit active entity form changes
      saveActiveEntity(false);

      // 2. Sync to raw source JSON editor
      syncSourceEntitiesToJsonEditor();

      // 3. Validate JSON syntax
      const isValidJson = validateJsonEditor();
      if (!isValidJson) {
        alert('Please fix JSON syntax errors before saving.');
        return;
      }

      btnEditModalSave.disabled = true;
      editSaveStatus.textContent = 'Saving changes...';

      try {
        const savePayload = {
          category: activeEditingSource.category,
          code: activeEditingSource.code,
          name: editSourceName.value.trim(),
          author: editSourceAuthor.value.trim(),
          version: editSourceVersion.value.trim(),
          description: editSourceDesc.value.trim(),
          rawJson: editSourceJsonEditor.value
        };

        const res = await api.sourcesSaveDetails(savePayload);
        if (res && res.success) {
          editSaveStatus.textContent = 'Saved successfully!';
          setTimeout(() => {
            modalEditSource.classList.add('vtt-hidden');
            loadAllSources();
          }, 400);
        } else {
          alert(`Failed to save source: ${res?.error || 'Unknown error'}`);
          btnEditModalSave.disabled = false;
          editSaveStatus.textContent = '';
        }
      } catch (err) {
        alert(`Error saving source: ${err.message}`);
        btnEditModalSave.disabled = false;
        editSaveStatus.textContent = '';
      }
    });
  }

  // Starter schema templates for homebrew snippets in Raw JSON tab
  const SOURCE_TEMPLATES = {
    bestiary: {
      name: "Custom Monster",
      source: "MYBREW",
      size: ["M"],
      type: "humanoid",
      alignment: ["A"],
      ac: [14],
      hp: { average: 32, formula: "5d8 + 10" },
      speed: { walk: 30 },
      str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10,
      cr: "1",
      trait: [
        { name: "Keen Senses", entries: ["The creature has advantage on Wisdom (Perception) checks."] }
      ],
      action: [
        { name: "Longsword", entries: ["{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}6 ({@damage 1d8 + 2}) slashing damage."] }
      ]
    },
    spells: {
      name: "Custom Spell",
      source: "MYBREW",
      level: 1,
      school: "V",
      time: [{ number: 1, unit: "action" }],
      range: { type: "point", distance: { type: "feet", amount: 60 } },
      components: { v: true, s: true },
      duration: [{ type: "instant" }],
      entries: ["You cast a concussive shockwave dealing {@damage 2d8} thunder damage to a target."]
    },
    items: {
      name: "Custom Item",
      source: "MYBREW",
      type: "W",
      rarity: "uncommon",
      reqAttune: true,
      entries: ["A finely forged weapon granting a +1 bonus to attack and damage rolls."]
    },
    feats: {
      name: "Custom Feat",
      source: "MYBREW",
      prerequisite: [{ level: 4 }],
      entries: [
        "Increase one ability score of your choice by 1, to a maximum of 20.",
        "You gain proficiency in one skill or tool of your choice."
      ]
    },
    backgrounds: {
      name: "Custom Background",
      source: "MYBREW",
      skillProficiencies: [{ athletics: true, survival: true }],
      entries: ["You spent your youth exploring the untamed wild."]
    },
    races: {
      name: "Custom Race",
      source: "MYBREW",
      size: ["M"],
      speed: { walk: 30 },
      ability: [{ con: 2, wis: 1 }],
      entries: ["A versatile and hardy folk."]
    },
    classes: {
      name: "Custom Class",
      source: "MYBREW",
      hd: { number: 1, faces: 8 },
      proficiency: ["con", "int"],
      entries: ["Masters of esoteric battlefield techniques."]
    }
  };

  if (btnInsertTemplate) {
    btnInsertTemplate.addEventListener('click', () => {
      const cat = activeEditingSource?.category || 'bestiary';
      const code = activeEditingSource?.code || 'MYBREW';
      const templateObj = JSON.parse(JSON.stringify(SOURCE_TEMPLATES[cat] || {
        name: "Custom Entry",
        source: code,
        entries: ["Custom entry details."]
      }));
      templateObj.source = code;

      try {
        const text = editSourceJsonEditor.value.trim();
        let parsed = text ? JSON.parse(text) : null;

        if (Array.isArray(parsed)) {
          parsed.push(templateObj);
          editSourceJsonEditor.value = JSON.stringify(parsed, null, 2);
        } else if (parsed && typeof parsed === 'object') {
          const arrKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
          if (arrKey) {
            parsed[arrKey].push(templateObj);
          } else {
            parsed.items = [templateObj];
          }
          editSourceJsonEditor.value = JSON.stringify(parsed, null, 2);
        } else {
          editSourceJsonEditor.value = JSON.stringify([templateObj], null, 2);
        }
        validateJsonEditor();
      } catch (err) {
        const snippet = ',\n' + JSON.stringify(templateObj, null, 2);
        const start = editSourceJsonEditor.selectionStart || editSourceJsonEditor.value.length;
        const end = editSourceJsonEditor.selectionEnd || editSourceJsonEditor.value.length;
        editSourceJsonEditor.value = editSourceJsonEditor.value.substring(0, start) + snippet + editSourceJsonEditor.value.substring(end);
        validateJsonEditor();
      }
    });
  }

  if (btnFormatJson) {
    btnFormatJson.addEventListener('click', () => {
      try {
        const text = editSourceJsonEditor.value;
        const parsed = JSON.parse(text);
        editSourceJsonEditor.value = JSON.stringify(parsed, null, 2);
        validateJsonEditor();
      } catch (err) {
        alert('Cannot format invalid JSON. Please fix syntax errors first.');
      }
    });
  }

  function validateJsonEditor() {
    if (!editSourceJsonEditor) return false;
    const text = editSourceJsonEditor.value.trim();

    try {
      const parsed = JSON.parse(text);
      if (jsonSyntaxStatus) {
        jsonSyntaxStatus.textContent = '✅ Valid JSON';
        jsonSyntaxStatus.className = 'json-status-tag';
      }
      if (jsonErrorBanner) jsonErrorBanner.classList.add('vtt-hidden');

      let count = 0;
      if (Array.isArray(parsed)) count = parsed.length;
      else if (typeof parsed === 'object' && parsed !== null) {
        const primary = Object.values(parsed).find(v => Array.isArray(v));
        if (primary) count = primary.length;
      }
      if (jsonEntryCounter) jsonEntryCounter.textContent = `${count} entries`;
      if (btnEditModalSave) btnEditModalSave.disabled = false;
      return true;
    } catch (err) {
      if (jsonSyntaxStatus) {
        jsonSyntaxStatus.textContent = '❌ Syntax Error';
        jsonSyntaxStatus.className = 'json-status-tag invalid';
      }
      if (jsonErrorMessage) jsonErrorMessage.textContent = err.message;
      if (jsonErrorBanner) jsonErrorBanner.classList.remove('vtt-hidden');
      if (btnEditModalSave) btnEditModalSave.disabled = true;
      return false;
    }
  }

  if (editSourceJsonEditor) {
    editSourceJsonEditor.addEventListener('input', validateJsonEditor);
    editSourceJsonEditor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (btnEditModalSave && !btnEditModalSave.disabled) {
          btnEditModalSave.click();
        }
      }
    });
  }

  const dismissEditModal = () => {
    if (modalEditSource) modalEditSource.classList.add('vtt-hidden');
    activeEditingSource = null;
    activeSourceEntities = [];
    activeSourceRawData = null;
    activeEntityIndex = -1;
  };

  if (btnEditModalClose) btnEditModalClose.addEventListener('click', dismissEditModal);
  if (btnEditModalCancel) btnEditModalCancel.addEventListener('click', dismissEditModal);

  // =========================================================================
  // CREATE CUSTOM SOURCE MODAL LOGIC
  // =========================================================================
  function openCreateCustomModal(category = 'bestiary') {
    if (!modalCreateCustomSource) return;
    if (createSrcCategory) createSrcCategory.value = category;
    if (createSrcCode) createSrcCode.value = '';
    if (createSrcName) createSrcName.value = '';
    if (createSrcAuthor) createSrcAuthor.value = '';
    if (createSrcDesc) createSrcDesc.value = '';
    modalCreateCustomSource.classList.remove('vtt-hidden');
    if (createSrcCode) createSrcCode.focus();
  }

  const dismissCreateSourceModal = () => {
    if (modalCreateCustomSource) modalCreateCustomSource.classList.add('vtt-hidden');
  };

  if (btnCreateSourceClose) btnCreateSourceClose.addEventListener('click', dismissCreateSourceModal);
  if (btnCreateSourceCancel) btnCreateSourceCancel.addEventListener('click', dismissCreateSourceModal);

  if (btnCreateSourceSubmit) {
    btnCreateSourceSubmit.addEventListener('click', async () => {
      const cat = createSrcCategory.value;
      const code = createSrcCode.value.trim();
      const name = createSrcName.value.trim();
      const author = createSrcAuthor.value.trim();
      const desc = createSrcDesc.value.trim();

      if (!code) {
        alert('Please specify a Source Code (e.g. MYBREW).');
        return;
      }

      btnCreateSourceSubmit.disabled = true;
      btnCreateSourceSubmit.textContent = 'Creating...';

      try {
        const res = await api.sourcesCreateCustom({
          category: cat,
          code,
          name: name || code,
          author: author || 'Homebrew Creator',
          description: desc
        });

        if (res.success) {
          dismissCreateSourceModal();
          await loadAllSources();
          // Open directly in edit modal
          openEditSourceModal(cat, res.source.code);
        } else {
          alert(`Failed to create source: ${res.error}`);
        }
      } catch (err) {
        alert(`Error creating custom source: ${err.message}`);
      } finally {
        btnCreateSourceSubmit.disabled = false;
        btnCreateSourceSubmit.textContent = '✨ Create & Start Editing';
      }
    });
  }

  // =========================================================================
  // MAXIMIZE / RESTORE MODAL HANDLER
  // =========================================================================
  if (btnToggleMaximizeModal && modalEditSource) {
    const modalDialog = modalEditSource.querySelector('.modal-card.modal-studio');
    btnToggleMaximizeModal.addEventListener('click', () => {
      if (!modalDialog) return;
      const isMax = modalDialog.classList.toggle('maximized');
      btnToggleMaximizeModal.textContent = isMax ? '❐ Restore' : '⛶ Maximize';
      btnToggleMaximizeModal.title = isMax ? 'Restore to default size' : 'Expand to full screen';
    });
  }

  // =========================================================================
  // GLOBAL COMPENDIUM SEARCH & STATBLOCK PREVIEW
  // =========================================================================
  const categoryIcons = {
    bestiary: '🐉',
    spells: '✨',
    items: '⚔️',
    classes: '🛡️',
    races: '🧝',
    feats: '🎖️',
    backgrounds: '📜',
    adventures: '🗺️'
  };

  if (globalSearchCategoryChips) {
    globalSearchCategoryChips.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        globalSearchCategoryChips.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeGlobalCatFilter = chip.getAttribute('data-cat') || '';
        performGlobalSearch();
      });
    });
  }

  if (globalCompendiumSearchInput) {
    globalCompendiumSearchInput.addEventListener('input', () => {
      const q = globalCompendiumSearchInput.value.trim();
      if (btnClearGlobalSearch) {
        if (q) btnClearGlobalSearch.classList.remove('vtt-hidden');
        else btnClearGlobalSearch.classList.add('vtt-hidden');
      }
      clearTimeout(globalSearchDebounceTimer);
      globalSearchDebounceTimer = setTimeout(() => {
        performGlobalSearch();
      }, 250);
    });

    globalCompendiumSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        globalCompendiumSearchInput.value = '';
        if (btnClearGlobalSearch) btnClearGlobalSearch.classList.add('vtt-hidden');
        performGlobalSearch();
      }
    });
  }

  if (btnClearGlobalSearch) {
    btnClearGlobalSearch.addEventListener('click', () => {
      if (globalCompendiumSearchInput) globalCompendiumSearchInput.value = '';
      btnClearGlobalSearch.classList.add('vtt-hidden');
      performGlobalSearch();
    });
  }

  async function performGlobalSearch() {
    if (!globalSearchResultsPanel) return;
    const query = globalCompendiumSearchInput?.value.trim() || '';

    if (!query) {
      globalSearchResultsPanel.innerHTML = `
        <div class="search-empty-prompt">
          <span class="icon">🔍</span>
          <p>Type a query above to search across active Monsters, Spells, Items, Classes, and more.</p>
        </div>
      `;
      return;
    }

    globalSearchResultsPanel.innerHTML = `
      <div class="search-loading-prompt">
        <span class="spinner">⏳</span> Searching compendium for "<strong>${escapeHtml(query)}</strong>"...
      </div>
    `;

    try {
      const res = await api.sourcesSearchGlobal({
        query,
        category: activeGlobalCatFilter || undefined,
        limit: 50
      });

      if (!res || !res.success || !res.results || res.results.length === 0) {
        globalSearchResultsPanel.innerHTML = `
          <div class="search-empty-prompt">
            <span class="icon">🏜️</span>
            <p>No matching entities found for "<strong>${escapeHtml(query)}</strong>"${activeGlobalCatFilter ? ` in ${activeGlobalCatFilter}` : ''}.</p>
          </div>
        `;
        return;
      }

      let html = `
        <div class="search-results-table-wrap">
          <table class="search-results-table">
            <thead>
              <tr>
                <th style="width: 110px;">Category</th>
                <th>Name</th>
                <th style="width: 140px;">Type / Level / CR</th>
                <th style="width: 90px;">Source</th>
                <th style="width: 100px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      res.results.forEach(item => {
        const icon = categoryIcons[item.category] || '📖';
        const typeInfo = item.cr ? `CR ${item.cr}` : (item.level !== undefined ? `Level ${item.level}` : (item.type || '—'));
        html += `
          <tr class="search-result-row" data-category="${escapeHtml(item.category)}" data-name="${escapeHtml(item.name)}" data-source="${escapeHtml(item.source)}">
            <td><span class="result-cat-badge">${icon} ${escapeHtml(item.category)}</span></td>
            <td><strong class="result-name-text">${escapeHtml(item.name)}</strong></td>
            <td class="result-meta-text">${escapeHtml(typeInfo)}</td>
            <td><span class="badge badge-source">${escapeHtml(item.source)}</span></td>
            <td style="text-align: right;">
              <button type="button" class="btn btn-xs btn-primary btn-preview-statblock" title="Quick Preview">👁️ Preview</button>
            </td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;

      globalSearchResultsPanel.innerHTML = html;

      globalSearchResultsPanel.querySelectorAll('.search-result-row').forEach(row => {
        const category = row.getAttribute('data-category');
        const name = row.getAttribute('data-name');
        const source = row.getAttribute('data-source');

        row.addEventListener('click', () => {
          openStatblockPreviewDrawer(category, name, source);
        });
      });
    } catch (err) {
      globalSearchResultsPanel.innerHTML = `
        <div class="search-empty-prompt error">
          <p>Failed to perform compendium search: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  // --- STATBLOCK PREVIEW DRAWER ---
  async function openStatblockPreviewDrawer(category, name, source) {
    if (!drawerStatblockPreview || !statblockDrawerBackdrop) return;
    activePreviewTarget = { category, name, source };

    if (sbDrawerCatBadge) sbDrawerCatBadge.textContent = `${categoryIcons[category] || '📖'} ${category.toUpperCase()}`;
    if (sbDrawerTitle) sbDrawerTitle.textContent = name;
    if (sbDrawerSourceText) sbDrawerSourceText.textContent = `Sourcebook: ${source}`;
    if (sbDrawerContent) {
      sbDrawerContent.innerHTML = '<div class="drawer-loading"><span class="spinner">⏳</span> Generating preview...</div>';
    }

    statblockDrawerBackdrop.classList.remove('vtt-hidden');
    drawerStatblockPreview.classList.add('open');

    try {
      const res = await api.sourcesGetPreview({ category, name, source });
      if (!res || !res.success || !res.statblock) {
        if (sbDrawerContent) {
          sbDrawerContent.innerHTML = `<div class="drawer-error">Unable to load statblock preview for "${escapeHtml(name)}".</div>`;
        }
        return;
      }
      renderDrawerStatblock(category, res.statblock);
    } catch (e) {
      if (sbDrawerContent) {
        sbDrawerContent.innerHTML = `<div class="drawer-error">Error: ${escapeHtml(e.message)}</div>`;
      }
    }
  }

  function closeStatblockPreviewDrawer() {
    if (drawerStatblockPreview) drawerStatblockPreview.classList.remove('open');
    if (statblockDrawerBackdrop) statblockDrawerBackdrop.classList.add('vtt-hidden');
    activePreviewTarget = null;
  }

  if (btnCloseSbDrawer) btnCloseSbDrawer.addEventListener('click', closeStatblockPreviewDrawer);
  if (statblockDrawerBackdrop) statblockDrawerBackdrop.addEventListener('click', closeStatblockPreviewDrawer);

  if (btnDrawerOpenEditor) {
    btnDrawerOpenEditor.addEventListener('click', async () => {
      if (!activePreviewTarget) return;
      const { category, name, source } = activePreviewTarget;
      closeStatblockPreviewDrawer();

      await openEditSourceModal(category, source);

      if (activeSourceEntities && activeSourceEntities.length > 0) {
        const targetIdx = activeSourceEntities.findIndex(e =>
          (e.name || '').toLowerCase() === name.toLowerCase()
        );
        if (targetIdx >= 0) {
          selectActiveEntity(targetIdx);
        }
      }
    });
  }

  function renderDrawerStatblock(category, sb) {
    if (!sbDrawerContent) return;

    if (category === 'bestiary') {
      const abilityBox = (lbl, val) => `
        <div class="sb-stat-box">
          <span class="sb-stat-label">${lbl}</span>
          <span class="sb-stat-val">${val || 10}</span>
          <span class="sb-stat-mod">(${calcAbilityModifier(val || 10)})</span>
        </div>
      `;

      let html = `
        <div class="statblock-container">
          <div class="sb-header">
            <h2 class="sb-name">${escapeHtml(sb.name || 'Unknown')}</h2>
            <div class="sb-meta-line">${escapeHtml(sb.size || 'Medium')} ${escapeHtml(sb.type || 'creature')}, ${escapeHtml(sb.alignment || 'unaligned')}</div>
          </div>
          <div class="sb-divider-red"></div>
          <div class="sb-vitals">
            <div><strong>Armor Class:</strong> ${sb.ac || 10} ${sb.acCondition ? `(${escapeHtml(sb.acCondition)})` : ''}</div>
            <div><strong>Hit Points:</strong> ${sb.hpAvg || 10} ${sb.hpFormula ? `(${escapeHtml(sb.hpFormula)})` : ''}</div>
            <div><strong>Speed:</strong> ${formatSpeed(sb)}</div>
          </div>
          <div class="sb-divider-red"></div>
          <div class="sb-ability-grid">
            ${abilityBox('STR', sb.str)}
            ${abilityBox('DEX', sb.dex)}
            ${abilityBox('CON', sb.con)}
            ${abilityBox('INT', sb.int)}
            ${abilityBox('WIS', sb.wis)}
            ${abilityBox('CHA', sb.cha)}
          </div>
          <div class="sb-divider-red"></div>
          <div class="sb-details">
            ${sb.senses ? `<div><strong>Senses:</strong> ${escapeHtml(sb.senses)}</div>` : ''}
            ${sb.languages ? `<div><strong>Languages:</strong> ${escapeHtml(sb.languages)}</div>` : ''}
            <div><strong>Challenge:</strong> ${sb.cr || '0'}</div>
          </div>
      `;

      if (sb.traits && sb.traits.length > 0) {
        html += `<div class="sb-section-title">Traits</div>`;
        sb.traits.forEach(t => {
          html += `<div class="sb-entry"><strong>${escapeHtml(t.name)}.</strong> ${escapeHtml(t.text || '')}</div>`;
        });
      }

      if (sb.actions && sb.actions.length > 0) {
        html += `<div class="sb-section-title">Actions</div>`;
        sb.actions.forEach(a => {
          html += `<div class="sb-entry"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.text || '')}</div>`;
        });
      }

      if (sb.reactions && sb.reactions.length > 0) {
        html += `<div class="sb-section-title">Reactions</div>`;
        sb.reactions.forEach(r => {
          html += `<div class="sb-entry"><strong>${escapeHtml(r.name)}.</strong> ${escapeHtml(r.text || '')}</div>`;
        });
      }

      if (sb.legendaryActions && sb.legendaryActions.length > 0) {
        html += `<div class="sb-section-title">Legendary Actions</div>`;
        sb.legendaryActions.forEach(l => {
          html += `<div class="sb-entry"><strong>${escapeHtml(l.name)}.</strong> ${escapeHtml(l.text || '')}</div>`;
        });
      }

      html += `</div>`;
      sbDrawerContent.innerHTML = html;
      return;
    }

    if (category === 'spells') {
      const comps = [];
      if (sb.componentV) comps.push('V');
      if (sb.componentS) comps.push('S');
      if (sb.componentM) comps.push(`M (${sb.materialsText || ''})`);

      sbDrawerContent.innerHTML = `
        <div class="statblock-container">
          <div class="sb-header">
            <h2 class="sb-name">${escapeHtml(sb.name || 'Spell')}</h2>
            <div class="sb-meta-line">${sb.level === 0 ? 'Cantrip' : `Level ${sb.level}`} ${escapeHtml(sb.school || 'Evocation')}</div>
          </div>
          <div class="sb-divider-red"></div>
          <div class="sb-vitals">
            <div><strong>Casting Time:</strong> ${sb.castingTimeNum || 1} ${escapeHtml(sb.castingTimeUnit || 'action')}</div>
            <div><strong>Range:</strong> ${sb.rangeDistance || ''} ${escapeHtml(sb.rangeType || 'feet')}</div>
            <div><strong>Components:</strong> ${comps.join(', ') || 'None'}</div>
            <div><strong>Duration:</strong> ${sb.isConcentration ? 'Concentration, up to ' : ''}${sb.durationAmount || 1} ${escapeHtml(sb.durationUnit || 'instant')}</div>
            ${sb.classes?.length ? `<div><strong>Classes:</strong> ${escapeHtml(sb.classes.join(', '))}</div>` : ''}
          </div>
          <div class="sb-divider-red"></div>
          <div class="sb-entry-desc">${escapeHtml(sb.description || '')}</div>
          ${sb.higherLevelsDesc ? `<div class="sb-entry mt-12"><strong>At Higher Levels:</strong> ${escapeHtml(sb.higherLevelsDesc)}</div>` : ''}
        </div>
      `;
      return;
    }

    // Default generic representation
    sbDrawerContent.innerHTML = `
      <div class="statblock-container">
        <div class="sb-header">
          <h2 class="sb-name">${escapeHtml(sb.name || 'Entry')}</h2>
          <div class="sb-meta-line">${escapeHtml(category.toUpperCase())}</div>
        </div>
        <div class="sb-divider-red"></div>
        <div class="sb-entry-desc">${escapeHtml(sb.description || sb.entries?.join('\n\n') || JSON.stringify(sb, null, 2))}</div>
      </div>
    `;
  }

  function formatSpeed(sb) {
    const parts = [`${sb.speedWalk || 30} ft.`];
    if (sb.speedFly) parts.push(`fly ${sb.speedFly} ft.`);
    if (sb.speedSwim) parts.push(`swim ${sb.speedSwim} ft.`);
    if (sb.speedClimb) parts.push(`climb ${sb.speedClimb} ft.`);
    if (sb.speedBurrow) parts.push(`burrow ${sb.speedBurrow} ft.`);
    return parts.join(', ');
  }

  // =========================================================================
  // BULK SOURCEBOOK IMPORT WIZARD & CONFLICT HANDLING
  // =========================================================================
  function openBulkImportWizard() {
    if (!modalBulkImport) return;
    currentBulkCandidates = [];
    if (bulkPreviewTableBody) {
      bulkPreviewTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-16">
            No files loaded yet. Drop files or use the browse buttons above.
          </td>
        </tr>
      `;
    }
    if (bulkFilesCountBadge) bulkFilesCountBadge.textContent = '0';
    if (bulkImportBtnCount) bulkImportBtnCount.textContent = '0';
    if (bulkImportStatusText) bulkImportStatusText.textContent = 'Ready for files or archives.';
    if (btnExecuteBulkImport) btnExecuteBulkImport.disabled = true;
    if (bulkTargetSourceCode) bulkTargetSourceCode.value = '';
    modalBulkImport.classList.remove('vtt-hidden');
  }

  function closeBulkImportWizard() {
    if (modalBulkImport) modalBulkImport.classList.add('vtt-hidden');
    currentBulkCandidates = [];
  }

  if (btnOpenBulkImport) btnOpenBulkImport.addEventListener('click', openBulkImportWizard);
  if (btnCloseBulkImport) btnCloseBulkImport.addEventListener('click', closeBulkImportWizard);
  if (btnCancelBulkImport) btnCancelBulkImport.addEventListener('click', closeBulkImportWizard);

  // File / Folder / Zip browse triggers
  if (btnBrowseImportFiles) {
    btnBrowseImportFiles.addEventListener('click', async () => {
      try {
        const res = await api.sourcesSelectImportFiles();
        if (res && res.success && res.filePaths?.length > 0) {
          await processBulkPaths(res.filePaths);
        }
      } catch (err) {
        alert(`Failed to select files: ${err.message}`);
      }
    });
  }

  if (btnBrowseImportFolder) {
    btnBrowseImportFolder.addEventListener('click', async () => {
      try {
        const res = await api.sourcesSelectImportFolder();
        if (res && res.success && res.folderPath) {
          await processBulkPaths([res.folderPath]);
        }
      } catch (err) {
        alert(`Failed to select folder: ${err.message}`);
      }
    });
  }

  if (btnBrowseImportZip) {
    btnBrowseImportZip.addEventListener('click', async () => {
      try {
        const res = await api.sourcesSelectImportFiles();
        if (res && res.success && res.filePaths?.length > 0) {
          await processBulkPaths(res.filePaths);
        }
      } catch (err) {
        alert(`Failed to select archive: ${err.message}`);
      }
    });
  }

  // Drag and drop
  if (bulkDropZone) {
    ['dragenter', 'dragover'].forEach(evt => {
      bulkDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkDropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      bulkDropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkDropZone.classList.remove('drag-over');
      });
    });

    bulkDropZone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files || dt.files.length === 0) return;
      const paths = [];
      for (let i = 0; i < dt.files.length; i++) {
        if (dt.files[i].path) {
          paths.push(dt.files[i].path);
        }
      }
      if (paths.length > 0) {
        await processBulkPaths(paths);
      }
    });
  }

  async function processBulkPaths(paths) {
    if (!bulkImportStatusText) return;
    bulkImportStatusText.textContent = `Inspecting ${paths.length} path(s)...`;
    if (btnExecuteBulkImport) btnExecuteBulkImport.disabled = true;

    try {
      const res = await api.sourcesInspectBulk(paths);
      if (!res || !res.success || !res.candidates || res.candidates.length === 0) {
        bulkImportStatusText.textContent = 'No valid JSON files or 5eTools compendium data found in selection.';
        return;
      }

      currentBulkCandidates = res.candidates;
      renderBulkPreviewTable();
    } catch (err) {
      bulkImportStatusText.textContent = `Error inspecting files: ${err.message}`;
    }
  }

  function renderBulkPreviewTable() {
    if (!bulkPreviewTableBody) return;
    bulkPreviewTableBody.innerHTML = '';

    const categories = ['bestiary', 'spells', 'items', 'classes', 'races', 'feats', 'backgrounds', 'adventures'];

    currentBulkCandidates.forEach((cand, idx) => {
      const tr = document.createElement('tr');
      tr.className = `bulk-candidate-row ${cand.hasConflict ? 'row-conflict' : ''}`;

      const catOptionsHtml = categories.map(c =>
        `<option value="${c}" ${c === cand.detectedCategory ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
      ).join('');

      let conflictBadge = '';
      if (cand.hasConflict) {
        const decisionLabel = cand.conflictDecision || 'Duplicate';
        conflictBadge = `<span class="badge badge-conflict conflict-pill" data-idx="${idx}" title="Click to configure conflict action">⚠️ ${decisionLabel}</span>`;
      } else {
        conflictBadge = `<span class="badge badge-success">✨ Ready</span>`;
      }

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="cand-select-checkbox" data-idx="${idx}" ${cand.selected !== false ? 'checked' : ''} />
        </td>
        <td>
          <div class="cand-filename" title="${escapeHtml(cand.originalPath)}">${escapeHtml(cand.fileName)}</div>
        </td>
        <td>
          <select class="form-control cand-cat-select" data-idx="${idx}">
            ${catOptionsHtml}
          </select>
        </td>
        <td>
          <input type="text" class="form-control cand-source-input" data-idx="${idx}" value="${escapeHtml(cand.detectedSource || '')}" style="font-family: monospace; text-transform: uppercase;" />
        </td>
        <td style="text-align: right;">
          <span class="badge badge-count">${cand.entryCount}</span>
        </td>
        <td>
          ${conflictBadge}
        </td>
      `;

      tr.querySelector('.cand-select-checkbox').addEventListener('change', (e) => {
        cand.selected = e.target.checked;
        updateBulkCounters();
      });

      tr.querySelector('.cand-cat-select').addEventListener('change', (e) => {
        cand.detectedCategory = e.target.value;
      });

      tr.querySelector('.cand-source-input').addEventListener('input', (e) => {
        cand.detectedSource = e.target.value.trim().toUpperCase();
      });

      const pill = tr.querySelector('.conflict-pill');
      if (pill) {
        pill.addEventListener('click', () => {
          promptSingleConflictResolution(cand, idx);
        });
      }

      bulkPreviewTableBody.appendChild(tr);
    });

    updateBulkCounters();
  }

  function updateBulkCounters() {
    const selected = currentBulkCandidates.filter(c => c.selected !== false);
    const count = selected.length;
    if (bulkFilesCountBadge) bulkFilesCountBadge.textContent = count;
    if (bulkImportBtnCount) bulkImportBtnCount.textContent = count;
    if (btnExecuteBulkImport) btnExecuteBulkImport.disabled = count === 0;

    const conflictCount = selected.filter(c => c.hasConflict).length;
    if (bulkImportStatusText) {
      if (conflictCount > 0) {
        bulkImportStatusText.textContent = `Found ${conflictCount} duplicate conflict(s). Review conflict strategy above or click status pills.`;
      } else {
        bulkImportStatusText.textContent = `${count} sourcebook(s) ready to import.`;
      }
    }
  }

  if (bulkSelectAllCheckbox) {
    bulkSelectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      currentBulkCandidates.forEach(cand => { cand.selected = isChecked; });
      const checkboxes = bulkPreviewTableBody?.querySelectorAll('.cand-select-checkbox');
      checkboxes?.forEach(cb => { cb.checked = isChecked; });
      updateBulkCounters();
    });
  }

  if (bulkTargetSourceCode) {
    bulkTargetSourceCode.addEventListener('input', () => {
      const masterCode = bulkTargetSourceCode.value.trim().toUpperCase();
      if (!masterCode) return;
      currentBulkCandidates.forEach(cand => {
        cand.detectedSource = masterCode;
      });
      bulkPreviewTableBody?.querySelectorAll('.cand-source-input').forEach(inp => {
        inp.value = masterCode;
      });
    });
  }

  // Conflict modal handler
  let pendingConflictPromise = null;
  function promptSingleConflictResolution(cand, idx) {
    if (!modalImportConflict) return;
    if (conflictFilenameDisplay) conflictFilenameDisplay.textContent = cand.fileName;
    if (conflictCategoryDisplay) conflictCategoryDisplay.textContent = cand.detectedCategory;
    if (conflictRenamePreview) conflictRenamePreview.textContent = `${cand.detectedSource}_copy`;

    modalImportConflict.classList.remove('vtt-hidden');

    return new Promise((resolve) => {
      pendingConflictPromise = resolve;
    });
  }

  if (btnConfirmConflictChoice) {
    btnConfirmConflictChoice.addEventListener('click', () => {
      const selectedRadio = modalImportConflict.querySelector('input[name="conflict-choice"]:checked');
      const choice = selectedRadio ? selectedRadio.value : 'rename';
      const applyToAll = conflictApplyToAll?.checked;

      if (applyToAll) {
        currentBulkCandidates.forEach(c => {
          if (c.hasConflict) c.conflictDecision = choice;
        });
      }

      modalImportConflict.classList.add('vtt-hidden');
      renderBulkPreviewTable();

      if (pendingConflictPromise) {
        pendingConflictPromise(choice);
        pendingConflictPromise = null;
      }
    });
  }

  // Execute Bulk Import
  if (btnExecuteBulkImport) {
    btnExecuteBulkImport.addEventListener('click', async () => {
      const selected = currentBulkCandidates.filter(c => c.selected !== false);
      if (selected.length === 0) return;

      const defaultMode = bulkConflictDefaultMode?.value || 'rename';
      const conflictDecisions = {};

      selected.forEach((cand) => {
        if (cand.hasConflict) {
          conflictDecisions[cand.originalPath || cand.fileName] = cand.conflictDecision || (defaultMode === 'prompt' ? 'rename' : defaultMode);
        }
      });

      btnExecuteBulkImport.disabled = true;
      btnExecuteBulkImport.textContent = 'Importing...';
      if (bulkImportStatusText) bulkImportStatusText.textContent = 'Importing sourcebooks into database...';

      try {
        const res = await api.sourcesExecuteBulkImport({
          candidates: selected,
          conflictDecisions
        });

        if (res && res.success) {
          closeBulkImportWizard();
          await loadAllSources();
          alert(`Successfully imported ${res.importedCount || selected.length} sourcebook(s)!`);
        } else {
          alert(`Import encountered an issue: ${res?.error || 'Unknown error'}`);
        }
      } catch (err) {
        alert(`Error executing bulk import: ${err.message}`);
      } finally {
        btnExecuteBulkImport.disabled = false;
        btnExecuteBulkImport.innerHTML = `🚀 Import All (<span id="bulk-import-btn-count">${selected.length}</span> Files)`;
      }
    });
  }

  btnClearLogs.addEventListener('click', () => {
    logTerminal.innerHTML = '';
  });
});

