import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSafeVttUrl } from '../vtt/js/vtt-utils.js';
import { evaluateSafeMath } from '../vtt/js/shared/math-eval.js';
import { SourceManager } from '../electron/source-manager.js';

await import('../vtt/js/network/vtt-p2p-host-engine.js');
await import('../vtt/js/network/vtt-p2p-adapter.js');

const VttP2PHostEngine = globalThis.VttP2PHostEngine;
const VttP2PAdapter = globalThis.VttP2PAdapter;

test('Round 3 Security Remediation', async (t) => {
    await t.test('getSafeVttUrl rejects javascript:, data:text/html, and Discord substring bypasses', () => {
        assert.equal(getSafeVttUrl('javascript:alert(1)'), '');
        assert.equal(getSafeVttUrl('javascript:discordapp.com'), '');
        assert.equal(getSafeVttUrl('vbscript:msgbox(1)'), '');
        assert.equal(getSafeVttUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), '');
        assert.equal(getSafeVttUrl('forgedvtt-asset://a1'), 'forgedvtt-asset://a1');
        assert.equal(
            getSafeVttUrl('https://cdn.discordapp.com/attachments/1/2/token.png'),
            '/api/proxy-discord?url=' + encodeURIComponent('https://cdn.discordapp.com/attachments/1/2/token.png')
        );
        assert.ok(getSafeVttUrl('img/bestiary/tokens/Goblin.webp').startsWith('img/bestiary/tokens/Goblin.webp?v='));
    });

    await t.test('evaluateSafeMath bounds recursion depth and expression length', () => {
        assert.equal(evaluateSafeMath('2 + (3 * 4)'), 14);
        assert.ok(Number.isNaN(evaluateSafeMath('('.repeat(100) + '1' + ')'.repeat(100))));
        assert.ok(Number.isNaN(evaluateSafeMath('1+'.repeat(600) + '1')));
    });

    await t.test('SourceManager rejects path traversal in category', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-src-sec-'));
        try {
            const sm = new SourceManager({ rootDir: process.cwd(), campaignDataDir: tmpDir });
            assert.throws(
                () => sm.createCustomSource({ category: '../outside', code: 'TEST', name: 'Test' }),
                /Invalid/
            );
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    await t.test('P2P Host Engine preserves character ownership and blocks secret/mismatched portals', () => {
        const prevVtt = globalThis.VTT;
        const dispatched = [];
        const adapter = {
            id: 'host_1',
            username: 'GM',
            campaignId: 'camp_1',
            peers: new Map(),
            _dispatch: (evt, ...args) => dispatched.push({ evt, args }),
            _persistHostCampaignState: () => {}
        };
        globalThis.VTT = {
            campaignState: {
                id: 'camp_1',
                activeMapId: 'map_1',
                isPaused: false,
                playerMapOverrides: {},
                characters: {
                    char_1: {
                        id: 'char_1',
                        name: 'Valeros',
                        owner: 'Alice',
                        ownerUsername: 'Alice',
                        assignedPlayers: ['Alice'],
                        players: ['Alice']
                    }
                },
                maps: {
                    map_1: {
                        id: 'map_1',
                        tokens: {
                            tok_1: { id: 'tok_1', name: 'Valeros', owner: 'Alice', x: 100, y: 100, w: 70, h: 70 }
                        },
                        portals: [
                            { id: 'p_secret', isSecret: true, targetMapId: 'map_2', x: 100, y: 100 },
                            { id: 'p_open', isSecret: false, targetMapId: 'map_2', x: 100, y: 100 }
                        ]
                    },
                    map_2: { id: 'map_2', tokens: {}, portals: [] },
                    map_secret: { id: 'map_secret', tokens: {}, portals: [] }
                }
            }
        };

        try {
            const alicePeer = { id: 'p_alice', username: 'Alice', role: 'Player', joined: true };
            // Attempt ownership hijack & monsterData injection on character:update
            VttP2PHostEngine.processEvent({
                adapter,
                event: 'character:update',
                args: [
                    {
                        character: {
                            id: 'char_1',
                            name: 'Valeros',
                            owner: 'Eve',
                            assignedPlayers: ['*'],
                            monsterData: { cr: '30' }
                        }
                    }
                ],
                senderPeer: alicePeer
            });
            const updatedChar = globalThis.VTT.campaignState.characters.char_1;
            assert.equal(updatedChar.owner, 'Alice');
            assert.deepEqual(updatedChar.assignedPlayers, ['Alice']);
            assert.equal(updatedChar.monsterData, undefined);

            // Secret portal blocked
            VttP2PHostEngine.processEvent({
                adapter,
                event: 'portal:teleport_inter_map',
                args: [
                    {
                        tokenId: 'tok_1',
                        sourceMapId: 'map_1',
                        sourcePortalId: 'p_secret',
                        targetMapId: 'map_2',
                        targetX: 50,
                        targetY: 50
                    }
                ],
                senderPeer: alicePeer
            });
            assert.ok(globalThis.VTT.campaignState.maps.map_1.tokens.tok_1);

            // Mismatched targetMapId blocked
            VttP2PHostEngine.processEvent({
                adapter,
                event: 'portal:teleport_inter_map',
                args: [
                    {
                        tokenId: 'tok_1',
                        sourceMapId: 'map_1',
                        sourcePortalId: 'p_open',
                        targetMapId: 'map_secret',
                        targetX: 50,
                        targetY: 50
                    }
                ],
                senderPeer: alicePeer
            });
            assert.ok(globalThis.VTT.campaignState.maps.map_1.tokens.tok_1);
            assert.equal(globalThis.VTT.campaignState.maps.map_secret.tokens.tok_1, undefined);
        } finally {
            globalThis.VTT = prevVtt;
        }
    });

    await t.test('P2P Adapter rejects zero-byte asset-start and text/html transfers', () => {
        const adapter = new VttP2PAdapter({ isHost: true, username: 'GM', campaignId: 'c1' });
        const peer = { id: 'p1', username: 'Alice', role: 'Player', joined: true };
        adapter._handleIncomingData(
            JSON.stringify({
                type: 'asset-start',
                id: 'a1',
                totalChunks: 1,
                totalBytes: 0,
                mimeType: 'image/png'
            }),
            peer
        );
        assert.equal(adapter._assetTransfers.has('a1'), false);

        adapter._handleIncomingData(
            JSON.stringify({
                type: 'asset-start',
                id: 'a2',
                totalChunks: 1,
                totalBytes: 100,
                mimeType: 'text/html'
            }),
            peer
        );
        assert.equal(adapter._assetTransfers.has('a2'), false);
    });
});
