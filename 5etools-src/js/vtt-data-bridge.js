// DnDForged 5etools Data Bridge

export function initVttDataBridge(vtt) {
    const listContainer = document.getElementById('library-monster-list');
    const searchInput = document.getElementById('library-search');
    const viewport = document.getElementById('vtt-canvas-viewport');
    
    let monsters = [];
    
    // Map importer cache
    let mapCatalog = null;

    // Load D&D 5e Monster Manual data directly from 5etools' local static files
    loadBestiaryData();

    async function loadBestiaryData() {
        try {
            listContainer.innerHTML = '<div class="text-muted p-3">Loading bestiary data...</div>';
            
            const indexRes = await fetch('data/bestiary/index.json');
            if (!indexRes.ok) throw new Error('Could not load bestiary index.json');
            const indexData = await indexRes.json();
            
            const fetchPromises = Object.values(indexData).map(filename => 
                fetch(`data/bestiary/${filename}`)
                    .then(res => res.ok ? res.json() : { monster: [] })
                    .catch(() => ({ monster: [] }))
            );
            
            const results = await Promise.all(fetchPromises);
            
            monsters = [];
            results.forEach(data => {
                if (data && data.monster && Array.isArray(data.monster)) {
                    data.monster.forEach(m => m.__prop = "monster");
                    monsters.push(...data.monster);
                }
            });
            
            // Resolve 5etools _copy references so modified creatures (like Ireena Kolyana) have full stat blocks
            if (typeof DataUtil !== "undefined" && DataUtil.monster && DataUtil.monster.pMergeCopy) {
                for (let i = 0; i < monsters.length; i++) {
                    if (monsters[i]._copy) {
                        try {
                            await DataUtil.monster.pMergeCopy(monsters, monsters[i]);
                        } catch (err) {
                            console.warn("Failed to merge copy for", monsters[i].name, err);
                        }
                    }
                }
            }

            renderMonsterList(monsters);
        } catch (e) {
            console.error("Error fetching 5etools bestiary data:", e);
            listContainer.innerHTML = '<div class="text-danger p-3"><i class="fa-solid fa-triangle-exclamation"></i> Error accessing bestiary library.</div>';
        }
    }

    function renderMonsterList(list) {
        listContainer.innerHTML = '';
        if (list.length === 0) {
            listContainer.innerHTML = '<div class="text-muted p-3">No monsters found.</div>';
            return;
        }

        // Show top 100 results for performance
        list.slice(0, 100).forEach(monster => {
            const item = document.createElement('div');
            item.className = 'library-item';
            item.draggable = true;
            
            // Format challenge rating (CR)
            let crStr = monster.cr ? (typeof monster.cr === 'object' ? monster.cr.cr : monster.cr) : '0';
            
            item.innerHTML = `
                <span class="lib-item-name">${monster.name} <span style="font-size:0.75em; color:var(--color-text-muted);">[${monster.source || 'Unknown'}]</span></span>
                <span class="lib-item-cr">CR ${crStr}</span>
            `;

            // Calculate VTT attributes
            const hp = calculateMonsterHp(monster);
            const size = translateSizeCategory(monster.size);
            const imageUrl = getMonsterImageUrl(monster);

            // Drag start handler - packages token payload
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'bestiary',
                    name: monster.name,
                    hp: hp,
                    maxHp: hp,
                    size: size,
                    img: imageUrl,
                    monsterData: monster // Full stat block for creature sheet
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });

            // Clicking opens creature sheet (not spawning)
            item.addEventListener('click', () => {
                if (window.VTT?.creatureSheet) {
                    window.VTT.creatureSheet.openSheet(monster, null);
                }
            });

            listContainer.appendChild(item);
        });
    }

    // Live search filter
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const filtered = monsters.filter(m => {
            const nameMatch = m.name.toLowerCase().includes(query);
            const crStr = m.cr ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase() : '0';
            const crMatch = crStr === query || crStr.includes(query) || `cr ${crStr}`.includes(query) || `cr${crStr}`.includes(query);
            return nameMatch || crMatch;
        });
        renderMonsterList(filtered);
    });

    // Translate 5etools sizes (S, M, L, H, G) to grid square sizes
    function translateSizeCategory(sizeLetter) {
        if (!sizeLetter) return 1;
        const letter = Array.isArray(sizeLetter) ? sizeLetter[0] : sizeLetter;
        switch(letter.toUpperCase()) {
            case 'T': return 1; // Tiny
            case 'S': return 1; // Small
            case 'M': return 1; // Medium
            case 'L': return 2; // Large
            case 'H': return 3; // Huge
            case 'G': return 4; // Gargantuan
            default: return 1;
        }
    }

    // Resolve HP from formula or static averages
    function calculateMonsterHp(monster) {
        if (monster.hp && monster.hp.average) return monster.hp.average;
        if (monster.hp && monster.hp.formula) {
            // Quick evaluate or default fallback
            return parseInt(monster.hp.formula.split('d')[0]) * 5 || 20;
        }
        return 20;
    }

    // Parse maximum vision distance from senses array
    function parseMonsterVision(monster) {
        if (!monster || !monster.senses) return 60;
        let maxVision = 0;
        const senses = Array.isArray(monster.senses) ? monster.senses : [monster.senses];
        senses.forEach(sense => {
            if (typeof sense === 'string') {
                const match = sense.match(/(?:darkvision|blindsight|truesight|tremorsense)\s*(\d+)/i);
                if (match && match[1]) {
                    const dist = parseInt(match[1], 10);
                    if (dist > maxVision) maxVision = dist;
                }
            }
        });
        return maxVision > 0 ? maxVision : 60;
    }

    // Parse image location matching 5etools folder structure
    function getMonsterImageUrl(monster) {
        if (monster && monster.hasToken) {
            if (typeof Renderer !== 'undefined' && Renderer.monster && Renderer.monster.getTokenUrl) {
                return Renderer.monster.getTokenUrl(monster);
            }
            // Fallback
            const cleanName = typeof Parser !== 'undefined' ? Parser.nameToTokenName(monster.name) : monster.name.replace(/ /g, '-').toLowerCase();
            const source = monster.source;
            return `img/bestiary/tokens/${source}/${cleanName}.webp`;
        }
        // Fallback procedural token or generic dragon
        return 'favicon.svg';
    }

    // Direct drag-and-drop landing handler on viewport canvas
    viewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        
        try {
            const rawData = e.dataTransfer.getData('application/json');
            if (!rawData) return;
            const data = JSON.parse(rawData);
            
            if (data.type === 'bestiary') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                
                // Use the exposed coordinates resolver tool to get true canvas coordinate of drag
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                
                const sizePx = data.size * grid.size * grid.scale;

                const token = {
                    id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: data.name,
                    x: mouse.x - sizePx / 2, // Center dropped entity
                    y: mouse.y - sizePx / 2,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    size: data.size,
                    sightRange: parseMonsterVision(data.monsterData),
                    img: data.img,
                    isPlayer: false,
                    layer: canvasEngine.getActiveLayer(),
                    isBorderless: true,
                    monsterData: data.monsterData || null // Full stat block
                };

                // Apply grid snapping alignment
                const snap = snapToCoords(token.x, token.y, grid);
                token.x = snap.x;
                token.y = snap.y;

                canvasEngine.addToken(token);
                
                // Log spawn message
                // window.VTT.socket.emit('chat:msg', {
                //     text: `GM spawned token: **${data.name}** (HP: ${data.hp}/${data.maxHp}, Size: ${data.size}x${data.size})`
                // });
            } else if (data.type === 'player') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                const sizePx = data.size * grid.size * grid.scale;
                
                let charRef = null;
                if (data.characterId && window.VTT?.campaignState?.characters) {
                    charRef = window.VTT.campaignState.characters[data.characterId];
                }

                let tokenImg = data.img;
                if (!tokenImg && charRef) {
                    if (charRef.tokenImages && charRef.tokenImages.length > 0 && charRef.activeTokenIndex !== -1) {
                        const idx = charRef.activeTokenIndex || 0;
                        if (idx >= 0 && idx < charRef.tokenImages.length) {
                            tokenImg = charRef.tokenImages[idx].url;
                        } else {
                            tokenImg = 'favicon.svg';
                        }
                    } else if (charRef.monsterData) {
                        tokenImg = getMonsterImageUrl(charRef.monsterData);
                    } else {
                        tokenImg = 'favicon.svg';
                    }
                }

                const finalSize = charRef && charRef.tokenSize !== undefined ? charRef.tokenSize : data.size;

                const token = {
                    id: `token_pc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: data.name,
                    x: mouse.x - sizePx / 2,
                    y: mouse.y - sizePx / 2,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    tempHp: data.tempHp || 0,
                    size: finalSize,
                    sightRange: data.sightRange || 60,
                    img: tokenImg,
                    isPlayer: true,
                    characterId: data.characterId,
                    layer: canvasEngine.getActiveLayer(),
                    isBorderless: true,
                    
                    // Auras, Light and FX - fallback to charRef properties
                    auras: data.auras || (charRef && charRef.tokenAuras) || [],
                    lightEnabled: data.lightEnabled !== undefined ? data.lightEnabled : (charRef ? charRef.tokenLightEnabled : false),
                    lightBright: data.lightBright !== undefined ? data.lightBright : (charRef ? charRef.tokenLightBright : 0),
                    lightDim: data.lightDim !== undefined ? data.lightDim : (charRef ? charRef.tokenLightDim : 0),
                    lightColor: data.lightColor || (charRef ? charRef.tokenLightColor : '#ffaa00'),
                    fxOverlayEnabled: data.fxOverlayEnabled !== undefined ? data.fxOverlayEnabled : (charRef ? charRef.fxOverlayEnabled : false),
                    fxOverlayOpacity: data.fxOverlayOpacity !== undefined ? data.fxOverlayOpacity : (charRef ? charRef.fxOverlayOpacity : 0.3),
                    fxOverlayColor: data.fxOverlayColor || (charRef ? charRef.fxOverlayColor : '#007bff'),
                    fxVignetteEnabled: data.fxVignetteEnabled !== undefined ? data.fxVignetteEnabled : (charRef ? charRef.fxVignetteEnabled : false),
                    fxVignetteOpacity: data.fxVignetteOpacity !== undefined ? data.fxVignetteOpacity : (charRef ? charRef.fxVignetteOpacity : 0.6),
                    fxVignetteColor: data.fxVignetteColor || (charRef ? charRef.fxVignetteColor : '#000000'),
                    fxShadowEnabled: data.fxShadowEnabled !== undefined ? data.fxShadowEnabled : (charRef ? charRef.fxShadowEnabled : false),
                    fxShadowBlur: data.fxShadowBlur !== undefined ? data.fxShadowBlur : (charRef ? charRef.fxShadowBlur : 12),
                    fxShadowOffset: data.fxShadowOffset !== undefined ? data.fxShadowOffset : (charRef ? charRef.fxShadowOffset : 4),
                    fxShadowColor: data.fxShadowColor || (charRef ? charRef.fxShadowColor : '#000000'),
                    fxShadowOpacity: data.fxShadowOpacity !== undefined ? data.fxShadowOpacity : (charRef ? charRef.fxShadowOpacity : 0.7),
                    isVideo: tokenImg && typeof tokenImg === 'string' && (() => { const _c = tokenImg.split('?')[0].toLowerCase(); return _c.endsWith('.gif') || _c.endsWith('.mp4') || _c.endsWith('.webm'); })() || (tokenImg && typeof tokenImg === 'string' && tokenImg.includes('youtube.com'))
                };

                // Backward compatibility for aura
                if (token.auras && token.auras.length > 0) {
                    token.auraEnabled = true;
                    token.auraRange = token.auras[0].range;
                    token.auraShape = token.auras[0].shape;
                    token.auraStyle = token.auras[0].style;
                    token.auraOpacity = token.auras[0].opacity;
                    token.auraColor = token.auras[0].color;
                } else {
                    token.auraEnabled = false;
                }

                // Apply grid snapping alignment
                const snap = snapToCoords(token.x, token.y, grid);
                token.x = snap.x;
                token.y = snap.y;

                canvasEngine.addToken(token);
                
                // Log spawn message
                // window.VTT.socket.emit('chat:msg', {
                //     text: `Player **${data.name}** joined the map.`
                // });
            } else if (data.type === 'vtt-asset') {
                const canvasEngine = window.VTT.canvasEngine;
                const grid = canvasEngine.getGrid();
                const mouse = canvasEngine.getCanvasMouseCoords(e);
                
                const spawnAsset = (pixelWidth, pixelHeight) => {
                    let finalUrl = data.url;
                    
                    // Convert raw YouTube URLs to embed URLs if needed
                    if (finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be')) {
                        if (!finalUrl.includes('/embed/')) {
                            const ytMatch = finalUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                            if (ytMatch && ytMatch[1]) {
                                const videoId = ytMatch[1];
                                const listMatch = finalUrl.match(/[?&]list=([^#\&\?]+)/);
                                finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1`;
                                if (listMatch && listMatch[1]) {
                                    finalUrl += `&list=${listMatch[1]}`;
                                } else {
                                    finalUrl += `&playlist=${videoId}`;
                                }
                            }
                        }
                    }

                    const token = {
                        id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        name: data.name,
                        x: mouse.x - pixelWidth / 2,
                        y: mouse.y - pixelHeight / 2,
                        hp: 0,
                        maxHp: 0,
                        size: 1,
                        img: finalUrl,
                        isVideo: data.assetType === 'video' || finalUrl.includes('youtube.com') || finalUrl.split('?')[0].toLowerCase().endsWith('.gif'),
                        isAsset: true,
                        pixelWidth: pixelWidth,
                        pixelHeight: pixelHeight,
                        isPlayer: false,
                        layer: canvasEngine.getActiveLayer(),
                        monsterData: null
                    };

                    const snap = snapToCoords(token.x, token.y, grid);
                    token.x = snap.x;
                    token.y = snap.y;

                    canvasEngine.addToken(token);
                    
                    // window.VTT.socket.emit('chat:msg', {
                    //     text: `GM placed an asset: **${data.name}**`
                    // });
                };

                const maxDim = grid.size * grid.scale;
                if (data.assetType === 'video' || data.url.includes('youtube.com')) {
                    // Assume 16:9
                    spawnAsset(maxDim, maxDim * (9/16));
                } else {
                    const img = new Image();
                    img.onload = () => {
                        const nw = img.naturalWidth || maxDim;
                        const nh = img.naturalHeight || maxDim;
                        const scale = maxDim / Math.max(nw, nh);
                        spawnAsset(nw * scale, nh * scale);
                    };
                    img.onerror = () => spawnAsset(maxDim, maxDim);
                    img.src = data.url;
                }
            }
        } catch(err) {
            console.error("Drop failed:", err);
        }
    });

    function getNearestHexFeatures(x, y, grid, unitSize) {
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;
        const isVert = grid.type === 'hex-v';
        const R = unitSize / Math.sqrt(3);
        let bestDistCenter = Infinity;
        let bestCx = x, bestCy = y;
        
        const checkHex = (cx, cy) => {
            const cDist = (cx - x) ** 2 + (cy - y) ** 2;
            if (cDist < bestDistCenter) {
                bestDistCenter = cDist;
                bestCx = cx;
                bestCy = cy;
            }
        };

        if (isVert) {
            const W = Math.sqrt(3) * R;
            const ySpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / W);
            const estR = Math.round((y - offsetY) / ySpacing);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * W + (Math.abs(r) % 2 === 1 ? W / 2 : 0);
                    const cy = offsetY + r * ySpacing;
                    checkHex(cx, cy);
                }
            }
        } else {
            const H = Math.sqrt(3) * R;
            const xSpacing = 1.5 * R;
            const estC = Math.round((x - offsetX) / xSpacing);
            const estR = Math.round((y - offsetY) / H);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = estR + dr;
                    const c = estC + dc;
                    const cx = offsetX + c * xSpacing;
                    const cy = offsetY + r * H + (Math.abs(c) % 2 === 1 ? H / 2 : 0);
                    checkHex(cx, cy);
                }
            }
        }
        return { cx: bestCx, cy: bestCy };
    }

    function snapToCoords(x, y, grid) {
        if (!grid || !grid.size) return { x, y };
        const size = grid.size * grid.scale;
        const offsetX = grid.offsetX || 0;
        const offsetY = grid.offsetY || 0;

        if (grid.type === 'hex-v' || grid.type === 'hex-h') {
            const px = x + size / 2;
            const py = y + size / 2;
            const hex = getNearestHexFeatures(px, py, grid, size);
            return { x: hex.cx - size / 2, y: hex.cy - size / 2 };
        }

        const snapX = Math.round((x - offsetX) / size) * size + offsetX;
        const snapY = Math.round((y - offsetY) / size) * size + offsetY;
        return { x: snapX, y: snapY };
    }

    function spawnMonsterAtCenter(name, hp, size, img, monsterData) {
        const canvasEngine = window.VTT.canvasEngine;
        if (!canvasEngine) return;
        const grid = canvasEngine.getGrid();
        
        const token = {
            id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            x: 200, // Spawn at standard default coords
            y: 200,
            hp: hp,
            maxHp: hp,
            size: size,
            sightRange: parseMonsterVision(monsterData),
            img: img,
            isPlayer: false,
            layer: canvasEngine.getActiveLayer(),
            monsterData: monsterData || null // Full stat block for creature sheet
        };

        const snap = snapToCoords(token.x, token.y, grid);
        token.x = snap.x;
        token.y = snap.y;

        canvasEngine.addToken(token);

        // Notify chat
        // window.VTT.socket.emit('chat:msg', {
        //     text: `GM spawned token: **${name}** (HP: ${hp}/${hp})`
        // });
    }

    // Support initiative tracker integration
    document.getElementById('btn-init-add').addEventListener('click', () => {
        const name = prompt("Enter creature name for initiative:");
        if (!name) return;
        const initiativeRoll = prompt("Enter initiative roll (or leave blank for random 1d20):");
        
        let score = parseInt(initiativeRoll);
        if (isNaN(score)) {
            score = Math.floor(Math.random() * 20) + 1;
        }

        const canvasEngine = window.VTT.canvasEngine;
        const currentTokens = canvasEngine.getTokens();
        
        // Spawn active token if doesn't exist
        const tokenId = `pc_${Date.now()}`;
        const pcToken = {
            id: tokenId,
            name: name,
            x: 100,
            y: 100,
            hp: 0,
            maxHp: 0,
            size: 1,
            img: 'favicon.svg',
            isPlayer: true,
            layer: 'token'
        };
        canvasEngine.addToken(pcToken);

        // Add to VTT combat roster
        const chatEngine = window.VTT.chatEngine;
        if (chatEngine) {
            chatEngine.addToInitiative(name, score, tokenId);
        }
    });

    // Tab switching logic for Bestiary Drawer
    document.querySelectorAll('.lib-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.lib-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--color-text-secondary)';
            });
            e.target.classList.add('active');
            e.target.style.borderBottomColor = 'var(--color-gold-base)';
            e.target.style.color = 'var(--color-text-primary)';
            
            document.querySelectorAll('.lib-tab-content').forEach(c => {
                c.classList.add('vtt-hidden');
                c.classList.remove('active');
            });
            const targetContent = document.getElementById(e.target.dataset.tab);
            if (targetContent) {
                targetContent.classList.remove('vtt-hidden');
                targetContent.classList.add('active');
            }
            
            if (e.target.dataset.tab === 'lib-custom') {
                renderCustomNpcList();
            }
        });
    });

    const btnAddCustomNpc = document.getElementById('btn-add-custom-npc');
    if (btnAddCustomNpc) {
        btnAddCustomNpc.addEventListener('click', openNpcImportModal);
    }

    function openNpcImportModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10001;';
        
        const modal = document.createElement('div');
        modal.className = 'glassmorphism';
        modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:10002; width:500px; max-height:80vh; display:flex; flex-direction:column; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle); background: var(--color-bg-base);';
        
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; color:var(--color-gold-base);"><i class="fa-solid fa-file-import"></i> Import Bestiary Template</h3>
                <button id="npc-modal-close" class="btn btn-icon btn-secondary"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
                <input type="text" id="npc-search" class="vtt-input" style="width: 100%;" placeholder="Search monsters (e.g., Goblin)..." autofocus>
            </div>
            <div id="npc-list" class="scroll-styled" style="flex:1; border:1px solid var(--color-border-subtle); background:rgba(0,0,0,0.2); overflow-y:auto; padding:4px; min-height:300px; border-radius: 4px;"></div>
        `;
        
        document.body.appendChild(modalOverlay);
        document.body.appendChild(modal);
        
        const listEl = modal.querySelector('#npc-list');
        const searchInput = modal.querySelector('#npc-search');
        
        const renderList = (query) => {
            listEl.innerHTML = '';
            const q = query.toLowerCase().trim();
            const filtered = monsters.filter(m => {
                if (!q) return true;
                const nameMatch = m.name.toLowerCase().includes(q);
                const crStr = m.cr ? (typeof m.cr === 'object' ? String(m.cr.cr) : String(m.cr)).toLowerCase() : '0';
                const crMatch = crStr === q || crStr.includes(q) || `cr ${crStr}`.includes(q) || `cr${crStr}`.includes(q);
                return nameMatch || crMatch;
            }).slice(0, 50);
            
            filtered.forEach(m => {
                const row = document.createElement('div');
                row.style.cssText = 'padding:8px; border-bottom:1px solid var(--color-border-subtle); cursor:pointer; display:flex; justify-content:space-between; align-items: center; border-radius: 4px; margin-bottom: 2px; transition: background 0.2s;';
                row.innerHTML = `<span><strong style="color:var(--color-text-primary);">${m.name}</strong> <span style="font-size:0.75em; color:var(--color-text-muted);">[${m.source || 'Unknown'}]</span></span> <span style="color:var(--color-text-muted); font-size: 0.85em;">CR ${m.cr ? (m.cr.cr || m.cr) : '0'}</span>`;
                row.addEventListener('click', () => {
                    promptCustomNpcName(m);
                    closeModal();
                });
                row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.05)';
                row.onmouseout = () => row.style.background = 'transparent';
                listEl.appendChild(row);
            });
            if (filtered.length === 0) {
                listEl.innerHTML = '<div style="padding: 12px; color: var(--color-text-muted); text-align: center;">No monsters found.</div>';
            }
        };
        
        const closeModal = () => {
            modalOverlay.remove();
            modal.remove();
        };
        
        modal.querySelector('#npc-modal-close').addEventListener('click', closeModal);
        searchInput.addEventListener('input', (e) => renderList(e.target.value));
        renderList('');
        searchInput.focus();
    }

    function promptCustomNpcName(monster) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999;';
        const modal = document.createElement('div');
        modal.className = 'glassmorphism';
        modal.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:1000; width:400px; padding:16px; border-radius:8px; border:1px solid var(--color-border-subtle);';
        
        modal.innerHTML = `
            <h4 style="margin-top:0; color:var(--color-gold-base);">Import ${monster.name}</h4>
            <div class="form-group">
                <label>Custom Name (Optional)</label>
                <input type="text" id="npc-nickname" placeholder="${monster.name}">
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button id="npc-import-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                <button id="npc-import-save" class="btn btn-primary btn-sm">Import</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        const closeModals = () => {
            overlay.remove();
            modal.remove();
        };
        
        modal.querySelector('#npc-import-cancel').addEventListener('click', closeModals);
        modal.querySelector('#npc-import-save').addEventListener('click', () => {
            const nickname = modal.querySelector('#npc-nickname').value.trim() || monster.name;
            
            let hp = calculateMonsterHp(monster);
            
            const customMonsterData = JSON.parse(JSON.stringify(monster));
            
            const newId = 'npc_' + Date.now();
            const newNpc = {
                id: newId,
                name: nickname,
                isCustomNpc: true,
                monsterData: customMonsterData,
                hpMax: hp,
                hpCurrent: hp,
                tempHp: 0,
                ac: monster.ac ? (Array.isArray(monster.ac) ? (monster.ac[0].ac || monster.ac[0]) : monster.ac) : 10,
                tokenImages: []
            };
            
            if (!vtt.campaignState.characters) vtt.campaignState.characters = {};
            vtt.campaignState.characters[newId] = newNpc;
            
            if (vtt.socket) {
                vtt.socket.emit('character:update', { character: newNpc });
            }
            
            renderCustomNpcList();
            closeModals();
        });
    }

    function renderCustomNpcList() {
        const customListContainer = document.getElementById('library-custom-list');
        if (!customListContainer) return;
        
        const chars = (vtt.campaignState && vtt.campaignState.characters) ? Object.values(vtt.campaignState.characters) : [];
        const customNpcs = chars.filter(c => c.isCustomNpc);
        
        if (customNpcs.length === 0) {
            customListContainer.innerHTML = '<div class="init-empty-state" style="padding: 16px; text-align: center; color: var(--color-text-muted);">No custom NPCs yet. Click "Import & Customize NPC" to add one.</div>';
            return;
        }
        
        let html = '';
        customNpcs.forEach(npc => {
            let tokenImg = getMonsterImageUrl(npc.monsterData || {});
            if (npc.tokenImages && npc.tokenImages.length > 0 && npc.activeTokenIndex !== -1) {
                const idx = npc.activeTokenIndex || 0;
                if (idx >= 0 && idx < npc.tokenImages.length) {
                    tokenImg = npc.tokenImages[idx].url;
                }
            }
            
            const cleanUrl = tokenImg.split('?')[0].toLowerCase();
            const isVideo = cleanUrl.match(/\.(mp4|webm|ogg)$/i);
            const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
            
            let mediaHtml = '';
            if (isVideo) {
                mediaHtml = `<video src="${tokenImg}" autoplay loop muted playsinline style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); object-fit: cover;"></video>`;
            } else if (isYoutube) {
                let ytUrl = tokenImg;
                const ytMatch = tokenImg.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
                if (ytMatch) {
                    const videoId = ytMatch[1];
                    ytUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&playlist=${videoId}`;
                }
                mediaHtml = `<iframe src="${ytUrl}" frameborder="0" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); pointer-events:none;"></iframe>`;
            } else {
                mediaHtml = `<img src="${tokenImg}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--color-gold-base); object-fit: cover;" onerror="this.src='favicon.svg'">`;
            }
            
            html += `
                <div class="library-item custom-npc-row" data-id="${npc.id}" draggable="true" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 8px;">
                    <div style="display: flex; align-items: center; gap: 12px; pointer-events: none;">
                        ${mediaHtml}
                        <div>
                            <div class="lib-item-name" style="line-height: 1.2; font-weight: 600;">${npc.name}</div>
                            <div class="lib-item-cr" style="line-height: 1;">Custom NPC</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:4px;" class="custom-npc-actions">
                        <button class="btn btn-icon btn-secondary btn-edit-custom-npc" data-id="${npc.id}" title="Edit NPC" style="width: 24px; height: 24px; font-size: 0.8rem; padding: 0;"><i class="fa-solid fa-pen pointer-events-none"></i></button>
                        <button class="btn btn-icon btn-danger btn-del-custom-npc" data-id="${npc.id}" title="Delete NPC" style="width: 24px; height: 24px; font-size: 0.8rem; padding: 0;"><i class="fa-solid fa-trash pointer-events-none"></i></button>
                    </div>
                </div>
            `;
        });
        
        customListContainer.innerHTML = html;
        
        customListContainer.querySelectorAll('.custom-npc-row').forEach(row => {
            const id = row.dataset.id;
            const npc = customNpcs.find(c => c.id === id);
            
            row.addEventListener('dragstart', (e) => {
                if(e.target.closest('button')) {
                    e.preventDefault();
                    return;
                }
                
                const size = npc.monsterData ? translateSizeCategory(npc.monsterData.size) : 1;
                
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'player', // Treat as player token to retain character linkage
                    characterId: id,
                    name: npc.name,
                    hp: npc.hpCurrent,
                    maxHp: npc.hpMax,
                    tempHp: npc.tempHp || 0,
                    size: size,
                    img: null,
                    sightRange: parseMonsterVision(npc.monsterData)
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
            
            row.addEventListener('click', (e) => {
                if(e.target.closest('button')) return;
                if (window.VTT?.creatureSheet) {
                    window.VTT.creatureSheet.openSheet(npc.monsterData, null, id);
                }
            });
        });
        
        customListContainer.querySelectorAll('.btn-edit-custom-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const npc = customNpcs.find(c => c.id === id);
                if (window.VTT?.creatureSheet) {
                    window.VTT.creatureSheet.openEditModal(npc.monsterData, id);
                }
            });
        });
        
        customListContainer.querySelectorAll('.btn-del-custom-npc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this custom NPC forever?')) {
                    const id = btn.dataset.id;
                    delete vtt.campaignState.characters[id];
                    if (vtt.socket) {
                        vtt.socket.emit('character:delete', { id });
                    }
                    renderCustomNpcList();
                }
            });
        });
    }

    // Attach to window so other modules can trigger a refresh if needed
    window.VTT = window.VTT || {};
    window.VTT.renderCustomNpcList = renderCustomNpcList;

    if (vtt.socket) {
        vtt.socket.on('character:sync', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('character:updated', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('character:deleted', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });
        vtt.socket.on('campaign:sync', () => {
            if (document.getElementById('lib-custom') && !document.getElementById('lib-custom').classList.contains('vtt-hidden')) {
                renderCustomNpcList();
            }
        });

        vtt.socket.on('handouts:updated', ({ handouts }) => {
            if (vtt.campaignState) {
                vtt.campaignState.handouts = handouts;
            }
            if (vtt.handoutsEngine) {
                vtt.handoutsEngine.renderList();
            }
        });

        vtt.socket.on('handouts:force_show', ({ id }) => {
            if (vtt.handoutsEngine) {
                vtt.handoutsEngine.handleForceShow(id);
            }
        });
    }

    async function load5eToolsMapCatalog(advSelect, mapSelect) {
        if (mapCatalog) {
            populateAdventureDropdown(advSelect, mapSelect);
            return;
        }
        
        try {
            advSelect.innerHTML = '<option value="">Loading 5eTools map catalog...</option>';
            const res = await fetch('data/generated/gendata-maps.json');
            if (!res.ok) throw new Error('Could not load gendata-maps.json');
            mapCatalog = await res.json();
            populateAdventureDropdown(advSelect, mapSelect);
        } catch (e) {
            console.error("Error fetching 5etools map catalog:", e);
            advSelect.innerHTML = '<option value="">Error loading maps.</option>';
        }
    }

    function populateAdventureDropdown(advSelect, mapSelect) {
        advSelect.innerHTML = '<option value="">-- Select an Adventure / Book --</option>';
        
        const sortedAdventures = Object.values(mapCatalog).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        sortedAdventures.forEach(adv => {
            const opt = document.createElement('option');
            opt.value = adv.id;
            opt.textContent = adv.name || adv.id;
            advSelect.appendChild(opt);
        });

        advSelect.addEventListener('change', () => {
            populateMapDropdown(advSelect.value, mapSelect);
        });
    }

    function populateMapDropdown(adventureId, mapSelect) {
        mapSelect.innerHTML = '<option value="">-- Select a Map --</option>';
        
        if (!adventureId || !mapCatalog[adventureId]) {
            mapSelect.disabled = true;
            return;
        }

        const adv = mapCatalog[adventureId];
        mapSelect.disabled = false;
        
        // Flatten chapters into maps list
        const maps = [];
        if (adv.chapters) {
            adv.chapters.forEach(ch => {
                if (ch.images) {
                    ch.images.forEach(img => {
                        // Only add maps that have an actual image path
                        if (img.href && img.href.path) {
                            maps.push({
                                id: img.href.path, // Use path as ID since player maps often lack an explicit 'id'
                                title: img.title || 'Untitled Map',
                                chapterName: ch.name,
                                imageType: img.imageType
                            });
                        }
                    });
                }
            });
        }

        maps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `[${m.chapterName}] ${m.title} (${m.imageType === 'mapPlayer' ? 'Player' : 'GM'})`;
            mapSelect.appendChild(opt);
        });
    }

    async function import5etoolsMap(adventureId, mapPathId) {
        if (!mapCatalog || !adventureId || !mapPathId) return null;
        
        const adv = mapCatalog[adventureId];
        if (!adv || !adv.chapters) return null;

        let targetMap = null;
        for (const ch of adv.chapters) {
            if (ch.images) {
                targetMap = ch.images.find(img => img.href && img.href.path === mapPathId);
                if (targetMap) break;
            }
        }
        
        if (!targetMap) return null;

        // Base 5eTools URL for images
        const baseUrl = 'https://5e.tools/img/';
        const mapUrl = baseUrl + targetMap.href.path;

        // Construct grid
        let mapGrid = { size: 50, offsetX: 0, offsetY: 0, scale: 1.0, feetPerSquare: 5 };
        
        // Some maps inherit grid from mapParent
        let gridSource = targetMap;
        if (!gridSource.grid && targetMap.mapParent && targetMap.mapParent.id) {
            // Find parent
            for (const ch of adv.chapters) {
                if (ch.images) {
                    const parent = ch.images.find(img => img.id === targetMap.mapParent.id);
                    if (parent && parent.grid) {
                        gridSource = parent;
                        break;
                    }
                }
            }
        }
        
        if (gridSource.grid) {
            // Usually 5eTools uses 'square' type with a size in pixels
            // We'll trust their pixel size entirely since it perfectly matches the webp resolution
            mapGrid.size = gridSource.grid.size || 50;
            mapGrid.offsetX = gridSource.grid.offsetX || 0;
            mapGrid.offsetY = gridSource.grid.offsetY || 0;
            // Some grids use a multiplier scale, usually we set scale to 1.0 since size is absolute pixels
            mapGrid.scale = 1.0; 
        }

        // Construct Walls and Notes from mapRegions
        const walls = [];
        const notes = [];
        
        let regionsSource = targetMap;
        // If this is a player map, it usually doesn't have regions, the parent GM map does
        if (!regionsSource.mapRegions && targetMap.mapParent && targetMap.mapParent.id) {
            for (const ch of adv.chapters) {
                if (ch.images) {
                    const parent = ch.images.find(img => img.id === targetMap.mapParent.id);
                    if (parent && parent.mapRegions) {
                        regionsSource = parent;
                        break;
                    }
                }
            }
        }

        if (regionsSource.mapRegions) {
            // Fetch adventure text if we have map regions
            let adventureData = null;
            if (regionsSource.source) {
                try {
                    const sourceName = regionsSource.source.toLowerCase();
                    let res = await fetch(`/data/adventure/adventure-${sourceName}.json`);
                    if (!res.ok) {
                        res = await fetch(`/data/book/book-${sourceName}.json`);
                    }
                    if (res.ok) {
                        adventureData = await res.json();
                        console.log(`[import5etoolsMap] Loaded adventure data for ${sourceName}`);
                    }
                } catch (e) {
                    console.warn(`[import5etoolsMap] Failed to load adventure text:`, e);
                }
            }

            // Helper to recursively find an entry by area ID
            function findEntryById(data, id) {
                if (Array.isArray(data)) {
                    for (let i = 0; i < data.length; i++) {
                        const res = findEntryById(data[i], id);
                        if (res) return res;
                    }
                } else if (typeof data === 'object' && data !== null) {
                    if (data.id === id) return data;
                    // Sometimes entries have an array of entries
                    if (data.entries) {
                        const res = findEntryById(data.entries, id);
                        if (res) return res;
                    }
                }
                return null;
            }

            regionsSource.mapRegions.forEach(region => {
                if (region.points && Array.isArray(region.points)) {
                    const pts = region.points;
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length]; // Connect back to start
                        walls.push({
                            x1: p1[0],
                            y1: p1[1],
                            x2: p2[0],
                            y2: p2[1],
                            type: 'wall' // Defaulting to wall, GM can change to door/window
                        });
                        minX = Math.min(minX, p1[0]);
                        minY = Math.min(minY, p1[1]);
                        maxX = Math.max(maxX, p1[0]);
                        maxY = Math.max(maxY, p1[1]);
                    }

                    // Generate a Note pin if we have an area ID and adventure data
                    if (region.area && adventureData) {
                        const entry = findEntryById(adventureData.data, region.area);
                        if (entry) {
                            notes.push({
                                id: `note_${region.area}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
                                areaId: region.area,
                                name: entry.name || `Area ${region.area}`,
                                content: entry,
                                x: (minX + maxX) / 2,
                                y: (minY + maxY) / 2
                            });
                        }
                    }
                }
            });
        }

        // Determine grid width and height based on the image size and grid size
        let gWidth = undefined;
        let gHeight = undefined;
        if (targetMap.width && mapGrid.size) {
            gWidth = targetMap.width / mapGrid.size;
        }
        if (targetMap.height && mapGrid.size) {
            gHeight = targetMap.height / mapGrid.size;
        }

        return {
            name: targetMap.title || "Imported Map",
            mapImage: mapUrl,
            gridWidth: gWidth,
            gridHeight: gHeight,
            grid: mapGrid,
            walls: walls,
            notes: notes,
            tokens: {},
            shapes: {},
            lights: []
        };
    }

    function pushStateUpdate() {
        if (vtt.socket && vtt.campaignState) {
            vtt.socket.emit('handouts:update', { handouts: vtt.campaignState.handouts || [] });
        }
    }

    function emitForceShowHandout(id) {
        if (vtt.socket) {
            vtt.socket.emit('handouts:force_show', { id });
        }
    }

    return {
        loadBestiaryData,
        renderCustomNpcList,
        pushStateUpdate,
        emitForceShowHandout,
        load5eToolsMapCatalog,
        import5etoolsMap
    };
}
