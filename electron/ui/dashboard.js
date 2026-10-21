import {
  calcAbilityModifier,
  createBlankEntity,
  entityToJson,
  jsonToEntity,
  ARCHETYPE_TEMPLATES,
  createEntityFromArchetype,
  parsePlaintextStatblock,
  CR_BENCHMARKS,
  VTTEntryResolver,
  toCommaSeparatedString
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
  const btnGmImportCampaign = document.getElementById('btn-gm-import-campaign');
  const btnDuplicateCampaign = document.getElementById('btn-duplicate-campaign');
  const btnExportCampaign = document.getElementById('btn-export-campaign');
  const statEntitiesCount = document.getElementById('stat-entities-count');

  const entityTabBtns = document.querySelectorAll('.entity-tab-btn');
  const entityPanels = document.querySelectorAll('.entity-panel');

  const entityCountMaps = document.getElementById('entity-count-maps');
  const entityCountPlayers = document.getElementById('entity-count-players');
  const entityCountCompanions = document.getElementById('entity-count-companions');
  const entityCountNpcs = document.getElementById('entity-count-npcs');

  const gridCampaignMaps = document.getElementById('grid-campaign-maps');
  const gridCampaignPlayers = document.getElementById('grid-campaign-players');
  const gridCampaignCompanions = document.getElementById('grid-campaign-companions');
  const gridCampaignNpcs = document.getElementById('grid-campaign-npcs');

  const btnImportMap = document.getElementById('btn-import-map');
  const btnExportAllMaps = document.getElementById('btn-export-all-maps');

  const btnImportPlayer = document.getElementById('btn-import-player');
  const btnExportAllPlayers = document.getElementById('btn-export-all-players');

  const btnImportCompanion = document.getElementById('btn-import-companion');
  const btnExportAllCompanions = document.getElementById('btn-export-all-companions');

  const btnImportNpc = document.getElementById('btn-import-npc');
  const btnExportAllNpcs = document.getElementById('btn-export-all-npcs');

  const gmDropzoneOverlay = document.getElementById('gm-dropzone-overlay');

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
  let selectedCampaignFull = null;
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
    refreshSelectedCampaignEntities();
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
    clearCampaignEntities();
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

  // --- ENTITY TABS SWITCHING ---
  entityTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      entityTabBtns.forEach(b => b.classList.remove('active'));
      entityPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-entity-target');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // --- ENTITY RENDERING & MANAGEMENT ---
  async function refreshSelectedCampaignEntities() {
    if (!selectedCampaign) {
      clearCampaignEntities();
      return;
    }
    try {
      const res = await api.gmGetCampaignDetails(selectedCampaign.id);
      if (res && res.success && res.campaign) {
        selectedCampaignFull = res.campaign;
        renderCampaignEntities(selectedCampaignFull);
      }
    } catch (err) {
      console.error('Failed refreshing campaign entities:', err);
    }
  }

  function clearCampaignEntities() {
    selectedCampaignFull = null;
    if (gridCampaignMaps) gridCampaignMaps.innerHTML = '<div class="entity-empty-note">No campaign selected</div>';
    if (gridCampaignPlayers) gridCampaignPlayers.innerHTML = '<div class="entity-empty-note">No campaign selected</div>';
    if (gridCampaignCompanions) gridCampaignCompanions.innerHTML = '<div class="entity-empty-note">No campaign selected</div>';
    if (gridCampaignNpcs) gridCampaignNpcs.innerHTML = '<div class="entity-empty-note">No campaign selected</div>';
    if (entityCountMaps) entityCountMaps.textContent = '0';
    if (entityCountPlayers) entityCountPlayers.textContent = '0';
    if (entityCountCompanions) entityCountCompanions.textContent = '0';
    if (entityCountNpcs) entityCountNpcs.textContent = '0';
    if (statEntitiesCount) statEntitiesCount.textContent = '0';
  }

  function renderCampaignEntities(camp) {
    const maps = camp.maps || {};
    const chars = Object.values(camp.characters || {});

    const isCompanion = (c) => Boolean(c.isCompanion || (c.id && c.id.startsWith('comp_')));
    const isCustomNpc = (c) => Boolean(c.isCustomNpc || (c.id && c.id.startsWith('npc_')) || (c.monsterData && !c.isPlayer && !c.isCompanion && !(c.id && c.id.startsWith('char_'))));
    const isPlayer = (c) => !isCompanion(c) && !isCustomNpc(c) && Boolean(c.isPlayer || (c.id && c.id.startsWith('char_')));

    const playerChars = chars.filter(isPlayer);
    const companionChars = chars.filter(isCompanion);
    const npcChars = chars.filter(c => isCustomNpc(c) && !isCompanion(c) && !isPlayer(c));

    const mapList = Object.values(maps);
    if (entityCountMaps) entityCountMaps.textContent = mapList.length;
    if (entityCountPlayers) entityCountPlayers.textContent = playerChars.length;
    if (entityCountCompanions) entityCountCompanions.textContent = companionChars.length;
    if (entityCountNpcs) entityCountNpcs.textContent = npcChars.length;
    if (statEntitiesCount) statEntitiesCount.textContent = chars.length;
    if (statMapsCount) statMapsCount.textContent = mapList.length;

    // Render Maps Grid
    if (gridCampaignMaps) {
      gridCampaignMaps.innerHTML = '';
      if (mapList.length === 0) {
        gridCampaignMaps.innerHTML = '<div class="entity-empty-note">No maps in this campaign yet. Use "Import Map" or create one in the VTT!</div>';
      } else {
        mapList.forEach(m => {
          const card = document.createElement('div');
          card.className = 'entity-card';
          const thumb = m.thumbnail || m.mapImage || '';
          const tokenCount = Object.keys(m.tokens || {}).length;
          card.innerHTML = `
            <div class="entity-card-thumb" style="${thumb ? `background-image: url('${thumb}')` : ''}">
              ${!thumb ? '<span class="entity-thumb-icon">🗺️</span>' : ''}
            </div>
            <div class="entity-card-info">
              <h4 class="entity-card-title" title="${m.name || 'Untitled Map'}">${m.name || 'Untitled Map'}</h4>
              <div class="entity-card-meta">
                <span>${m.gridWidth || 40}x${m.gridHeight || 30} sq</span>
                <span>•</span>
                <span>${tokenCount} token${tokenCount === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div class="entity-card-actions">
              <button class="btn btn-xs btn-outline btn-export-item" title="Export this map package">
                📤 Export
              </button>
            </div>
          `;
          card.querySelector('.btn-export-item').addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
              const res = await api.gmExportGranular({
                campaignId: camp.id,
                entityType: 'map',
                entityId: m.id,
                batch: false
              });
              if (res && res.success) {
                alert(`Map "${m.name}" successfully exported to:\n${res.filePath}`);
              }
            } catch (err) {
              alert(`Export failed: ${err.message}`);
            }
          });
          gridCampaignMaps.appendChild(card);
        });
      }
    }

    // Helper for Character Cards
    function renderCharCards(container, charList, typeKey, emptyMsg) {
      if (!container) return;
      container.innerHTML = '';
      if (charList.length === 0) {
        container.innerHTML = `<div class="entity-empty-note">${emptyMsg}</div>`;
        return;
      }
      charList.forEach(ch => {
        const card = document.createElement('div');
        card.className = 'entity-card';
        const img = ch.tokenImage || ch.avatar || ch.img || '';
        const subtitle = ch.class || ch.race || (ch.monsterData?.type || '') || ch.type || (typeKey === 'player' ? 'Player Character' : (typeKey === 'companion' ? 'Companion' : 'Custom NPC'));
        const iconFallback = typeKey === 'player' ? '👤' : (typeKey === 'companion' ? '🐾' : '👾');

        card.innerHTML = `
          <div class="entity-card-thumb" style="${img ? `background-image: url('${img}')` : ''}">
            ${!img ? `<span class="entity-thumb-icon">${iconFallback}</span>` : ''}
          </div>
          <div class="entity-card-info">
            <h4 class="entity-card-title" title="${ch.name || 'Unnamed'}">${ch.name || 'Unnamed'}</h4>
            <div class="entity-card-meta">
              <span>${subtitle}</span>
              ${ch.level ? `<span>• Lv ${ch.level}</span>` : ''}
              ${ch.monsterData?.cr ? `<span>• CR ${ch.monsterData.cr}</span>` : ''}
            </div>
          </div>
          <div class="entity-card-actions">
            <button class="btn btn-xs btn-outline btn-export-item" title="Export this ${typeKey}">
              📤 Export
            </button>
          </div>
        `;
        card.querySelector('.btn-export-item').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const res = await api.gmExportGranular({
              campaignId: camp.id,
              entityType: typeKey,
              entityId: ch.id,
              batch: false
            });
            if (res && res.success) {
              alert(`${ch.name || 'Item'} successfully exported to:\n${res.filePath}`);
            }
          } catch (err) {
            alert(`Export failed: ${err.message}`);
          }
        });
        container.appendChild(card);
      });
    }

    renderCharCards(gridCampaignPlayers, playerChars, 'player', 'No player character sheets in this campaign yet.');
    renderCharCards(gridCampaignCompanions, companionChars, 'companion', 'No companions in this campaign yet.');
    renderCharCards(gridCampaignNpcs, npcChars, 'customNpc', 'No custom NPCs in this campaign yet.');
  }

  // --- CAMPAIGN DUPLICATION, EXPORT, & IMPORT HANDLERS ---
  btnDuplicateCampaign?.addEventListener('click', async () => {
    if (!selectedCampaign) return;
    if (!confirm(`Duplicate campaign "${selectedCampaign.name}"?\nAll maps, characters, tokens, and uploaded media will be cloned into a new campaign.`)) {
      return;
    }

    btnDuplicateCampaign.disabled = true;
    btnDuplicateCampaign.textContent = 'Cloning...';

    try {
      const res = await api.gmDuplicateCampaign(selectedCampaign.id);
      if (res && res.success && res.campaign) {
        appendLogLine(`[Campaigns] Duplicated campaign "${selectedCampaign.name}" -> "${res.campaign.name}" (${res.campaign.id})`);
        await loadGmCampaigns();
        const duplicated = currentCampaigns.find(c => c.id === res.campaign.id);
        if (duplicated) selectCampaign(duplicated);
        alert(`Campaign duplicated successfully as "${res.campaign.name}"!`);
      } else {
        alert(`Failed to duplicate: ${res?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Error duplicating campaign: ${e.message}`);
    } finally {
      btnDuplicateCampaign.disabled = false;
      btnDuplicateCampaign.textContent = '📋 Duplicate';
    }
  });

  btnExportCampaign?.addEventListener('click', async () => {
    if (!selectedCampaign) return;
    btnExportCampaign.disabled = true;
    btnExportCampaign.textContent = 'Exporting...';

    try {
      const res = await api.gmExportCampaign(selectedCampaign.id);
      if (res && res.success) {
        appendLogLine(`[Campaigns] Exported campaign "${selectedCampaign.name}" to ${res.filePath}`);
        alert(`Campaign exported successfully to:\n${res.filePath}`);
      } else if (!res?.canceled) {
        alert(`Export failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Error exporting campaign: ${e.message}`);
    } finally {
      btnExportCampaign.disabled = false;
      btnExportCampaign.textContent = '📤 Export Campaign';
    }
  });

  btnGmImportCampaign?.addEventListener('click', async () => {
    btnGmImportCampaign.disabled = true;
    btnGmImportCampaign.textContent = 'Importing...';

    try {
      const res = await api.gmImportCampaign(null);
      if (res && res.success && res.campaign) {
        appendLogLine(`[Campaigns] Imported campaign "${res.campaign.name}" (${res.campaign.id})`);
        await loadGmCampaigns();
        const imported = currentCampaigns.find(c => c.id === res.campaign.id);
        if (imported) selectCampaign(imported);
        alert(`Campaign "${res.campaign.name}" imported successfully!`);
      } else if (!res?.canceled) {
        alert(`Import failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Error importing campaign: ${e.message}`);
    } finally {
      btnGmImportCampaign.disabled = false;
      btnGmImportCampaign.textContent = '📥 Import Campaign';
    }
  });

  // --- BATCH EXPORT & GRANULAR IMPORT HANDLERS ---
  async function handleBatchExport(entityType, label) {
    if (!selectedCampaign) return;
    try {
      const res = await api.gmExportGranular({
        campaignId: selectedCampaign.id,
        entityType,
        batch: true
      });
      if (res && res.success) {
        alert(`Exported ${res.count} ${label} to:\n${res.filePath}`);
      } else if (!res?.canceled) {
        alert(`Export failed: ${res?.error || 'No items to export'}`);
      }
    } catch (e) {
      alert(`Export error: ${e.message}`);
    }
  }

  async function handleGranularImport(entityType, label) {
    if (!selectedCampaign) return;
    try {
      const res = await api.gmImportGranular({
        campaignId: selectedCampaign.id,
        explicitFilePath: null
      });
      if (res && res.success) {
        alert(`Successfully imported ${res.count} ${label} into "${selectedCampaign.name}"!`);
        await refreshSelectedCampaignEntities();
      } else if (!res?.canceled) {
        alert(`Import failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Import error: ${e.message}`);
    }
  }

  btnExportAllMaps?.addEventListener('click', () => handleBatchExport('map', 'Maps'));
  btnImportMap?.addEventListener('click', () => handleGranularImport('map', 'Map'));

  btnExportAllPlayers?.addEventListener('click', () => handleBatchExport('player', 'Player Sheets'));
  btnImportPlayer?.addEventListener('click', () => handleGranularImport('player', 'Player Sheet'));

  btnExportAllCompanions?.addEventListener('click', () => handleBatchExport('companion', 'Companions'));
  btnImportCompanion?.addEventListener('click', () => handleGranularImport('companion', 'Companion'));

  btnExportAllNpcs?.addEventListener('click', () => handleBatchExport('customNpc', 'Custom NPCs'));
  btnImportNpc?.addEventListener('click', () => handleGranularImport('customNpc', 'Custom NPC'));

  // --- GLOBAL DRAG & DROP IMPORT HANDLER ---
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (gmDropzoneOverlay) gmDropzoneOverlay.classList.remove('vtt-hidden');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (gmDropzoneOverlay) gmDropzoneOverlay.classList.add('vtt-hidden');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (gmDropzoneOverlay) gmDropzoneOverlay.classList.add('vtt-hidden');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = file.path;
      if (!filePath) continue;
      const lower = filePath.toLowerCase();
      if (!lower.endsWith('.zip') && !lower.endsWith('.json')) continue;

      let asCampaign = true;
      if (selectedCampaign) {
        asCampaign = confirm(
          `Dropped file: ${file.name}\n\nClick OK to import as a NEW CAMPAIGN.\nClick CANCEL to import items into currently selected campaign "${selectedCampaign.name}".`
        );
      }

      if (asCampaign) {
        try {
          const res = await api.gmImportCampaign(filePath);
          if (res && res.success && res.campaign) {
            appendLogLine(`[Drop Import] Imported campaign "${res.campaign.name}" from ${file.name}`);
            await loadGmCampaigns();
            const imported = currentCampaigns.find(c => c.id === res.campaign.id);
            if (imported) selectCampaign(imported);
            alert(`Campaign "${res.campaign.name}" imported successfully!`);
          } else {
            alert(`Failed importing campaign from ${file.name}: ${res?.error || 'Unknown error'}`);
          }
        } catch (err) {
          alert(`Drop import error: ${err.message}`);
        }
      } else {
        try {
          const res = await api.gmImportGranular({
            campaignId: selectedCampaign.id,
            explicitFilePath: filePath
          });
          if (res && res.success) {
            appendLogLine(`[Drop Import] Imported ${res.count} item(s) into campaign "${selectedCampaign.name}"`);
            await refreshSelectedCampaignEntities();
            alert(`Successfully imported ${res.count} item(s) into "${selectedCampaign.name}"!`);
          } else {
            alert(`Failed importing into campaign: ${res?.error || 'Unknown error'}`);
          }
        } catch (err) {
          alert(`Drop import error: ${err.message}`);
        }
      }
    }
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
  const btnSyncSourcesVtt = document.getElementById('btn-sync-sources-vtt');
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
  const statPartneredSources = document.getElementById('stat-partnered-sources');
  const statUASources = document.getElementById('stat-ua-sources');
  const statCustomSources = document.getElementById('stat-custom-sources');
  const togglePartneredSources = document.getElementById('toggle-partnered-sources');
  const toggleUASources = document.getElementById('toggle-ua-sources');
  const badgeCountPartnered = document.getElementById('badge-count-partnered');
  const badgeCountUA = document.getElementById('badge-count-ua');
  const sourcesCategoriesAccordion = document.getElementById('sources-categories-accordion');
  const btnResetCampaignSources = document.getElementById('btn-reset-campaign-sources');
  const campaignOverrideIndicator = document.getElementById('campaign-override-indicator');
  const campaignOverrideText = document.getElementById('campaign-override-text');
  const btnOpenUrlImport = document.getElementById('btn-open-url-import');
  const modalUrlImport = document.getElementById('modal-url-import');
  const btnCloseUrlImport = document.getElementById('btn-close-url-import');
  const btnCancelUrlImport = document.getElementById('btn-cancel-url-import');
  const btnExecuteUrlImport = document.getElementById('btn-execute-url-import');
  const inputSourceUrl = document.getElementById('input-source-url');
  const urlImportStatusBox = document.getElementById('url-import-status-box');
  const sourcesDropzoneOverlay = document.getElementById('sources-dropzone-overlay');
  const viewSources = document.getElementById('view-sources');

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

  // Live 5e Preview & Combat Tester
  const liveCardRenderContainer = document.getElementById('live-card-render-container');
  const previewEntityTypeBadge = document.getElementById('preview-entity-type-badge');
  const interactiveTestRollTray = document.getElementById('interactive-test-roll-tray');
  const testRollLog = document.getElementById('test-roll-log');
  const btnClearTestRollTray = document.getElementById('btn-clear-test-roll-tray');
  let livePreviewThrottleTimer = null;

  // Clone from Compendium Modal
  const modalCloneCompendium = document.getElementById('modal-clone-compendium');
  const btnCloseCloneModal = document.getElementById('btn-close-clone-modal');
  const btnCancelClone = document.getElementById('btn-cancel-clone');
  const cloneCategoryBadge = document.getElementById('clone-category-badge');
  const cloneCompendiumSearch = document.getElementById('clone-compendium-search');
  const cloneCompendiumResults = document.getElementById('clone-compendium-results');

  // Archetype Monster Wizard Modal
  const btnActionArchetypeWizard = document.getElementById('btn-action-archetype-wizard');
  const modalArchetypeWizard = document.getElementById('modal-archetype-wizard');
  const btnCloseArchetypeWizard = document.getElementById('btn-close-archetype-wizard');
  const btnCancelArchetypeWizard = document.getElementById('btn-cancel-archetype-wizard');
  const btnSubmitArchetypeWizard = document.getElementById('btn-submit-archetype-wizard');
  const archetypeCardsContainer = document.getElementById('archetype-cards-container');
  const wizardArchetypeName = document.getElementById('wizard-archetype-name');
  const wizardArchetypeCr = document.getElementById('wizard-archetype-cr');
  const wizardArchetypeType = document.getElementById('wizard-archetype-type');
  const wizardArchetypeSize = document.getElementById('wizard-archetype-size');
  const wizardBenchmarkPreview = document.getElementById('wizard-benchmark-preview');
  let selectedArchetypeRole = 'brute';

  // Plaintext Importer Modal
  const btnActionPlaintextImport = document.getElementById('btn-action-plaintext-import');
  const modalPlaintextImport = document.getElementById('modal-plaintext-import');
  const btnClosePlaintextImport = document.getElementById('btn-close-plaintext-import');
  const btnCancelPlaintextImport = document.getElementById('btn-cancel-plaintext-import');
  const btnSubmitPlaintextImport = document.getElementById('btn-submit-plaintext-import');
  const btnInsertSamplePlaintext = document.getElementById('btn-insert-sample-plaintext');
  const plaintextImportTextarea = document.getElementById('plaintext-import-textarea');
  const plaintextDetectionBox = document.getElementById('plaintext-detection-box');
  const plaintextDetectionStatus = document.getElementById('plaintext-detection-status');
  let currentParsedPlaintextResult = null;

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
  let expandedCategories = new Set();
  let globalSearchResults = null;
  let activeTableSort = { col: 'name', ascending: true };
  let activeSourceSearch = '';
  let activeStatusFilter = 'all';
  let activeCampaignScope = '';

  let isInitialSourcesLoad = true;

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
        if (activeCampaignScope) {
          sourcesCampaignScope.value = activeCampaignScope;
        } else {
          sourcesCampaignScope.value = currentVal;
        }
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

        // Restore persisted UI state on initial load
        if (isInitialSourcesLoad && res.uiState) {
          if (res.uiState.lastPreset && sourcesPresetSelect) {
            sourcesPresetSelect.value = res.uiState.lastPreset;
          }
          if (res.uiState.lastScope !== undefined && sourcesCampaignScope) {
            activeCampaignScope = res.uiState.lastScope;
            sourcesCampaignScope.value = res.uiState.lastScope;
          }
          isInitialSourcesLoad = false;
        }

        // Sync Partnered & UA master toggle switches
        if (togglePartneredSources && res.partneredStats) {
          togglePartneredSources.checked = res.partneredStats.enabled > 0;
        }
        if (toggleUASources && res.uaStats) {
          toggleUASources.checked = res.uaStats.enabled > 0;
        }

        // Update campaign scope override indicators
        if (activeCampaignScope && res.isCampaignScoped) {
          if (btnResetCampaignSources) btnResetCampaignSources.classList.remove('vtt-hidden');
          if (campaignOverrideIndicator) {
            campaignOverrideIndicator.classList.remove('vtt-hidden');
            if (campaignOverrideText) {
              const count = res.campaignOverrideCount || 0;
              campaignOverrideText.textContent = count > 0 ? `${count} Custom Overrides` : '100% Inherited from Global';
            }
          }
        } else {
          if (btnResetCampaignSources) btnResetCampaignSources.classList.add('vtt-hidden');
          if (campaignOverrideIndicator) campaignOverrideIndicator.classList.add('vtt-hidden');
        }

        updateSourceStats(res.categories, res.partneredStats, res.uaStats);
        renderSourcesView();
      } else {
        if (sourcesCategoriesAccordion) sourcesCategoriesAccordion.innerHTML = '<div class="loading-placeholder text-danger">Failed to load database sources.</div>';
      }
    } catch (err) {
      console.error('Error loading sources:', err);
      if (sourcesCategoriesAccordion) sourcesCategoriesAccordion.innerHTML = `<div class="loading-placeholder text-danger">Error: ${err.message}</div>`;
    }
  }

  function updateSourceStats(categories, partneredStats, uaStats) {
    let total = 0;
    let enabled = 0;
    let custom = 0;
    let partnered = 0;
    let ua = 0;

    for (const cat of categories) {
      for (const src of cat.sources) {
        total++;
        if (src.enabled) enabled++;
        if (src.isCustom) custom++;
        if (src.isPartnered) partnered++;
        if (src.isUA) ua++;
      }
    }

    if (statTotalSources) statTotalSources.textContent = total;
    if (statEnabledSources) statEnabledSources.textContent = enabled;
    if (statCustomSources) statCustomSources.textContent = custom;
    if (statPartneredSources) statPartneredSources.textContent = partnered;
    if (statUASources) statUASources.textContent = ua;

    if (badgeCountPartnered) {
      const pEnabled = partneredStats ? partneredStats.enabled : categories.reduce((acc, c) => acc + c.sources.filter(s => s.isPartnered && s.enabled).length, 0);
      badgeCountPartnered.textContent = `${pEnabled} Active`;
    }
    if (badgeCountUA) {
      const uEnabled = uaStats ? uaStats.enabled : categories.reduce((acc, c) => acc + c.sources.filter(s => s.isUA && s.enabled).length, 0);
      badgeCountUA.textContent = `${uEnabled} Active`;
    }
  }

  function renderCategoriesAccordion() {
    if (!currentSourcesData || !sourcesCategoriesAccordion) return;
    sourcesCategoriesAccordion.innerHTML = '';

    const term = activeSourceSearch.toLowerCase().trim();

    // 1. If Global Compendium Search is active
    if (globalSearchResults !== null) {
      const activeCat = activeGlobalCatFilter;
      const categoriesToDisplay = currentSourcesData.categories.filter(c => !activeCat || c.id === activeCat);

      let totalResultsRendered = 0;

      for (const cat of categoriesToDisplay) {
        let catResults = globalSearchResults.filter(r => r.category === cat.id);
        if (catResults.length === 0) continue;

        totalResultsRendered += catResults.length;

        // Apply sorting
        catResults.sort((a, b) => {
          let valA = '', valB = '';
          if (activeTableSort.col === 'source') {
            valA = (a.source || '').toLowerCase();
            valB = (b.source || '').toLowerCase();
          } else if (activeTableSort.col === 'details') {
            valA = (a.summary || a.details || '').toLowerCase();
            valB = (b.summary || b.details || '').toLowerCase();
          } else {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
          }
          const cmp = valA.localeCompare(valB, undefined, { numeric: true });
          return activeTableSort.ascending ? cmp : -cmp;
        });

        const isExpanded = true;
        const card = document.createElement('div');
        card.className = `source-category-card ${isExpanded ? 'expanded' : ''}`;
        card.id = `cat-card-${cat.id}`;

        const sortIndicator = (col) => {
          if (activeTableSort.col === col) {
            return `<span class="sort-indicator">${activeTableSort.ascending ? '▲' : '▼'}</span>`;
          }
          return `<span class="sort-indicator">↕</span>`;
        };

        const sortClass = (col) => {
          if (activeTableSort.col === col) {
            return `sortable-th ${activeTableSort.ascending ? 'sorted-asc' : 'sorted-desc'}`;
          }
          return 'sortable-th';
        };

        card.innerHTML = `
          <div class="category-header-wrap" data-cat-id="${cat.id}">
            <div class="category-title-left">
              <span class="category-icon">${cat.icon || '📁'}</span>
              <div class="category-title-text">
                <h3>
                  ${cat.name}
                  <span class="category-badge-count" id="cat-count-${cat.id}">
                    ${catResults.length} Found
                  </span>
                </h3>
              </div>
            </div>
            <div class="category-header-actions" onclick="event.stopPropagation();">
              <button class="btn-cat-action btn-cat-custom" data-action="add-custom" data-cat="${cat.id}" title="Create new homebrew source in ${cat.name}">✨ Add Custom</button>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="category-content-wrap">
            <div class="sources-table-container">
              <table class="sources-data-table">
                <thead>
                  <tr>
                    <th class="${sortClass('name')}" data-sort="name">
                      Entry Name ${sortIndicator('name')}
                    </th>
                    <th class="${sortClass('source')}" data-sort="source" style="width: 120px;">
                      Source ${sortIndicator('source')}
                    </th>
                    <th class="${sortClass('details')}" data-sort="details" style="width: 170px;">
                      Details / CR / Lvl ${sortIndicator('details')}
                    </th>
                    <th style="width: 150px; text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="search-rows-${cat.id}"></tbody>
              </table>
            </div>
          </div>
        `;

        // Accordion toggle
        const headerWrap = card.querySelector('.category-header-wrap');
        headerWrap.addEventListener('click', () => {
          card.classList.toggle('expanded');
        });

        // Add custom button
        card.querySelector('[data-action="add-custom"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openCreateCustomModal(cat.id);
        });

        // Table headers sort
        card.querySelectorAll('th.sortable-th').forEach(th => {
          th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (activeTableSort.col === col) {
              activeTableSort.ascending = !activeTableSort.ascending;
            } else {
              activeTableSort.col = col;
              activeTableSort.ascending = true;
            }
            renderCategoriesAccordion();
          });
        });

        // Populate search rows
        const tbody = card.querySelector(`#search-rows-${cat.id}`);
        for (const item of catResults) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <strong style="color: var(--text-main); font-weight: 600;">${escapeHtml(item.name || 'Unknown')}</strong>
            </td>
            <td>
              <span class="source-code-badge ${item.isCustom ? 'custom' : ''}">${escapeHtml(item.source || 'SRD')}</span>
            </td>
            <td>
              <span class="text-muted" style="font-size: 12px;">${escapeHtml(item.summary || item.details || '—')}</span>
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <button type="button" class="btn btn-xs btn-outline btn-search-inspect" title="Quick 5e Preview">👁️ Inspect</button>
              <button type="button" class="btn btn-xs btn-primary btn-search-edit" title="Edit in Studio">✏️ Edit</button>
            </td>
          `;

          tr.querySelector('.btn-search-inspect').addEventListener('click', () => {
            openInspectModal(cat.id, item.name, item.source);
          });

          tr.querySelector('.btn-search-edit').addEventListener('click', () => {
            openEditSourceModal(cat.id, item.source);
          });

          tbody.appendChild(tr);
        }

        sourcesCategoriesAccordion.appendChild(card);
      }

      if (totalResultsRendered === 0) {
        sourcesCategoriesAccordion.innerHTML = `
          <div class="loading-placeholder" style="padding: 40px 20px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
            <div style="font-size: 15px; font-weight: 600; color: var(--text-main);">No matching compendium entries found.</div>
            <div class="text-muted" style="margin-top: 4px;">Try searching with different keywords or switch category filter to "All Categories".</div>
          </div>
        `;
      }
      return;
    }

    // 2. Default state: Sourcebooks Table View
    for (const cat of currentSourcesData.categories) {
      const matchingSources = cat.sources.filter(src => {
        if (activeStatusFilter === 'active' && !src.enabled) return false;
        if (activeStatusFilter === 'inactive' && src.enabled) return false;
        if (activeStatusFilter === 'partnered' && !src.isPartnered) return false;
        if (activeStatusFilter === 'ua' && !src.isUA) return false;
        if (activeStatusFilter === 'custom' && !src.isCustom) return false;

        if (!term) return true;
        return (
          (src.name && src.name.toLowerCase().includes(term)) ||
          (src.code && src.code.toLowerCase().includes(term)) ||
          (src.author && src.author.toLowerCase().includes(term))
        );
      });

      if ((term || activeStatusFilter !== 'all') && matchingSources.length === 0) continue;

      // Apply sorting to sourcebooks
      matchingSources.sort((a, b) => {
        let valA = '', valB = '';
        if (activeTableSort.col === 'code') {
          valA = (a.code || '').toLowerCase();
          valB = (b.code || '').toLowerCase();
        } else if (activeTableSort.col === 'edition') {
          valA = `${a.edition || ''} ${a.isCustom ? 'custom' : ''}`;
          valB = `${b.edition || ''} ${b.isCustom ? 'custom' : ''}`;
        } else if (activeTableSort.col === 'entries') {
          const numA = a.entryCount || 0;
          const numB = b.entryCount || 0;
          return activeTableSort.ascending ? (numA - numB) : (numB - numA);
        } else {
          valA = (a.name || a.code || '').toLowerCase();
          valB = (b.name || b.code || '').toLowerCase();
        }
        const cmp = valA.localeCompare(valB, undefined, { numeric: true });
        return activeTableSort.ascending ? cmp : -cmp;
      });

      const isExpanded = term ? true : expandedCategories.has(cat.id);
      const enabledInCat = cat.sources.filter(s => s.enabled).length;

      const card = document.createElement('div');
      card.className = `source-category-card ${isExpanded ? 'expanded' : ''}`;
      card.id = `cat-card-${cat.id}`;

      const sortIndicator = (col) => {
        if (activeTableSort.col === col) {
          return `<span class="sort-indicator">${activeTableSort.ascending ? '▲' : '▼'}</span>`;
        }
        return `<span class="sort-indicator">↕</span>`;
      };

      const sortClass = (col) => {
        if (activeTableSort.col === col) {
          return `sortable-th ${activeTableSort.ascending ? 'sorted-asc' : 'sorted-desc'}`;
        }
        return 'sortable-th';
      };

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
          <div class="sources-table-container">
            <table class="sources-data-table">
              <thead>
                <tr>
                  <th class="source-col-status">Status</th>
                  <th class="${sortClass('name')}" data-sort="name">
                    Sourcebook Title ${sortIndicator('name')}
                  </th>
                  <th class="${sortClass('code')} source-col-code" data-sort="code">
                    Code ${sortIndicator('code')}
                  </th>
                  <th class="${sortClass('edition')} source-col-edition" data-sort="edition">
                    Type / Edition ${sortIndicator('edition')}
                  </th>
                  <th class="${sortClass('entries')} source-col-entries" data-sort="entries">
                    Entries ${sortIndicator('entries')}
                  </th>
                  <th class="source-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody id="source-rows-${cat.id}"></tbody>
            </table>
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

      // Table headers sort
      card.querySelectorAll('th.sortable-th').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.getAttribute('data-sort');
          if (activeTableSort.col === col) {
            activeTableSort.ascending = !activeTableSort.ascending;
          } else {
            activeTableSort.col = col;
            activeTableSort.ascending = true;
          }
          renderCategoriesAccordion();
        });
      });

      // Populate source rows
      const tbody = card.querySelector(`#source-rows-${cat.id}`);
      if (matchingSources.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-placeholder">No matching sources found in this category.</td></tr>';
      } else {
        for (const src of matchingSources) {
          const tr = document.createElement('tr');
          tr.className = src.enabled ? '' : 'source-row-disabled';
          tr.id = `src-row-${src.category}-${src.code}`;

          const sizeKb = src.fileSize ? `${Math.round(src.fileSize / 1024)} KB` : '';
          const countLabel = src.entryCount !== undefined ? `${src.entryCount} entries` : '—';

          const editionBadge = src.edition === '2024'
            ? '<span class="badge-edition badge-edition-2024" title="2024 Modern Ruleset">2024</span>'
            : '<span class="badge-edition badge-edition-2014" title="2014 Legacy Ruleset">2014</span>';
          const partneredBadge = src.isPartnered
            ? '<span class="badge-content badge-partnered" title="Partnered Content">Partnered</span>'
            : '';
          const uaBadge = src.isUA
            ? '<span class="badge-content badge-ua" title="Unearthed Arcana (Playtest)">UA</span>'
            : '';
          const customBadge = src.isCustom
            ? '<span class="badge badge-accent" style="font-size: 9px; padding: 1px 5px;">Custom</span>'
            : '';

          tr.innerHTML = `
            <td class="source-col-status">
              <label class="switch-label" title="${src.enabled ? 'Enabled in VTT' : 'Disabled in VTT'}">
                <input type="checkbox" class="source-toggle-cb" data-cat="${src.category}" data-code="${src.code}" ${src.enabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </td>
            <td>
              <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(src.name || src.code)}</div>
              <div class="source-item-author" style="font-size: 11px; color: var(--text-dim);">${escapeHtml(src.author || 'Official Rulebook')}</div>
            </td>
            <td class="source-col-code">
              <span class="source-code-badge ${src.isCustom ? 'custom' : ''}">${escapeHtml(src.code)}</span>
            </td>
            <td class="source-col-edition">
              <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                ${editionBadge}
                ${partneredBadge}
                ${uaBadge}
                ${customBadge}
              </div>
            </td>
            <td class="source-col-entries">
              <div style="font-size: 12px; font-weight: 500;">${countLabel}</div>
              ${sizeKb ? `<div style="font-size: 10px; color: var(--text-dim);">${sizeKb}</div>` : ''}
            </td>
            <td class="source-col-actions">
              <div style="display: flex; gap: 6px; justify-content: flex-end;">
                <button class="btn btn-xs btn-outline btn-source-edit" data-action="edit" data-cat="${src.category}" data-code="${src.code}" title="Edit metadata or entries">
                  ✏️ Edit
                </button>
                ${src.isCustom ? `
                  <button class="btn btn-xs btn-outline btn-source-delete text-danger" data-action="delete" data-cat="${src.category}" data-code="${src.code}" title="Delete this custom source">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </td>
          `;

          // Switch toggle event
          const toggleCb = tr.querySelector('.source-toggle-cb');
          toggleCb.addEventListener('change', async () => {
            const isChecked = toggleCb.checked;
            tr.classList.toggle('source-row-disabled', !isChecked);
            src.enabled = isChecked;
            updateSourceStats(currentSourcesData.categories);

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
          tr.querySelector('.btn-source-edit').addEventListener('click', () => {
            openEditSourceModal(src.category, src.code);
          });

          // Delete button (if custom)
          const delBtn = tr.querySelector('.btn-source-delete');
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

          tbody.appendChild(tr);
        }
      }

      sourcesCategoriesAccordion.appendChild(card);
    }
  }

  function renderSourcesView() {
    renderCategoriesAccordion();
  }

  // =========================================================================
  // GLOBAL COMPENDIUM SEARCH & SORT LOGIC
  // =========================================================================
  async function triggerGlobalSearch() {
    const rawTerm = globalCompendiumSearchInput ? globalCompendiumSearchInput.value.trim() : '';
    if (!rawTerm) {
      globalSearchResults = null;
      renderCategoriesAccordion();
      return;
    }

    if (sourcesCategoriesAccordion) {
      sourcesCategoriesAccordion.innerHTML = `
        <div class="loading-placeholder" style="padding: 40px 20px;">
          <div class="spinner-inline" style="margin-bottom: 8px;">⏳</div>
          <div style="font-size: 15px; font-weight: 600; color: var(--text-main);">Searching active compendium for "${escapeHtml(rawTerm)}"...</div>
        </div>
      `;
    }

    try {
      const res = await api.sourcesSearchCompendium({
        query: rawTerm,
        category: activeGlobalCatFilter || 'all',
        campaignId: activeCampaignScope || null,
        limit: 100
      });

      if (res && res.success) {
        globalSearchResults = res.results || [];
      } else {
        globalSearchResults = [];
      }
    } catch (err) {
      console.error('Error executing global compendium search:', err);
      globalSearchResults = [];
    }

    renderCategoriesAccordion();
  }

  // Global search input events
  if (globalCompendiumSearchInput) {
    globalCompendiumSearchInput.addEventListener('input', () => {
      clearTimeout(globalSearchDebounceTimer);
      globalSearchDebounceTimer = setTimeout(triggerGlobalSearch, 220);
    });
    globalCompendiumSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(globalSearchDebounceTimer);
        triggerGlobalSearch();
      }
    });
  }

  if (btnClearGlobalSearch) {
    btnClearGlobalSearch.addEventListener('click', () => {
      if (globalCompendiumSearchInput) globalCompendiumSearchInput.value = '';
      clearTimeout(globalSearchDebounceTimer);
      globalSearchResults = null;
      renderCategoriesAccordion();
    });
  }

  if (globalSearchCategoryChips) {
    globalSearchCategoryChips.querySelectorAll('.cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        globalSearchCategoryChips.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeGlobalCatFilter = chip.getAttribute('data-cat') || '';
        triggerGlobalSearch();
      });
    });
  }

  // =========================================================================
  // 5E COMPENDIUM INSPECT MODAL
  // =========================================================================
  async function openInspectModal(category, name, source) {
    const modal = document.getElementById('modal-compendium-inspect');
    const titleEl = document.getElementById('inspect-modal-title');
    const badgeEl = document.getElementById('inspect-modal-badge');
    const srcEl = document.getElementById('inspect-modal-source');
    const bodyEl = document.getElementById('inspect-modal-body');
    const footerInfo = document.getElementById('inspect-modal-footer-info');
    const btnStudio = document.getElementById('btn-inspect-open-studio');

    if (!modal) return;

    modal.classList.remove('vtt-hidden');
    if (titleEl) titleEl.textContent = name || 'Compendium Entry';
    if (badgeEl) badgeEl.textContent = (category || 'Compendium').toUpperCase();
    if (srcEl) srcEl.textContent = source || 'SRD';
    if (footerInfo) footerInfo.textContent = `Sourcebook: ${source || 'Official Rulebook'}`;
    if (bodyEl) bodyEl.innerHTML = '<div class="loading-placeholder"><div class="spinner-inline" style="margin-bottom: 8px;">⏳</div>Loading compendium entry...</div>';

    if (btnStudio) {
      btnStudio.onclick = () => {
        modal.classList.add('vtt-hidden');
        openEditSourceModal(category, source);
      };
    }

    try {
      const res = await api.sourcesGetEntityFullData({ category, name, source });
      if (res && res.success && res.entity) {
        bodyEl.innerHTML = generateEntityStatblockHtml(category, res.entity);
        bodyEl.querySelectorAll('.rollable-pill, .dice-chip, .vtt-dc-badge').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rollExpr = btn.getAttribute('data-formula') || btn.getAttribute('data-roll');
            const dcVal = btn.getAttribute('data-dc');
            const label = btn.getAttribute('data-label') || btn.textContent.trim() || 'Roll';
            simulateDiceRoll(rollExpr, label, dcVal);
          });
        });
      } else {
        bodyEl.innerHTML = `
          <div class="loading-placeholder">
            Could not load full entry for "${escapeHtml(name)}".
            <br/><span style="font-size: 11px; color: var(--text-dim);">${escapeHtml(res?.error || 'Source data not found')}</span>
          </div>
        `;
      }
    } catch (err) {
      bodyEl.innerHTML = `<div class="loading-placeholder text-danger">Error loading entry: ${escapeHtml(err.message)}</div>`;
    }
  }

  const btnCloseInspectModal = document.getElementById('btn-close-inspect-modal');
  const btnInspectClose = document.getElementById('btn-inspect-close');
  if (btnCloseInspectModal) {
    btnCloseInspectModal.addEventListener('click', () => {
      document.getElementById('modal-compendium-inspect')?.classList.add('vtt-hidden');
    });
  }
  if (btnInspectClose) {
    btnInspectClose.addEventListener('click', () => {
      document.getElementById('modal-compendium-inspect')?.classList.add('vtt-hidden');
    });
  }

  // Campaign Reset Button
  if (btnResetCampaignSources) {
    btnResetCampaignSources.addEventListener('click', async () => {
      if (!activeCampaignScope) return;
      if (confirm(`Reset this campaign's sourcebook selections to 100% match Global Defaults?`)) {
        btnResetCampaignSources.disabled = true;
        try {
          await api.sourcesResetCampaign(activeCampaignScope);
          await loadAllSources();
        } finally {
          btnResetCampaignSources.disabled = false;
        }
      }
    });
  }

  // Drag and drop ingestion on Source Manager view
  if (viewSources && sourcesDropzoneOverlay) {
    let dragCounter = 0;
    viewSources.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      sourcesDropzoneOverlay.classList.remove('vtt-hidden');
    });
    viewSources.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    viewSources.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        sourcesDropzoneOverlay.classList.add('vtt-hidden');
      }
    });
    viewSources.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      sourcesDropzoneOverlay.classList.add('vtt-hidden');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filePaths = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
        if (filePaths.length > 0) {
          openBulkImportWizard();
          await processBulkPaths(filePaths);
        }
      }
    });
  }

  // URL Import Modal handlers
  if (btnOpenUrlImport && modalUrlImport) {
    btnOpenUrlImport.addEventListener('click', () => {
      modalUrlImport.classList.remove('vtt-hidden');
      if (inputSourceUrl) inputSourceUrl.value = '';
      if (urlImportStatusBox) {
        urlImportStatusBox.classList.add('vtt-hidden');
        urlImportStatusBox.textContent = '';
      }
    });
  }
  if (btnCloseUrlImport && modalUrlImport) {
    btnCloseUrlImport.addEventListener('click', () => modalUrlImport.classList.add('vtt-hidden'));
  }
  if (btnCancelUrlImport && modalUrlImport) {
    btnCancelUrlImport.addEventListener('click', () => modalUrlImport.classList.add('vtt-hidden'));
  }
  if (btnExecuteUrlImport && inputSourceUrl && modalUrlImport) {
    btnExecuteUrlImport.addEventListener('click', async () => {
      const url = inputSourceUrl.value.trim();
      if (!url) {
        if (urlImportStatusBox) {
          urlImportStatusBox.textContent = 'Please enter a valid web URL.';
          urlImportStatusBox.className = 'url-import-status text-danger';
          urlImportStatusBox.classList.remove('vtt-hidden');
        }
        return;
      }

      btnExecuteUrlImport.disabled = true;
      if (urlImportStatusBox) {
        urlImportStatusBox.innerHTML = '⏳ Downloading, parsing, and integrating sourcebook...';
        urlImportStatusBox.className = 'url-import-status text-warning';
        urlImportStatusBox.classList.remove('vtt-hidden');
      }

      try {
        const res = await api.sourcesImportFromUrl({ url });
        if (res && res.success) {
          if (urlImportStatusBox) {
            urlImportStatusBox.textContent = `✅ Successfully imported ${res.importedCount || 1} sourcebook file(s)!`;
            urlImportStatusBox.className = 'url-import-status text-success';
          }
          setTimeout(async () => {
            modalUrlImport.classList.add('vtt-hidden');
            btnExecuteUrlImport.disabled = false;
            await loadAllSources();
          }, 1200);
        } else {
          if (urlImportStatusBox) {
            urlImportStatusBox.textContent = `❌ ${res?.error || 'Failed to import from URL'}`;
            urlImportStatusBox.className = 'url-import-status text-danger';
          }
          btnExecuteUrlImport.disabled = false;
        }
      } catch (err) {
        if (urlImportStatusBox) {
          urlImportStatusBox.textContent = `❌ ${err.message}`;
          urlImportStatusBox.className = 'url-import-status text-danger';
        }
        btnExecuteUrlImport.disabled = false;
      }
    });
  }

  // Search input handlers
  if (sourcesSearchInput) {
    sourcesSearchInput.addEventListener('input', () => {
      activeSourceSearch = sourcesSearchInput.value;
      if (btnClearSourceSearch) {
        if (activeSourceSearch) btnClearSourceSearch.classList.remove('vtt-hidden');
        else btnClearSourceSearch.classList.add('vtt-hidden');
      }
      renderSourcesView();
    });
  }

  if (btnClearSourceSearch) {
    btnClearSourceSearch.addEventListener('click', () => {
      sourcesSearchInput.value = '';
      activeSourceSearch = '';
      btnClearSourceSearch.classList.add('vtt-hidden');
      renderSourcesView();
    });
  }

  // Campaign scope dropdown handler
  if (sourcesCampaignScope) {
    sourcesCampaignScope.addEventListener('change', () => {
      activeCampaignScope = sourcesCampaignScope.value;
      if (api.sourcesSaveUiState) {
        api.sourcesSaveUiState({
          lastPreset: sourcesPresetSelect?.value,
          lastScope: activeCampaignScope
        }).catch(() => {});
      }
      loadAllSources();
    });
  }

  function showSystemToast(html, duration = 3000, extraClass = '') {
    let toastContainer = document.getElementById('vtt-roll-toasts');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'vtt-roll-toasts';
      toastContainer.className = 'vtt-roll-toasts-container';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `vtt-roll-toast ${extraClass}`.trim();
    toast.innerHTML = html;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  if (btnRefreshSources) {
    btnRefreshSources.addEventListener('click', () => {
      loadAllSources();
    });
  }

  if (btnSyncSourcesVtt) {
    btnSyncSourcesVtt.addEventListener('click', async () => {
      btnSyncSourcesVtt.disabled = true;
      const originalText = btnSyncSourcesVtt.innerHTML;
      btnSyncSourcesVtt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
      try {
        if (api && api.sourcesSyncToServer) {
          await api.sourcesSyncToServer();
        } else {
          await fetch('/api/server/sync-sources', { method: 'POST' }).catch(() => {});
        }
        await loadAllSources();
        showSystemToast('<span style="font-size: 18px;">⚡</span> <div><strong>Database Sources Synced!</strong><div style="font-size: 12px; color: #a5b4fc;">Active VTT compendium and cache hot-reloaded successfully.</div></div>', 3500);
      } catch (err) {
        console.error('Failed to sync sources to VTT:', err);
        showSystemToast(`<span style="font-size: 18px;">❌</span> <div><strong>Sync Failed</strong><div style="font-size: 12px; color: #fca5a5;">${err.message}</div></div>`, 4000);
      } finally {
        btnSyncSourcesVtt.disabled = false;
        btnSyncSourcesVtt.innerHTML = originalText;
      }
    });
  }

  // Quick Master Switches for Partnered & UA
  if (togglePartneredSources) {
    togglePartneredSources.addEventListener('change', async () => {
      const enabled = togglePartneredSources.checked;
      togglePartneredSources.disabled = true;
      try {
        await api.sourcesTogglePartnered({
          enabled,
          campaignId: activeCampaignScope || null
        });
        await loadAllSources();
      } catch (err) {
        console.error('Failed toggling partnered sources:', err);
      } finally {
        togglePartneredSources.disabled = false;
      }
    });
  }

  if (toggleUASources) {
    toggleUASources.addEventListener('change', async () => {
      const enabled = toggleUASources.checked;
      toggleUASources.disabled = true;
      try {
        await api.sourcesToggleUA({
          enabled,
          campaignId: activeCampaignScope || null
        });
        await loadAllSources();
      } catch (err) {
        console.error('Failed toggling UA sources:', err);
      } finally {
        toggleUASources.disabled = false;
      }
    });
  }

  // Preset selector handler
  if (sourcesPresetSelect) {
    sourcesPresetSelect.addEventListener('change', () => {
      if (api.sourcesSaveUiState) {
        api.sourcesSaveUiState({
          lastPreset: sourcesPresetSelect.value,
          lastScope: activeCampaignScope
        }).catch(() => {});
      }
    });
  }

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
          if (api.sourcesSaveUiState) {
            api.sourcesSaveUiState({
              lastPreset: preset,
              lastScope: activeCampaignScope
            }).catch(() => {});
          }
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
      renderSourcesView();
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

    // Update Live 5e Preview
    updateLivePreview();
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

    // Subtype
    setVal('bf-beast-subtype', entity.subtype || '');

    // Dynamic cards
    renderCardBlockList('beast-traits-container', entity.traits || [], (arr) => { entity.traits = arr; });
    renderCardBlockList('beast-actions-container', entity.actions || [], (arr) => { entity.actions = arr; });
    renderCardBlockList('beast-reactions-container', entity.reactions || [], (arr) => { entity.reactions = arr; });
    renderCardBlockList('beast-legendary-container', entity.legendaryActions || [], (arr) => { entity.legendaryActions = arr; });
  }

  function readCardBlockList(containerId, fallback = []) {
    const container = document.getElementById(containerId);
    if (!container) return fallback;
    const blocks = container.querySelectorAll('.card-block-item');
    if (blocks.length === 0) return [];
    const items = [];
    blocks.forEach(b => {
      const title = b.querySelector('.card-block-title-input')?.value?.trim() || '';
      const text = b.querySelector('.card-block-textarea')?.value?.trim() || '';
      if (title || text) {
        items.push({ name: title, text });
      }
    });
    return items;
  }

  function readBestiaryForm(current) {
    const getVal = (id, def = '') => document.getElementById(id)?.value ?? def;
    const getNum = (id, def = 0) => parseInt(document.getElementById(id)?.value, 10) || def;

    const traits = readCardBlockList('beast-traits-container', current?.traits || []);
    const actions = readCardBlockList('beast-actions-container', current?.actions || []);
    const reactions = readCardBlockList('beast-reactions-container', current?.reactions || []);
    const legendaryActions = readCardBlockList('beast-legendary-container', current?.legendaryActions || []);

    return {
      ...current,
      name: getVal('bf-beast-name', 'New Creature'),
      size: getVal('bf-beast-size', 'Medium'),
      type: getVal('bf-beast-type', 'Humanoid'),
      subtype: getVal('bf-beast-subtype'),
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
      tokenUrl: getVal('bf-beast-token-url'),
      traits,
      actions,
      reactions,
      legendaryActions
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

    const scBlocks = readCardBlockList('class-subclasses-container');
    const subclasses = scBlocks.length > 0 ? scBlocks.map(item => ({
      name: item.name,
      shortName: item.name,
      source: current?.source || 'MYBREW',
      features: [{ level: 3, name: item.name, text: item.text }]
    })) : (current?.subclasses || []);

    return {
      ...current,
      name: getVal('bf-class-name', 'New Class'),
      hitDie: getVal('bf-class-hit-die', 'd8'),
      savingThrows,
      armorProf: getVal('bf-class-armor'),
      weaponProf: getVal('bf-class-weapons'),
      subclassUnlockLevel: getNum('bf-class-subclass-level', 3),
      levels: current?.levels || {},
      subclasses
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
    const traits = readCardBlockList('race-traits-container', current?.traits || []);

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
      },
      traits
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
    const benefits = readCardBlockList('feat-benefits-container', current?.benefits || []);
    return {
      ...current,
      name: getVal('bf-feat-name', 'New Feat'),
      prerequisiteText: getVal('bf-feat-prereq'),
      description: getVal('bf-feat-desc'),
      benefits
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
  function autoTagText(text) {
    if (!text) return '';
    let res = String(text);
    // Replace damage e.g. "2d6 fire damage" -> "{@damage 2d6} fire damage"
    res = res.replace(/\b(\d+d\d+(?:\s*[\+\-]\s*\d+)?)\s+(fire|cold|lightning|acid|poison|radiant|necrotic|force|psychic|thunder|slashing|piercing|bludgeoning)\s+damage\b/gi, '{@damage $1} $2 damage');
    // Replace DC saves e.g. "DC 14 Dexterity" -> "{@dc 14} Dexterity"
    res = res.replace(/\b(?:DC|dc)\s*(\d+)\s*(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|Str|Dex|Con|Int|Wis|Cha)?\b/gi, '{@dc $1} $2');
    // Replace plain attack bonuses e.g. "+5 to hit" -> "{@hit 5} to hit"
    res = res.replace(/\+([0-9]+)\s+to\s+hit\b/gi, '{@hit $1} to hit');
    return res;
  }

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
            <button type="button" class="tag-pill" data-tag="{@condition poisoned}">{@condition}</button>
            <button type="button" class="btn-auto-tag" title="Auto-convert plain dice & saves to 5e tags">⚡ Auto-Tag</button>
          </div>
        </div>
      `;

      const titleInput = block.querySelector('.card-block-title-input');
      const textarea = block.querySelector('.card-block-textarea');
      const btnDelete = block.querySelector('.btn-card-block-delete');
      const btnAutoTag = block.querySelector('.btn-auto-tag');

      titleInput.addEventListener('input', () => {
        itemsArray[idx].name = titleInput.value;
        onUpdate(itemsArray);
        updateLivePreviewThrottled();
      });

      textarea.addEventListener('input', () => {
        itemsArray[idx].text = textarea.value;
        onUpdate(itemsArray);
        updateLivePreviewThrottled();
      });

      if (btnAutoTag) {
        btnAutoTag.addEventListener('click', () => {
          textarea.value = autoTagText(textarea.value);
          itemsArray[idx].text = textarea.value;
          onUpdate(itemsArray);
          updateLivePreview();
        });
      }

      btnDelete.addEventListener('click', () => {
        itemsArray.splice(idx, 1);
        onUpdate(itemsArray);
        renderCardBlockList(containerId, itemsArray, onUpdate);
        updateLivePreview();
      });

      // Quick tags insertion
      block.querySelectorAll('.tag-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const tagToInsert = pill.getAttribute('data-tag');
          insertTextAtCursor(textarea, tagToInsert);
          itemsArray[idx].text = textarea.value;
          onUpdate(itemsArray);
          updateLivePreview();
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
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function calcAbilityModifier(score) {
    const val = parseInt(score, 10);
    if (isNaN(val)) return '+0';
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function calcAverageHp(formula, conScore = 10) {
    if (!formula || typeof formula !== 'string') return 10;
    const match = formula.trim().match(/^(\d+)d(\d+)(?:\s*([\+\-])\s*(\d+))?$/i);
    if (!match) return 10;
    const count = parseInt(match[1], 10) || 1;
    const die = parseInt(match[2], 10) || 8;
    const sign = match[3] || '+';
    let bonus = match[4] ? parseInt(match[4], 10) : 0;
    if (sign === '-') bonus = -bonus;

    const avgDie = (die + 1) / 2;
    return Math.max(1, Math.floor(count * avgDie + bonus));
  }

  function getProfBonusByCR(cr) {
    let crVal = 0;
    if (typeof cr === 'string') {
      if (cr.includes('/')) {
        const parts = cr.split('/');
        crVal = parseFloat(parts[0]) / parseFloat(parts[1]);
      } else {
        crVal = parseFloat(cr) || 0;
      }
    } else {
      crVal = Number(cr) || 0;
    }

    if (crVal <= 4) return 2;
    if (crVal <= 8) return 3;
    if (crVal <= 12) return 4;
    if (crVal <= 16) return 5;
    if (crVal <= 20) return 6;
    if (crVal <= 24) return 7;
    if (crVal <= 28) return 8;
    return 9;
  }

  function updateAbilityModDisplay(inputId, modSpanId) {
    const input = document.getElementById(inputId);
    const span = document.getElementById(modSpanId);
    if (!input || !span) return;
    span.textContent = calcAbilityModifier(input.value);
  }

  // Hook ability score changes & Auto-Math
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(s => {
    const input = document.getElementById(`bf-beast-${s}`);
    if (input) {
      input.addEventListener('input', () => {
        updateAbilityModDisplay(`bf-beast-${s}`, `mod-beast-${s}`);
        updateLivePreviewThrottled();
      });
    }
  });

  // Auto-calculate HP average from Formula
  const hpFormulaInput = document.getElementById('bf-beast-hp-formula');
  const hpAvgInput = document.getElementById('bf-beast-hp-avg');
  if (hpFormulaInput && hpAvgInput) {
    hpFormulaInput.addEventListener('input', () => {
      const conScore = parseInt(document.getElementById('bf-beast-con')?.value, 10) || 10;
      const calcAvg = calcAverageHp(hpFormulaInput.value, conScore);
      if (calcAvg > 0) {
        hpAvgInput.value = calcAvg;
      }
      updateLivePreviewThrottled();
    });
  }

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

  // =========================================================================
  // LIVE 5E PREVIEW & COMBAT TEST ROLLER ENGINE
  // =========================================================================
  function updateLivePreviewThrottled() {
    clearTimeout(livePreviewThrottleTimer);
    livePreviewThrottleTimer = setTimeout(() => {
      updateLivePreview();
    }, 80);
  }

  function updateLivePreview() {
    if (!liveCardRenderContainer) return;
    if (activeEntityIndex < 0 || !activeSourceEntities[activeEntityIndex]) {
      renderLivePreviewEmpty();
      return;
    }

    const cat = activeEditingSource?.category || 'bestiary';
    let entity = null;
    if (activeStudioMode === 'json') {
      try {
        const parsed = JSON.parse(entityEntryJsonTextarea.value);
        entity = jsonToEntity(cat, parsed, activeEditingSource?.code || 'MYBREW');
      } catch (_) {
        return;
      }
    } else {
      entity = readVisualForm(cat);
    }

    if (!entity) {
      renderLivePreviewEmpty();
      return;
    }

    renderLivePreviewForEntity(cat, entity);
  }

  function renderLivePreviewEmpty() {
    if (!liveCardRenderContainer) return;
    if (previewEntityTypeBadge) previewEntityTypeBadge.textContent = 'Preview';
    liveCardRenderContainer.innerHTML = `
      <div class="preview-placeholder">
        Select an entry or build one with the form to preview the live 5e card.
      </div>
    `;
  }

  function formatPreviewTextWithRollables(rawText, sourceName = '') {
    if (!rawText) return '';
    if (typeof rawText === 'object') {
      return VTTEntryResolver.render(rawText);
    }
    let html = VTTEntryResolver.resolveTags(String(rawText));

    // Fallback regexes for plaintext dice expressions not wrapped in tags
    html = html.replace(/\b(\d+d\d+(?:\s*[\+\-]\s*\d+)?)\s+([a-zA-Z]+)?\s*damage\b/gi, (match, formula, type) => {
      const cleanForm = formula.replace(/\s+/g, '');
      const typeStr = type ? ` ${type}` : '';
      return `<button type="button" class="dice-chip dice-chip--damage" data-formula="${escapeHtml(cleanForm)}" title="Roll Damage: ${cleanForm}">${formula}${typeStr}</button> damage`;
    });

    html = html.replace(/\b(\+\d+)\s+to\s+hit\b/gi, (match, bonus) => {
      return `<button type="button" class="dice-chip dice-chip--hit" data-formula="1d20${bonus}" title="Attack Roll: 1d20${bonus}">${bonus} to hit</button>`;
    });

    return html;
  }

  function formatSavesMap(savesObj) {
    if (!savesObj) return '';
    if (typeof savesObj === 'string') return savesObj;
    if (typeof savesObj !== 'object') return '';
    const parts = [];
    for (const [k, v] of Object.entries(savesObj)) {
      if (v !== undefined && v !== null && v !== false) {
        const bonus = typeof v === 'number' ? (v >= 0 ? `+${v}` : `${v}`) : String(v);
        parts.push(`${k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()} ${bonus}`);
      }
    }
    return parts.join(', ');
  }

  function formatSkillsMap(skillsObj) {
    if (!skillsObj) return '';
    if (typeof skillsObj === 'string') return skillsObj;
    if (typeof skillsObj !== 'object') return '';
    const parts = [];
    for (const [k, v] of Object.entries(skillsObj)) {
      if (v !== undefined && v !== null && v !== false) {
        const bonus = typeof v === 'number' ? (v >= 0 ? `+${v}` : `${v}`) : String(v);
        parts.push(`${k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()} ${bonus}`);
      }
    }
    return parts.join(', ');
  }

  function generateEntityStatblockHtml(cat, entity) {
    if (!entity) return '<div class="preview-placeholder">No entry data.</div>';

    // -----------------------------------------------------------------------
    // 1. BESTIARY: Authentic Single-Column 5e Statblock
    // -----------------------------------------------------------------------
    if (cat === 'bestiary') {
      const strMod = calcAbilityModifier(entity.str);
      const dexMod = calcAbilityModifier(entity.dex);
      const conMod = calcAbilityModifier(entity.con);
      const intMod = calcAbilityModifier(entity.int);
      const wisMod = calcAbilityModifier(entity.wis);
      const chaMod = calcAbilityModifier(entity.cha);

      const cr = entity.cr !== undefined ? String(entity.cr) : '1/4';
      const pb = entity.proficiencyBonus || getProfBonusByCR(cr);

      // Armor Class
      const acVal = entity.primaryAc !== undefined
        ? entity.primaryAc
        : (Array.isArray(entity.ac)
          ? (typeof entity.ac[0] === 'object' ? (entity.ac[0]?.value || entity.ac[0]?.ac || 10) : entity.ac[0])
          : (entity.ac || 10));
      const acCond = entity.acCondition || (Array.isArray(entity.ac) && entity.ac[0]?.condition ? entity.ac[0].condition : '');

      // Hit Points
      const hpAvg = entity.hpAvg !== undefined
        ? entity.hpAvg
        : (entity.hp && typeof entity.hp === 'object' ? (entity.hp.average || 10) : (typeof entity.hp === 'number' ? entity.hp : 10));
      const hpFormula = entity.hpFormula || (entity.hp && typeof entity.hp === 'object' ? entity.hp.formula : '');

      // Speeds
      const speedObj = entity.speed || {};
      const walkSpeed = entity.speedWalk !== undefined ? entity.speedWalk : (speedObj.walk !== undefined ? speedObj.walk : (typeof entity.speed === 'number' ? entity.speed : 30));
      const flySpeed = entity.speedFly !== undefined ? entity.speedFly : (speedObj.fly || 0);
      const swimSpeed = entity.speedSwim !== undefined ? entity.speedSwim : (speedObj.swim || 0);
      const climbSpeed = entity.speedClimb !== undefined ? entity.speedClimb : (speedObj.climb || 0);
      const burrowSpeed = entity.speedBurrow !== undefined ? entity.speedBurrow : (speedObj.burrow || 0);
      const canHover = entity.canHover || !!speedObj.canHover;

      const speeds = [];
      if (walkSpeed) speeds.push(`${walkSpeed} ft.`);
      if (flySpeed) speeds.push(`fly ${flySpeed} ft.${canHover ? ' (hover)' : ''}`);
      if (swimSpeed) speeds.push(`swim ${swimSpeed} ft.`);
      if (climbSpeed) speeds.push(`climb ${climbSpeed} ft.`);
      if (burrowSpeed) speeds.push(`burrow ${burrowSpeed} ft.`);
      const speedStr = speeds.join(', ') || '30 ft.';

      // Saves, Skills, Senses, Languages
      const savesStr = formatSavesMap(entity.saves || entity.save);
      const skillsStr = formatSkillsMap(entity.skills || entity.skill);
      const sensesStr = entity.senses ? (typeof entity.senses === 'string' ? entity.senses : toCommaSeparatedString(entity.senses)) : (entity.passivePerception ? `passive Perception ${entity.passivePerception}` : '');
      const languagesStr = entity.languages ? (typeof entity.languages === 'string' ? entity.languages : toCommaSeparatedString(entity.languages)) : '—';
      const resistStr = entity.resistances ? (typeof entity.resistances === 'string' ? entity.resistances : toCommaSeparatedString(entity.resistances)) : (toCommaSeparatedString(entity.resist));
      const immuneStr = entity.immunities ? (typeof entity.immunities === 'string' ? entity.immunities : toCommaSeparatedString(entity.immunities)) : (toCommaSeparatedString(entity.immune));
      const condImmuneStr = entity.conditionImmunities ? (typeof entity.conditionImmunities === 'string' ? entity.conditionImmunities : toCommaSeparatedString(entity.conditionImmunities)) : (toCommaSeparatedString(entity.conditionImmune));

      const formatActionList = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return '';
        return arr.map(item => {
          const name = item.name ? `<strong><em>${VTTEntryResolver.resolveTags(item.name)}.</em></strong> ` : '';
          let body = '';
          if (item.entriesHtml) body = VTTEntryResolver.resolveTags(item.entriesHtml);
          else if (item.entries) body = VTTEntryResolver.render(item.entries);
          else if (item.text) body = formatPreviewTextWithRollables(item.text, item.name);
          else if (item.descriptionHtml) body = VTTEntryResolver.resolveTags(item.descriptionHtml);
          else body = VTTEntryResolver.render(item);
          return `<div class="statblock-entry-item">${name}${body}</div>`;
        }).join('');
      };

      const traitsHtml = formatActionList(entity.traits || entity.trait);
      const actionsHtml = formatActionList(entity.actions || entity.action);
      const bonusHtml = formatActionList(entity.bonusActions || entity.bonusAction);
      const reactionsHtml = formatActionList(entity.reactions || entity.reaction);

      // Legendary Actions
      let legendaryHtml = '';
      const legCount = entity.legendaryActions?.count || entity.legendaryCount || 3;
      const legDesc = entity.legendaryActions?.description || entity.legendaryActionsDesc || `The creature can take ${legCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The creature regains spent legendary actions at the start of its turn.`;
      const legEntries = Array.isArray(entity.legendaryActions) ? entity.legendaryActions : (entity.legendaryActions?.entries || entity.legendary || []);
      if (legEntries.length > 0) {
        legendaryHtml = `
          <div class="statblock-section-heading">Legendary Actions</div>
          <div class="statblock-intro-text" style="font-size: 13px; line-height: 1.5; color: #cbd5e1; margin-bottom: 8px;">${VTTEntryResolver.resolveTags(legDesc)}</div>
          ${formatActionList(legEntries)}
        `;
      }

      // Spellcasting
      let spellcastingHtml = '';
      if (Array.isArray(entity.spellcasting) && entity.spellcasting.length > 0) {
        spellcastingHtml = entity.spellcasting.map(sc => {
          const scName = sc.name ? `<div class="statblock-section-heading" style="color: #c084fc;">${escapeHtml(sc.name)}</div>` : '';
          const scHeader = sc.headerEntries ? `<div style="font-size: 13px; line-height: 1.5; color: #e2e8f0; margin-bottom: 6px;">${VTTEntryResolver.render(sc.headerEntries)}</div>` : '';
          const scSpells = sc.spells ? Object.entries(sc.spells).map(([lvl, info]) => {
            const lvlLabel = lvl === '0' ? 'Cantrips (at will)' : `Level ${lvl} (${info.slots || 1} slots)`;
            const spellsList = Array.isArray(info.spells) ? info.spells.map(s => VTTEntryResolver.resolveTags(`{@spell ${s}}`)).join(', ') : '';
            return `<div style="font-size: 13px; margin-bottom: 4px;"><strong>${lvlLabel}:</strong> ${spellsList}</div>`;
          }).join('') : '';
          return `<div class="statblock-spellcasting-block">${scName}${scHeader}${scSpells}</div>`;
        }).join('');
      }

      // Mythic Actions
      let mythicHtml = '';
      const mythicEntries = Array.isArray(entity.mythicActions) ? entity.mythicActions : (entity.mythicActions?.entries || []);
      if (mythicEntries.length > 0) {
        mythicHtml = `
          <div class="vtt-statblock-special-section vtt-mythic-actions" style="margin-top: 14px; border-left: 3px solid #f43f5e; padding-left: 10px;">
            <div class="statblock-section-heading" style="color: #f43f5e;">Mythic Actions</div>
            ${entity.mythicActions?.description ? `<div style="font-size: 13px; color: #fda4af; margin-bottom: 6px;">${VTTEntryResolver.resolveTags(entity.mythicActions.description)}</div>` : ''}
            ${formatActionList(mythicEntries)}
          </div>
        `;
      }

      // Lair Actions
      let lairHtml = '';
      const lairActions = entity.lairActions || [];
      if (Array.isArray(lairActions) && lairActions.length > 0) {
        const lairHeader = entity.lairHeader || 'Lair Actions';
        const lairDesc = entity.lairActionsDesc || 'On initiative count 20 (losing initiative ties), the creature can take one of the following lair actions:';
        lairHtml = `
          <div class="vtt-statblock-special-section vtt-lair-actions" style="margin-top: 16px; border: 1px solid rgba(255, 215, 0, 0.3); background: rgba(255, 215, 0, 0.04); border-radius: 6px; padding: 12px;">
            <div class="statblock-section-heading" style="color: #ffd700; border-bottom: 1px solid rgba(255, 215, 0, 0.4); margin-top: 0; padding-bottom: 4px;">🏰 ${escapeHtml(lairHeader)}</div>
            <div style="font-size: 13px; font-style: italic; color: #fef08a; margin: 6px 0 10px 0;">${VTTEntryResolver.resolveTags(lairDesc)}</div>
            ${formatActionList(lairActions)}
          </div>
        `;
      }

      // Regional Effects
      let regionalHtml = '';
      const regionalEffects = entity.regionalEffects || [];
      if (Array.isArray(regionalEffects) && regionalEffects.length > 0) {
        regionalHtml = `
          <div class="vtt-statblock-special-section vtt-regional-effects" style="margin-top: 14px; border: 1px solid rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.04); border-radius: 6px; padding: 12px;">
            <div class="statblock-section-heading" style="color: #34d399; border-bottom: 1px solid rgba(52, 211, 153, 0.4); margin-top: 0; padding-bottom: 4px;">🌲 Regional Effects</div>
            <div style="font-size: 13px; color: #a7f3d0; margin-top: 6px;">
              ${entity.regionalEffectsHtml ? VTTEntryResolver.resolveTags(entity.regionalEffectsHtml) : formatActionList(regionalEffects)}
            </div>
          </div>
        `;
      }

      // Variants
      let variantsHtml = '';
      const variants = entity.variants || [];
      if (Array.isArray(variants) && variants.length > 0) {
        variantsHtml = `
          <div class="vtt-statblock-special-section vtt-variants-box" style="margin-top: 16px; border: 1px solid rgba(96, 165, 250, 0.3); background: rgba(96, 165, 250, 0.04); border-radius: 6px; padding: 12px;">
            <div class="statblock-section-heading" style="color: #60a5fa; border-bottom: 1px solid rgba(96, 165, 250, 0.4); margin-top: 0; padding-bottom: 4px;">🔄 Variants & Customizations</div>
            ${variants.map(v => `
              <div style="margin-top: 10px;">
                <div style="font-weight: 700; color: #93c5fd; font-size: 13px;">${escapeHtml(v.name || 'Variant')}</div>
                <div style="font-size: 13px; line-height: 1.5; color: #e2e8f0; margin-top: 4px;">
                  ${v.descriptionHtml ? VTTEntryResolver.resolveTags(v.descriptionHtml) : (v.entries ? VTTEntryResolver.render(v.entries) : VTTEntryResolver.resolveTags(v.text || ''))}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      return `
        <div class="statblock-5e">
          <div class="statblock-header">
            <h2 class="statblock-name">${escapeHtml(entity.name || 'Creature')}</h2>
            <div class="statblock-meta">${escapeHtml(entity.size || 'Medium')} ${escapeHtml(entity.type || 'Humanoid')}${entity.subtype ? ` (${escapeHtml(entity.subtype)})` : ''}, ${escapeHtml(entity.alignment || 'unaligned')} • ${escapeHtml(entity.source || '')}</div>
          </div>
          <hr class="tapered-rule" />
          <div class="statblock-prop-row"><strong>Armor Class</strong> ${acVal} ${acCond ? `(${escapeHtml(acCond)})` : ''}</div>
          <div class="statblock-prop-row"><strong>Hit Points</strong> ${hpAvg} ${hpFormula ? `(${hpFormula})` : ''}</div>
          <div class="statblock-prop-row"><strong>Speed</strong> ${speedStr}</div>
          <hr class="tapered-rule" />

          <div class="statblock-abilities-grid">
            <div class="statblock-ability-col"><span class="statblock-ability-label">STR</span><span class="statblock-ability-val">${entity.str || 10} (${strMod})</span></div>
            <div class="statblock-ability-col"><span class="statblock-ability-label">DEX</span><span class="statblock-ability-val">${entity.dex || 10} (${dexMod})</span></div>
            <div class="statblock-ability-col"><span class="statblock-ability-label">CON</span><span class="statblock-ability-val">${entity.con || 10} (${conMod})</span></div>
            <div class="statblock-ability-col"><span class="statblock-ability-label">INT</span><span class="statblock-ability-val">${entity.int || 10} (${intMod})</span></div>
            <div class="statblock-ability-col"><span class="statblock-ability-label">WIS</span><span class="statblock-ability-val">${entity.wis || 10} (${wisMod})</span></div>
            <div class="statblock-ability-col"><span class="statblock-ability-label">CHA</span><span class="statblock-ability-val">${entity.cha || 10} (${chaMod})</span></div>
          </div>

          <hr class="tapered-rule" />
          ${savesStr ? `<div class="statblock-prop-row"><strong>Saving Throws</strong> ${escapeHtml(savesStr)}</div>` : ''}
          ${skillsStr ? `<div class="statblock-prop-row"><strong>Skills</strong> ${escapeHtml(skillsStr)}</div>` : ''}
          ${resistStr ? `<div class="statblock-prop-row"><strong>Damage Resistances</strong> ${escapeHtml(resistStr)}</div>` : ''}
          ${immuneStr ? `<div class="statblock-prop-row"><strong>Damage Immunities</strong> ${escapeHtml(immuneStr)}</div>` : ''}
          ${condImmuneStr ? `<div class="statblock-prop-row"><strong>Condition Immunities</strong> ${escapeHtml(condImmuneStr)}</div>` : ''}
          ${sensesStr ? `<div class="statblock-prop-row"><strong>Senses</strong> ${escapeHtml(sensesStr)}</div>` : ''}
          <div class="statblock-prop-row"><strong>Languages</strong> ${escapeHtml(languagesStr)}</div>
          <div class="statblock-prop-row"><strong>Challenge</strong> ${cr} (Proficiency Bonus +${pb})</div>
          <hr class="tapered-rule" />

          ${traitsHtml ? `<div class="statblock-section-heading">Traits</div>${traitsHtml}` : ''}
          ${spellcastingHtml}
          ${actionsHtml ? `<div class="statblock-section-heading">Actions</div>${actionsHtml}` : ''}
          ${bonusHtml ? `<div class="statblock-section-heading">Bonus Actions</div>${bonusHtml}` : ''}
          ${reactionsHtml ? `<div class="statblock-section-heading">Reactions</div>${reactionsHtml}` : ''}
          ${legendaryHtml}
          ${mythicHtml}
          ${lairHtml}
          ${regionalHtml}
          ${variantsHtml}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 2. SPELLS: Full Spell Card
    // -----------------------------------------------------------------------
    if (cat === 'spells') {
      const lvl = entity.level !== undefined ? entity.level : 1;
      const school = entity.school || 'Evocation';
      const lvlText = lvl === 0 ? `${school} Cantrip` : `Level ${lvl} ${school}`;

      const castingTime = entity.castingTime || `${entity.castingTimeNum || 1} ${entity.castingTimeUnit || 'action'}`;
      const range = entity.range || `${entity.rangeDistance || 60} ${entity.rangeType || 'feet'}`;
      const components = entity.components || (
        [entity.componentV ? 'V' : '', entity.componentS ? 'S' : '', entity.componentM ? `M (${entity.materialsText || 'material'})` : ''].filter(Boolean).join(', ') || 'None'
      );
      const duration = entity.duration || `${entity.durationAmount || 1} ${entity.durationUnit || 'instant'}`;

      const isConc = entity.concentration || entity.isConcentration;
      const isRit = entity.ritual;

      const classesArr = Array.isArray(entity.classes)
        ? entity.classes.map(c => typeof c === 'string' ? c : c.name)
        : (entity.classes ? [entity.classes] : []);

      const subclassesArr = Array.isArray(entity.subclasses)
        ? entity.subclasses.map(s => typeof s === 'string' ? s : (s.name || s.shortName))
        : [];

      // Damage / DC tags
      let damageChipsHtml = '';
      if (Array.isArray(entity.damageList) && entity.damageList.length > 0) {
        damageChipsHtml = entity.damageList.map(d => `
          <button type="button" class="dice-chip dice-chip--damage" data-formula="${escapeHtml(d.formula)}" title="Roll ${escapeHtml(d.type || 'Damage')}">💥 ${escapeHtml(d.formula)} ${escapeHtml(d.type || '')}</button>
        `).join(' ');
      } else if (entity.damageFormula) {
        damageChipsHtml = `<button type="button" class="dice-chip dice-chip--damage" data-formula="${escapeHtml(entity.damageFormula)}" title="Roll Damage">💥 ${escapeHtml(entity.damageFormula)} ${escapeHtml(entity.damageType || '')}</button>`;
      }

      const saveAbility = entity.saveAbility || entity.savingThrow;
      let saveBadgeHtml = '';
      if (saveAbility) {
        saveBadgeHtml = `<span class="vtt-dc-badge" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5;">Save: ${escapeHtml(saveAbility.toUpperCase())}</span>`;
      }

      let descHtml = '';
      if (entity.descriptionHtml) descHtml = VTTEntryResolver.resolveTags(entity.descriptionHtml);
      else if (entity.entries) descHtml = VTTEntryResolver.render(entity.entries);
      else if (entity.description) descHtml = formatPreviewTextWithRollables(entity.description, entity.name);

      let higherHtml = '';
      if (entity.higherLevelHtml) higherHtml = VTTEntryResolver.resolveTags(entity.higherLevelHtml);
      else if (entity.entriesHigherLevel) higherHtml = VTTEntryResolver.render(entity.entriesHigherLevel);
      else if (entity.higherLevelsDesc) higherHtml = formatPreviewTextWithRollables(entity.higherLevelsDesc, entity.name);

      return `
        <div class="spell-card-5e">
          <div class="spell-card-header">
            <h2 class="spell-card-title">${escapeHtml(entity.name || 'Spell Name')}</h2>
            <div class="spell-card-meta">
              ${lvlText}
              ${isConc ? ' • <span style="color: #60a5fa; font-weight: 600;">Concentration</span>' : ''}
              ${isRit ? ' • <span style="color: #34d399; font-weight: 600;">Ritual</span>' : ''}
              • ${escapeHtml(entity.source || '')}
            </div>
          </div>
          <hr class="tapered-rule" />
          <div class="statblock-prop-row"><strong>Casting Time:</strong> ${escapeHtml(castingTime)}</div>
          <div class="statblock-prop-row"><strong>Range:</strong> ${escapeHtml(range)}</div>
          <div class="statblock-prop-row"><strong>Components:</strong> ${VTTEntryResolver.resolveTags(components)}</div>
          <div class="statblock-prop-row"><strong>Duration:</strong> ${escapeHtml(duration)}</div>

          ${damageChipsHtml || saveBadgeHtml ? `
            <div class="statblock-prop-row" style="margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${damageChipsHtml} ${saveBadgeHtml}
            </div>
          ` : ''}

          ${classesArr.length > 0 ? `
            <div class="statblock-prop-row" style="margin-top: 4px;">
              <strong>Classes:</strong> ${classesArr.map(c => `<span class="badge" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); font-size: 11px; margin: 2px;">${escapeHtml(c)}</span>`).join(' ')}
            </div>
          ` : ''}

          ${subclassesArr.length > 0 ? `
            <div class="statblock-prop-row" style="font-size: 11px; color: #a5b4fc;">
              <strong>Subclasses:</strong> ${escapeHtml(subclassesArr.join(', '))}
            </div>
          ` : ''}

          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div style="font-size: 13px; line-height: 1.6; color: #e2e8f0;">
            ${descHtml}
          </div>
          ${higherHtml ? `
            <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 13px; line-height: 1.5; color: #cbd5e1;">
              <strong style="color: #ffd700;">At Higher Levels.</strong> ${higherHtml}
            </div>
          ` : ''}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 3. ITEMS & EQUIPMENT: Rich Detail Card
    // -----------------------------------------------------------------------
    if (cat === 'items') {
      const itemType = entity.itemType || entity.type || 'Adventuring Gear';
      const rarity = entity.rarity && entity.rarity !== 'none' ? entity.rarity : 'common';
      const attune = entity.reqAttune ? (typeof entity.reqAttune === 'string' ? `(requires attunement ${entity.reqAttune})` : '(requires attunement)') : '';

      // Combat stats banner
      let combatStatsHtml = '';
      if (entity.dmg1 || entity.damageDice) {
        const dmgFormula = entity.dmg1 || entity.damageDice;
        const dmgType = entity.dmgType || entity.damageType || '';
        const versatile = entity.dmg2 ? ` (versatile ${entity.dmg2})` : '';
        combatStatsHtml += `
          <div class="statblock-prop-row">
            <strong>Damage:</strong>
            <button type="button" class="dice-chip dice-chip--damage" data-formula="${escapeHtml(dmgFormula)}" title="Roll Damage">💥 ${escapeHtml(dmgFormula)}</button>
            ${escapeHtml(dmgType)}${escapeHtml(versatile)}
          </div>
        `;
      }
      if (entity.ac || entity.baseAc) {
        combatStatsHtml += `<div class="statblock-prop-row"><strong>Armor Class:</strong> ${entity.ac || entity.baseAc}${entity.acBonus ? ` (+${entity.acBonus})` : ''}</div>`;
      }

      const props = entity.properties || (entity.weaponProperties ? entity.weaponProperties.split(',').map(s => s.trim()) : []);
      const valueStr = entity.value || (entity.valueGp ? `${entity.valueGp} gp` : '');
      const weightStr = entity.weight !== undefined ? `${entity.weight} lbs.` : (entity.weightLbs ? `${entity.weightLbs} lbs.` : '');

      let descHtml = '';
      if (entity.descriptionHtml) descHtml = VTTEntryResolver.resolveTags(entity.descriptionHtml);
      else if (entity.entries) descHtml = VTTEntryResolver.render(entity.entries);
      else if (entity.description) descHtml = formatPreviewTextWithRollables(entity.description, entity.name);

      return `
        <div class="item-card-5e">
          <div class="item-card-header">
            <h2 class="item-card-title">${escapeHtml(entity.name || 'Magic Item')}</h2>
            <div class="item-card-rarity">${escapeHtml(itemType)}, ${escapeHtml(rarity)} ${escapeHtml(attune)} • ${escapeHtml(entity.source || '')}</div>
          </div>
          <hr class="tapered-rule" style="margin: 12px 0;" />
          ${combatStatsHtml}
          ${props.length > 0 ? `<div class="statblock-prop-row"><strong>Properties:</strong> ${props.map(p => `<span class="badge" style="font-size: 11px;">${escapeHtml(p)}</span>`).join(' ')}</div>` : ''}
          ${valueStr ? `<div class="statblock-prop-row"><strong>Value:</strong> ${escapeHtml(valueStr)}</div>` : ''}
          ${weightStr ? `<div class="statblock-prop-row"><strong>Weight:</strong> ${escapeHtml(weightStr)}</div>` : ''}
          ${entity.charges ? `<div class="statblock-prop-row"><strong>Charges:</strong> ${entity.charges} ${entity.rechargeText ? `(${escapeHtml(entity.rechargeText)})` : ''}</div>` : ''}
          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div style="font-size: 13px; line-height: 1.6; color: #e2e8f0;">
            ${descHtml || '<div class="text-muted">Standard equipment entry.</div>'}
          </div>
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 4. CLASSES & SUBCLASSES
    // -----------------------------------------------------------------------
    if (cat === 'classes') {
      // A. SUBCLASS CARD
      if (entity.isSubclass) {
        const features = Array.isArray(entity.features) ? entity.features : [];
        return `
          <div class="class-card-5e">
            <h2 class="class-card-title">${escapeHtml(entity.name || 'Subclass')}</h2>
            <div class="statblock-meta" style="color: #818cf8; font-weight: 600;">
              Subclass for ${escapeHtml(entity.className || 'Class')} • ${escapeHtml(entity.source || '')}
            </div>
            <hr class="tapered-rule" style="margin: 12px 0;" />
            <div class="statblock-section-heading" style="color: #818cf8;">Subclass Features</div>
            ${features.length > 0 ? features.map(f => `
              <div style="margin-top: 12px; padding: 10px 14px; background: rgba(99, 102, 241, 0.06); border-left: 3px solid #818cf8; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <strong style="color: #c7d2fe; font-size: 14px;">${escapeHtml(f.name || 'Feature')}</strong>
                  <span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-size: 11px;">Level ${f.level || 3}</span>
                </div>
                <div style="font-size: 13px; line-height: 1.5; color: #e2e8f0; margin-top: 6px;">
                  ${f.entriesHtml ? VTTEntryResolver.resolveTags(f.entriesHtml) : (f.entries ? VTTEntryResolver.render(f.entries) : VTTEntryResolver.resolveTags(f.text || ''))}
                </div>
              </div>
            `).join('') : '<div class="text-muted" style="margin-top: 8px;">No feature details defined.</div>'}
          </div>
        `;
      }

      // B. CORE CLASS CARD (With 20-level feature progression table!)
      const hitDie = entity.hitDie || 'd8';
      const saves = Array.isArray(entity.savingThrows) ? entity.savingThrows.join(', ') : (entity.savingThrows || (Array.isArray(entity.proficiency) ? entity.proficiency.map(p => p.toUpperCase()).join(', ') : 'None'));

      // Aggregate features by level (1 to 20)
      const featuresByLevel = {};
      for (let i = 1; i <= 20; i++) featuresByLevel[i] = [];

      if (Array.isArray(entity.features)) {
        for (const f of entity.features) {
          const lvl = f.level || 1;
          if (featuresByLevel[lvl]) featuresByLevel[lvl].push(f.name);
        }
      }
      if (entity.levels) {
        for (const [lvl, flist] of Object.entries(entity.levels)) {
          const lNum = parseInt(lvl, 10);
          if (featuresByLevel[lNum] && featuresByLevel[lNum].length === 0) {
            const arr = Array.isArray(flist) ? flist.map(f => f.name || f) : [flist];
            featuresByLevel[lNum].push(...arr);
          }
        }
      }

      let tableRows = '';
      for (let lvl = 1; lvl <= 20; lvl++) {
        const pb = Math.floor((lvl - 1) / 4) + 2;
        const featsList = featuresByLevel[lvl] || [];
        const featNames = featsList.length > 0 ? featsList.join(', ') : '—';
        tableRows += `
          <tr>
            <td style="font-weight: 600; color: #818cf8; text-align: center;">${lvl}</td>
            <td style="color: #a5b4fc; text-align: center;">+${pb}</td>
            <td style="color: #e2e8f0;">${escapeHtml(featNames)}</td>
          </tr>
        `;
      }

      let subclassesHtml = '';
      if (Array.isArray(entity.subclasses) && entity.subclasses.length > 0) {
        subclassesHtml = `
          <div style="margin-top: 18px;">
            <div class="statblock-section-heading" style="color: #818cf8;">Available Subclasses (${entity.subclasses.length})</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
              ${entity.subclasses.map(sc => `
                <div style="padding: 6px 10px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 4px; font-size: 12px; color: #c7d2fe;">
                  <strong>${escapeHtml(sc.name || sc.shortName)}</strong>
                  <span style="font-size: 10px; color: #818cf8; margin-left: 4px;">(${escapeHtml(sc.source || entity.source || '')})</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="class-card-5e">
          <h2 class="class-card-title">${escapeHtml(entity.name || 'Class')}</h2>
          <div class="statblock-meta">Hit Die: 1${escapeHtml(hitDie)} per level • ${escapeHtml(entity.source || '')}</div>
          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div class="statblock-prop-row"><strong>Saving Throws:</strong> ${escapeHtml(saves)}</div>
          ${entity.armorProf ? `<div class="statblock-prop-row"><strong>Armor Proficiencies:</strong> ${escapeHtml(entity.armorProf)}</div>` : ''}
          ${entity.weaponProf ? `<div class="statblock-prop-row"><strong>Weapon Proficiencies:</strong> ${escapeHtml(entity.weaponProf)}</div>` : ''}

          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div style="font-weight: 700; font-size: 14px; color: #818cf8; margin-bottom: 8px;">The ${escapeHtml(entity.name || 'Class')} Progression Table</div>
          <div style="max-height: 280px; overflow-y: auto; border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px;">
            <table class="class-progression-table-5e" style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: rgba(99, 102, 241, 0.15);">
                  <th style="width: 50px; padding: 6px; text-align: center;">Lvl</th>
                  <th style="width: 50px; padding: 6px; text-align: center;">PB</th>
                  <th style="padding: 6px; text-align: left;">Features</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          ${subclassesHtml}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 5. FEATS & OPTIONAL FEATURES
    // -----------------------------------------------------------------------
    if (cat === 'feats') {
      const typeBadge = entity.featureTypeName || (entity.isOptionalFeature ? 'Optional Feature' : 'Feat');
      const prereq = entity.prerequisite || entity.prerequisiteText || '';

      let descHtml = '';
      if (entity.descriptionHtml) descHtml = VTTEntryResolver.resolveTags(entity.descriptionHtml);
      else if (entity.entriesHtml) descHtml = VTTEntryResolver.resolveTags(entity.entriesHtml);
      else if (entity.entries) descHtml = VTTEntryResolver.render(entity.entries);
      else if (entity.description) descHtml = formatPreviewTextWithRollables(entity.description, entity.name);

      const benefitsHtml = Array.isArray(entity.benefits) && entity.benefits.length > 0 ? entity.benefits.map(b => `
        <li style="margin-bottom: 6px; font-size: 13px; line-height: 1.5; color: #fef3c7;">
          ${b.name ? `<strong style="color: #fbbf24;">${escapeHtml(b.name)}:</strong> ` : ''}
          ${formatPreviewTextWithRollables(b.text || b, b.name)}
        </li>
      `).join('') : '';

      return `
        <div class="feat-card-5e">
          <div class="spell-card-header">
            <h2 class="feat-card-title">${escapeHtml(entity.name || 'Feat')}</h2>
            <div class="statblock-meta" style="color: #fbbf24;">
              ${escapeHtml(typeBadge)} • ${escapeHtml(entity.source || '')}
            </div>
          </div>
          ${prereq ? `<div class="statblock-prop-row" style="color: #f59e0b; margin-top: 6px;"><strong>Prerequisite:</strong> ${VTTEntryResolver.resolveTags(prereq)}</div>` : ''}
          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div style="font-size: 13px; line-height: 1.6; color: #fef3c7;">
            ${descHtml}
          </div>
          ${benefitsHtml ? `<ul style="padding-left: 20px; margin-top: 10px;">${benefitsHtml}</ul>` : ''}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 6. BACKGROUNDS
    // -----------------------------------------------------------------------
    if (cat === 'backgrounds') {
      const skills = entity.skills || (Array.isArray(entity.skillProficiencies) ? entity.skillProficiencies.join(', ') : '');
      const tools = entity.tools || (Array.isArray(entity.toolProficiencies) ? entity.toolProficiencies.join(', ') : '');
      const languages = entity.languages || '—';

      // Equipment
      let equipStr = entity.equipment || '';
      if (!equipStr && entity.equipmentData?.fixedItems) {
        equipStr = entity.equipmentData.fixedItems.map(i => `${i.quantity > 1 ? i.quantity + ' ' : ''}${i.name}`).join(', ');
        if (entity.equipmentData.fixedGold) equipStr += `, ${entity.equipmentData.fixedGold} gp`;
      }

      // Features list
      let featuresHtml = '';
      if (Array.isArray(entity.features) && entity.features.length > 0) {
        featuresHtml = entity.features.map(f => `
          <div style="margin-top: 12px;">
            <div style="font-weight: 700; color: #22d3ee; font-size: 14px;">${escapeHtml(f.name || 'Background Feature')}</div>
            <div style="font-size: 13px; line-height: 1.5; color: #cffafe; margin-top: 4px;">
              ${VTTEntryResolver.resolveTags(f.description || f.entriesHtml || '')}
            </div>
          </div>
        `).join('');
      } else if (entity.featureName) {
        featuresHtml = `
          <div style="margin-top: 12px;">
            <div style="font-weight: 700; color: #22d3ee; font-size: 14px;">${escapeHtml(entity.featureName)}</div>
            <div style="font-size: 13px; line-height: 1.5; color: #cffafe; margin-top: 4px;">
              ${VTTEntryResolver.resolveTags(entity.featureDescription || entity.featureDesc || '')}
            </div>
          </div>
        `;
      }

      return `
        <div class="bg-card-5e">
          <h2 class="bg-card-title">${escapeHtml(entity.name || 'Background')}</h2>
          <div class="statblock-meta">Character Origin Background • ${escapeHtml(entity.source || '')}</div>
          <hr class="tapered-rule" style="margin: 12px 0;" />
          ${skills ? `<div class="statblock-prop-row"><strong>Skill Proficiencies:</strong> ${escapeHtml(skills)}</div>` : ''}
          ${tools && tools !== 'None' ? `<div class="statblock-prop-row"><strong>Tool Proficiencies:</strong> ${escapeHtml(tools)}</div>` : ''}
          <div class="statblock-prop-row"><strong>Languages:</strong> ${escapeHtml(languages)}</div>
          ${equipStr ? `<div class="statblock-prop-row"><strong>Starting Equipment:</strong> ${escapeHtml(equipStr)}</div>` : ''}
          <hr class="tapered-rule" style="margin: 12px 0;" />
          ${featuresHtml}
        </div>
      `;
    }

    // -----------------------------------------------------------------------
    // 7. RACES & LINEAGES
    // -----------------------------------------------------------------------
    if (cat === 'races') {
      const increases = [];
      if (entity.abilityIncreases) {
        for (const [k, v] of Object.entries(entity.abilityIncreases)) {
          if (v) increases.push(`+${v} ${k.toUpperCase()}`);
        }
      }
      const incStr = increases.join(', ') || 'None';

      const traits = Array.isArray(entity.traits) ? entity.traits : (Array.isArray(entity.entries) ? entity.entries : []);
      const traitsHtml = traits.length > 0 ? traits.map(t => `
        <div class="statblock-entry-item" style="margin-top: 10px;">
          <strong style="color: #34d399;"><em>${escapeHtml(t.name || 'Trait')}.</em></strong>
          <div style="font-size: 13px; line-height: 1.5; color: #d1fae5; margin-top: 2px;">
            ${t.entriesHtml ? VTTEntryResolver.resolveTags(t.entriesHtml) : (t.entries ? VTTEntryResolver.render(t.entries) : VTTEntryResolver.resolveTags(t.text || ''))}
          </div>
        </div>
      `).join('') : '<div class="text-muted" style="font-size: 12px; margin-top: 6px;">No racial traits defined.</div>';

      return `
        <div class="race-card-5e">
          <h2 class="race-card-title">${escapeHtml(entity.name || 'Race / Lineage')}</h2>
          <div class="statblock-meta">${escapeHtml(entity.size || 'Medium')} Humanoid • Speed ${entity.speedWalk || (entity.speed?.walk || 30)} ft. • ${escapeHtml(entity.source || '')}</div>
          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div class="statblock-prop-row"><strong>Ability Score Increase:</strong> ${incStr}</div>
          ${entity.darkvision ? `<div class="statblock-prop-row"><strong>Darkvision:</strong> ${entity.darkvision} ft.</div>` : ''}
          ${entity.languages ? `<div class="statblock-prop-row"><strong>Languages:</strong> ${escapeHtml(entity.languages)}</div>` : ''}
          <hr class="tapered-rule" style="margin: 12px 0;" />
          <div class="statblock-section-heading" style="color: #34d399;">Racial Traits</div>
          ${traitsHtml}
        </div>
      `;
    }

    // Default / adventures / lore
    return `
      <div class="item-card-5e" style="border-color: #6366f1;">
        <h2 class="item-card-title" style="color: #a5b4fc;">${escapeHtml(entity.name || 'Compendium Entry')}</h2>
        <div class="item-card-rarity">${(cat || 'Compendium').toUpperCase()} Entry • ${escapeHtml(entity.source || '')}</div>
        <hr class="tapered-rule" style="margin: 12px 0;" />
        <div style="font-size: 13px; line-height: 1.6; color: #e2e8f0;">
          ${VTTEntryResolver.render(entity.entries || entity.description || entity.text || 'No description provided.')}
        </div>
      </div>
    `;
  }

  function renderLivePreviewForEntity(cat, entity) {
    if (!liveCardRenderContainer) return;
    if (previewEntityTypeBadge) previewEntityTypeBadge.textContent = cat.toUpperCase();
    liveCardRenderContainer.innerHTML = generateEntityStatblockHtml(cat, entity);
    attachLivePreviewRollHandlers();
  }

  function attachLivePreviewRollHandlers() {
    if (!liveCardRenderContainer) return;

    liveCardRenderContainer.querySelectorAll('.rollable-pill, .dice-chip, .vtt-dc-badge').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rollExpr = btn.getAttribute('data-formula') || btn.getAttribute('data-roll');
        const dcVal = btn.getAttribute('data-dc');
        const label = btn.getAttribute('data-label') || btn.textContent.trim() || 'Roll';
        simulateDiceRoll(rollExpr, label, dcVal);
      });
    });
  }

  function simulateDiceRoll(rollExpr, label, dcVal) {
    const now = new Date().toLocaleTimeString();

    let entryHtml = '';
    let isCrit = false;
    let isFumble = false;

    if (dcVal) {
      // Simulate d20 saving throw vs DC
      const d20 = Math.floor(Math.random() * 20) + 1;
      const targetDc = parseInt(dcVal, 10);
      const passed = d20 >= targetDc;
      isCrit = (d20 === 20);
      isFumble = (d20 === 1);

      entryHtml = `
        <span><strong>${label}</strong> vs <strong>DC ${targetDc}</strong>: Rolled [${d20}]</span>
        <span style="font-weight: 700; color: ${passed ? '#10b981' : '#ef4444'};">${passed ? '✅ SUCCESS' : '❌ FAILED'}</span>
      `;
    } else if (rollExpr) {
      // Parse roll expression like 1d20+5, 2d6+3, 1d8
      const parsed = String(rollExpr).trim().match(/^(\d+)d(\d+)(?:\s*([+\-])\s*(\d+))?$/i);
      if (parsed) {
        const count = parseInt(parsed[1], 10);
        const die = parseInt(parsed[2], 10);
        const sign = parsed[3] || '+';
        let mod = parsed[4] ? parseInt(parsed[4], 10) : 0;
        if (sign === '-') mod = -mod;

        const rolls = [];
        let total = mod;
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * die) + 1;
          rolls.push(r);
          total += r;
        }

        if (count === 1 && die === 20) {
          if (rolls[0] === 20) isCrit = true;
          if (rolls[0] === 1) isFumble = true;
        }

        const rollsStr = rolls.length > 1 ? `[${rolls.join(', ')}]` : `[${rolls[0]}]`;
        const modStr = mod !== 0 ? ` ${sign} ${Math.abs(mod)}` : '';
        const critNotice = isCrit ? ' <strong style="color: #10b981;">(CRIT! 🌟)</strong>' : (isFumble ? ' <strong style="color: #ef4444;">(FUMBLE! 💀)</strong>' : '');

        entryHtml = `
          <span><strong>${label}</strong> (${rollExpr}): ${rollsStr}${modStr}${critNotice}</span>
          <span style="font-size: 14px; font-weight: 800; color: #fff;">= ${total}</span>
        `;
      } else {
        entryHtml = `<span>${label} (${rollExpr})</span>`;
      }
    }

    if (testRollLog) {
      const itemEl = document.createElement('div');
      itemEl.className = `test-roll-entry ${isCrit ? 'crit' : ''} ${isFumble ? 'fumble' : ''}`;
      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="text-muted" style="font-size: 10px;">[${now}]</span>
          ${entryHtml}
        </div>
      `;

      // Remove hint if present
      const hint = testRollLog.querySelector('.test-roll-hint');
      if (hint) hint.remove();

      testRollLog.prepend(itemEl);
    }

    // Also display floating toast notification on screen
    showSystemToast(`<span style="font-size: 16px;">🎲</span> <div>${entryHtml}</div>`, 2800, `${isCrit ? 'crit' : ''} ${isFumble ? 'fumble' : ''}`);
  }

  // Clear test roll tray
  if (btnClearTestRollTray && testRollLog) {
    btnClearTestRollTray.addEventListener('click', () => {
      testRollLog.innerHTML = '<div class="test-roll-hint">Click any attack roll (+X to hit), damage formula, or save DC in the preview above to test rolls!</div>';
    });
  }

  // Hook live preview updating to all visual inputs and JSON textarea
  if (entityVisualFormsWrap) {
    entityVisualFormsWrap.addEventListener('input', () => updateLivePreviewThrottled());
    entityVisualFormsWrap.addEventListener('change', () => updateLivePreviewThrottled());
  }
  if (entityEntryJsonTextarea) {
    entityEntryJsonTextarea.addEventListener('input', () => updateLivePreviewThrottled());
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
  // ARCHETYPE MONSTER WIZARD MODAL
  // =========================================================================
  if (btnActionArchetypeWizard) {
    btnActionArchetypeWizard.addEventListener('click', () => {
      menuAddEntryOptions?.classList.add('vtt-hidden');
      openArchetypeWizardModal();
    });
  }

  function openArchetypeWizardModal() {
    if (!modalArchetypeWizard || !activeEditingSource) return;
    modalArchetypeWizard.classList.remove('vtt-hidden');
    updateWizardBenchmarkPreview();
  }

  if (btnCloseArchetypeWizard) {
    btnCloseArchetypeWizard.addEventListener('click', () => modalArchetypeWizard.classList.add('vtt-hidden'));
  }
  if (btnCancelArchetypeWizard) {
    btnCancelArchetypeWizard.addEventListener('click', () => modalArchetypeWizard.classList.add('vtt-hidden'));
  }

  // Archetype card selection
  if (archetypeCardsContainer) {
    archetypeCardsContainer.querySelectorAll('.archetype-choice-card').forEach(card => {
      card.addEventListener('click', () => {
        archetypeCardsContainer.querySelectorAll('.archetype-choice-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedArchetypeRole = card.getAttribute('data-archetype') || 'brute';
        updateWizardBenchmarkPreview();
      });
    });
  }

  if (wizardArchetypeCr) {
    wizardArchetypeCr.addEventListener('change', () => updateWizardBenchmarkPreview());
  }

  function updateWizardBenchmarkPreview() {
    if (!wizardBenchmarkPreview || !wizardArchetypeCr) return;
    const cr = wizardArchetypeCr.value || '1';
    const benchmark = CR_BENCHMARKS[cr] || CR_BENCHMARKS['1'];
    const pb = benchmark.pb || 2;

    let ac = benchmark.ac;
    let hp = benchmark.hp;
    let atk = benchmark.atk;
    let dmg = benchmark.dmg;
    let dc = benchmark.dc;

    switch (selectedArchetypeRole) {
      case 'brute':
        ac = Math.max(10, benchmark.ac - 1);
        hp = Math.round(benchmark.hp * 1.25);
        break;
      case 'skirmisher':
        ac = benchmark.ac + 1;
        hp = Math.max(5, Math.round(benchmark.hp * 0.85));
        break;
      case 'spellcaster':
        ac = Math.max(10, benchmark.ac - 1);
        hp = Math.max(5, Math.round(benchmark.hp * 0.75));
        break;
      case 'minion':
        ac = benchmark.ac;
        hp = 1;
        dmg = Math.max(2, Math.round(benchmark.dmg * 0.4));
        break;
      case 'boss':
        ac = benchmark.ac + 2;
        hp = Math.round(benchmark.hp * 1.5);
        atk = benchmark.atk + 1;
        break;
    }

    wizardBenchmarkPreview.innerHTML = `
      <div class="stat-item"><span class="stat-label">Armor Class</span><span class="stat-val">${ac}</span></div>
      <div class="stat-item"><span class="stat-label">Hit Points</span><span class="stat-val">${hp}</span></div>
      <div class="stat-item"><span class="stat-label">Attack Bonus</span><span class="stat-val">+${atk} to hit</span></div>
      <div class="stat-item"><span class="stat-label">Avg Damage</span><span class="stat-val">~${dmg} / turn</span></div>
      <div class="stat-item"><span class="stat-label">Save DC</span><span class="stat-val">DC ${dc}</span></div>
      <div class="stat-item"><span class="stat-label">Proficiency</span><span class="stat-val">+${pb}</span></div>
    `;
  }

  if (btnSubmitArchetypeWizard) {
    btnSubmitArchetypeWizard.addEventListener('click', () => {
      if (!activeEditingSource) return;

      const cr = wizardArchetypeCr?.value || '1';
      const name = wizardArchetypeName?.value?.trim() || '';
      const type = wizardArchetypeType?.value || 'Humanoid';
      const size = wizardArchetypeSize?.value || 'Medium';

      const created = createEntityFromArchetype({
        archetypeId: selectedArchetypeRole,
        cr,
        name,
        type,
        size,
        sourceCode: activeEditingSource.code
      });

      activeSourceEntities.push(created);
      modalArchetypeWizard.classList.add('vtt-hidden');
      renderEntitySidebarList();
      selectActiveEntity(activeSourceEntities.length - 1);

      // Reset name input for next time
      if (wizardArchetypeName) wizardArchetypeName.value = '';
    });
  }

  // =========================================================================
  // PLAINTEXT STATBLOCK & SPELL IMPORTER MODAL
  // =========================================================================
  if (btnActionPlaintextImport) {
    btnActionPlaintextImport.addEventListener('click', () => {
      menuAddEntryOptions?.classList.add('vtt-hidden');
      openPlaintextImportModal();
    });
  }

  function openPlaintextImportModal() {
    if (!modalPlaintextImport || !activeEditingSource) return;
    modalPlaintextImport.classList.remove('vtt-hidden');
    handlePlaintextInput();
  }

  if (btnClosePlaintextImport) {
    btnClosePlaintextImport.addEventListener('click', () => modalPlaintextImport.classList.add('vtt-hidden'));
  }
  if (btnCancelPlaintextImport) {
    btnCancelPlaintextImport.addEventListener('click', () => modalPlaintextImport.classList.add('vtt-hidden'));
  }

  if (plaintextImportTextarea) {
    plaintextImportTextarea.addEventListener('input', () => handlePlaintextInput());
  }

  function handlePlaintextInput() {
    if (!plaintextImportTextarea || !plaintextDetectionBox || !plaintextDetectionStatus) return;
    const raw = plaintextImportTextarea.value.trim();

    if (!raw) {
      currentParsedPlaintextResult = null;
      btnSubmitPlaintextImport.disabled = true;
      plaintextDetectionBox.className = 'plaintext-detection-box mt-12';
      plaintextDetectionStatus.textContent = 'Paste text above to auto-detect 5e format...';
      return;
    }

    try {
      const parsed = parsePlaintextStatblock(raw, activeEditingSource?.category || 'bestiary', activeEditingSource?.code || 'MYBREW');
      if (parsed && parsed.entity && parsed.entity.name) {
        currentParsedPlaintextResult = parsed;
        btnSubmitPlaintextImport.disabled = false;
        plaintextDetectionBox.className = 'plaintext-detection-box mt-12 detected-success';

        if (parsed.category === 'bestiary') {
          const e = parsed.entity;
          plaintextDetectionStatus.textContent = `✅ Detected 5e Creature "${e.name}" (CR ${e.cr}, AC ${e.ac}, HP ${e.hpAvg}, ${e.traits.length} Traits, ${e.actions.length} Actions)`;
        } else if (parsed.category === 'spells') {
          const s = parsed.entity;
          plaintextDetectionStatus.textContent = `✅ Detected 5e Spell "${s.name}" (Level ${s.level} ${s.school}, Casting Time: ${s.castingTimeNum} ${s.castingTimeUnit})`;
        } else if (parsed.category === 'items') {
          const i = parsed.entity;
          plaintextDetectionStatus.textContent = `✅ Detected 5e Item "${i.name}" (${i.itemType}, ${i.rarity})`;
        } else {
          plaintextDetectionStatus.textContent = `✅ Detected entry "${parsed.entity.name}"`;
        }
      } else {
        currentParsedPlaintextResult = null;
        btnSubmitPlaintextImport.disabled = true;
        plaintextDetectionBox.className = 'plaintext-detection-box mt-12 detected-warning';
        plaintextDetectionStatus.textContent = '⚠️ Could not clearly identify a 5e statblock, spell, or item. Ensure a name and properties are present.';
      }
    } catch (err) {
      currentParsedPlaintextResult = null;
      btnSubmitPlaintextImport.disabled = true;
      plaintextDetectionBox.className = 'plaintext-detection-box mt-12 detected-warning';
      plaintextDetectionStatus.textContent = `⚠️ Parser error: ${err.message}`;
    }
  }

  if (btnInsertSamplePlaintext) {
    btnInsertSamplePlaintext.addEventListener('click', () => {
      if (!plaintextImportTextarea || !activeEditingSource) return;
      const cat = activeEditingSource.category;

      if (cat === 'spells') {
        plaintextImportTextarea.value = `Fireball
3rd-level evocation
Casting Time: 1 action
Range: 150 feet
Components: V, S, M (a tiny ball of bat guano and sulfur)
Duration: Instantaneous
A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.
At Higher Levels. When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.`;
      } else if (cat === 'items') {
        plaintextImportTextarea.value = `Cloak of Elvenkind
Wondrous Item, uncommon (requires attunement)
While you wear this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage, and you have advantage on Dexterity (Stealth) checks made to hide, as the cloak's color shifts to camouflage you. Pulling the hood up or down requires an action.`;
      } else {
        plaintextImportTextarea.value = `Goblin Raider
Small humanoid (goblinoid), neutral evil
Armor Class 15 (leather armor, shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (-1) 14 (+2) 10 (+0) 10 (+0) 8 (-1) 8 (-1)
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
Challenge 1/4 (50 XP) Proficiency Bonus +2
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
ACTIONS
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.
Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.`;
      }

      handlePlaintextInput();
    });
  }

  if (btnSubmitPlaintextImport) {
    btnSubmitPlaintextImport.addEventListener('click', () => {
      if (!currentParsedPlaintextResult || !activeEditingSource) return;

      if (currentParsedPlaintextResult.category !== activeEditingSource.category) {
        const proceed = confirm(`Detected entry is formatted for "${currentParsedPlaintextResult.category.toUpperCase()}", but this sourcebook is for "${activeEditingSource.category.toUpperCase()}". Do you wish to import anyway?`);
        if (!proceed) return;
      }

      const entity = currentParsedPlaintextResult.entity;
      entity.source = activeEditingSource.code;
      activeSourceEntities.push(entity);
      modalPlaintextImport.classList.add('vtt-hidden');
      renderEntitySidebarList();
      selectActiveEntity(activeSourceEntities.length - 1);

      if (plaintextImportTextarea) plaintextImportTextarea.value = '';
    });
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

