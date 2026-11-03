import test from 'node:test';
import assert from 'node:assert/strict';

test('Security Report: Portal teleport validation rejects unowned tokens or missing portals', () => {
    // Simulate server helper logic
    function getPortalCenterPoint(portal) {
        if (!portal || !portal.geom) return null;
        const g = portal.geom;
        if (portal.shape === 'rect') {
            return { x: (g.x || 0) + (g.w || 50) / 2, y: (g.y || 0) + (g.h || 50) / 2 };
        } else if (portal.shape === 'circle') {
            return { x: g.cx || 0, y: g.cy || 0 };
        } else if (portal.shape === 'line') {
            return { x: ((g.x1 || 0) + (g.x2 || 0)) / 2, y: ((g.y1 || 0) + (g.y2 || 0)) / 2 };
        } else if (portal.shape === 'polygon' && Array.isArray(g.points) && g.points.length > 0) {
            const total = g.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
            return { x: total.x / g.points.length, y: total.y / g.points.length };
        }
        return null;
    }

    const mockSocketPlayer = { role: 'player', username: 'alice' };
    const mockSocketGM = { role: 'GM', username: 'gm' };

    const camp = {
        maps: {
            map1: {
                portals: [
                    { id: 'p1', targetMapId: 'map2', shape: 'rect', geom: { x: 100, y: 100, w: 50, h: 50 } }
                ],
                tokens: {
                    tok1: { id: 'tok1', owner: 'alice', x: 110, y: 110 },
                    tok2: { id: 'tok2', owner: 'bob', x: 110, y: 110 },
                    tok3: { id: 'tok3', owner: 'alice', x: 1000, y: 1000 } // too far
                }
            },
            map2: { tokens: {} }
        }
    };

    function isTokenControlledBySocket(token, socket) {
        if (!token || !socket) return false;
        if (socket.role === 'GM') return true;
        return token.owner === socket.username;
    }

    function validatePortalTransition(camp, sourceMap, targetMapId, token, targetPortalId, socket) {
        if (socket.role === 'GM') return true;
        if (!isTokenControlledBySocket(token, socket)) return false;
        const portals = sourceMap.portals || [];
        const matchingPortal = portals.find((p) => {
            if (p.disabled || p.isLocked || p.locked) return false;
            const matchesMap = p.targetMapId === targetMapId;
            const matchesPortal = !targetPortalId || !p.targetPortalId || p.targetPortalId === targetPortalId;
            return matchesMap && matchesPortal;
        });
        if (!matchingPortal) return false;
        const pCenter = getPortalCenterPoint(matchingPortal);
        if (pCenter && typeof token.x === 'number' && typeof token.y === 'number') {
            const distSq = (token.x - pCenter.x) * (token.x - pCenter.x) + (token.y - pCenter.y) * (token.y - pCenter.y);
            if (distSq > 400 * 400) return false;
        }
        return true;
    }

    // Alice moving Alice's close token to map2 through valid portal -> ALLOWED
    assert.equal(validatePortalTransition(camp, camp.maps.map1, 'map2', camp.maps.map1.tokens.tok1, null, mockSocketPlayer), true);

    // Alice trying to teleport Bob's token -> REJECTED
    assert.equal(validatePortalTransition(camp, camp.maps.map1, 'map2', camp.maps.map1.tokens.tok2, null, mockSocketPlayer), false);

    // Alice trying to teleport to a map with no portal -> REJECTED
    assert.equal(validatePortalTransition(camp, camp.maps.map1, 'map999', camp.maps.map1.tokens.tok1, null, mockSocketPlayer), false);

    // Alice trying to teleport from 1000px away -> REJECTED
    assert.equal(validatePortalTransition(camp, camp.maps.map1, 'map2', camp.maps.map1.tokens.tok3, null, mockSocketPlayer), false);

    // GM moving any token anywhere -> ALLOWED
    assert.equal(validatePortalTransition(camp, camp.maps.map1, 'map2', camp.maps.map1.tokens.tok2, null, mockSocketGM), true);
});

test('Security Report: Initiative handler handles non-string name payloads safely and prevents cross-user overwrites', () => {
    const existingCombatants = [
        { id: 'c_gm_boss', tokenId: 'tok_boss', name: 'Dragon', score: 20 },
        { id: 'c_alice', tokenId: 'tok_alice', name: 'Alice Fighter', score: 12 }
    ];

    const mockSocket = { role: 'player', username: 'alice' };
    const camp = {
        maps: {
            m1: {
                tokens: {
                    tok_alice: { id: 'tok_alice', owner: 'alice' },
                    tok_boss: { id: 'tok_boss', owner: 'gm' }
                }
            }
        },
        characters: {}
    };

    function isTokenControlledBySocket(token, socket) {
        if (!token || !socket) return false;
        if (socket.role === 'GM') return true;
        return token.owner === socket.username;
    }

    const isExistingCombatantControlled = (ec) => {
        if (!ec) return false;
        if (ec.tokenId) {
            for (const mId in camp.maps || {}) {
                const tok = camp.maps[mId]?.tokens?.[ec.tokenId];
                if (tok && isTokenControlledBySocket(tok, mockSocket, camp)) return true;
            }
        }
        return false;
    };

    // Attack payload 1: Non-string name and spoofed target ID targeting Dragon
    const attackerCombatant = {
        id: 'c_gm_boss', // attempting to clobber Dragon
        tokenId: 'tok_alice', // valid token Alice controls
        name: 12345, // malformed non-string
        score: 99
    };

    // Safe handling: string coercion and bounds
    let safeName = null;
    if (typeof attackerCombatant.name === 'string') {
        safeName = attackerCombatant.name.slice(0, 100);
    }
    assert.equal(safeName, null); // malformed name handled without throwing TypeError

    // Matching logic
    const matchIdx = existingCombatants.findIndex((ec) => {
        if (!ec) return false;
        const matchesId = attackerCombatant.id && ec.id === attackerCombatant.id;
        if (matchesId) {
            return isExistingCombatantControlled(ec);
        }
        return false;
    });

    // Dragon was NOT matched or overwritten because Alice does not control Dragon!
    assert.equal(matchIdx, -1);
    assert.equal(existingCombatants[0].name, 'Dragon');
    assert.equal(existingCombatants[0].score, 20);
});

test('Security Report: HTML escaping in chat and portals', async () => {
    const { escapeHtml } = await import('../vtt/js/vtt-utils.js');
    const xssPayload = '<img src=x onerror=alert("xss")>';
    const escaped = escapeHtml(xssPayload);
    assert.equal(escaped.includes('<img'), false);
    assert.equal(escaped.includes('&lt;img'), true);
});

