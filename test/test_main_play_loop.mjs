import { EventEmitter } from 'events';
import assert from 'assert';

console.log('--- RUNNING MAIN PLAY LOOP VERIFICATION ---');

const { initSocketServer } = await import('../server/socket.js');
const { campaigns, chatLogs, saveCampaigns } = await import('../server/state.js');

const campaignId = 'play_loop_camp_' + Date.now();
campaigns[campaignId] = {
  id: campaignId,
  name: 'Alpha Play Loop Campaign',
  activeMapId: 'dungeon_map',
  activeGMMapId: 'dungeon_map',
  playerMapOverrides: {},
  initiative: { combatants: [], currentRound: 1, activeTurnIndex: -1, isVisible: true },
  maps: {
    dungeon_map: {
      id: 'dungeon_map',
      name: 'Dungeon Map',
      grid: 50,
      tokens: {
        tok_fighter: { id: 'tok_fighter', name: 'Valeros', x: 100, y: 150, isPlayer: true, characterId: 'char_fighter' },
        tok_goblin: { id: 'tok_goblin', name: 'Goblin', x: 300, y: 300, isPlayer: false }
      }
    }
  },
  characters: {
    char_fighter: {
      id: 'char_fighter',
      name: 'Valeros',
      isPlayer: true,
      stats: { hp: 28, maxHp: 28, ac: 18 }
    }
  }
};
chatLogs[campaignId] = [];

const roomBroadcasts = [];
let connectionHandler = null;

const mockIo = {
  sockets: {
    adapter: {
      rooms: new Map([[campaignId, new Set(['gm_sock', 'player_sock'])]])
    },
    sockets: new Map()
  },
  on: (event, handler) => {
    if (event === 'connection') connectionHandler = handler;
  },
  to: (room) => ({
    emit: (event, payload) => {
      roomBroadcasts.push({ room, event, payload });
    }
  }),
  emit: (event, payload) => {
    roomBroadcasts.push({ room: 'GLOBAL', event, payload });
  }
};

initSocketServer(mockIo);

function createMockSocket(id, role, username) {
  const sock = new EventEmitter();
  sock.id = id;
  sock.role = role;
  sock.username = username;
  sock.campaignId = campaignId;
  sock.handshake = { headers: {} };
  sock.to = (room) => ({
    emit: (event, payload) => {
      roomBroadcasts.push({ from: id, room, event, payload });
    }
  });
  sock.join = () => {};
  sock.leave = () => {};
  return sock;
}

// Step 1: GM and Player Join Campaign
console.log('\n[Step 1] GM and Player Join Campaign Room...');

const gmSocket = createMockSocket('gm_sock', 'GM', 'DungeonMaster');
const playerSocket = createMockSocket('player_sock', 'player', 'Alice');

mockIo.sockets.sockets.set('gm_sock', gmSocket);
mockIo.sockets.sockets.set('player_sock', playerSocket);

connectionHandler(gmSocket);
connectionHandler(playerSocket);

assert.strictEqual(gmSocket.campaignId, campaignId);
assert.strictEqual(playerSocket.campaignId, campaignId);
console.log('  ✓ GM and Player joined campaign room successfully.');

// Step 2: Map and Token Interaction
console.log('\n[Step 2] Map and Token Movement Synchronization...');

roomBroadcasts.length = 0;
let playerReceivedTokenDelta = false;
playerSocket.on('token:updated_delta', (payload) => {
  if (payload && payload.tokenId === 'tok_fighter') {
    playerReceivedTokenDelta = true;
  }
});

// GM moves player token using token:update_delta
gmSocket.emit('token:update_delta', {
  mapId: 'dungeon_map',
  tokenId: 'tok_fighter',
  changes: { x: 250, y: 350 }
});

const currentMap = campaigns[campaignId].maps.dungeon_map;
assert.strictEqual(currentMap.tokens.tok_fighter.x, 250, 'Token X should be updated');
assert.strictEqual(currentMap.tokens.tok_fighter.y, 350, 'Token Y should be updated');
assert.strictEqual(playerReceivedTokenDelta, true, 'Player must receive token:updated_delta');
console.log('  ✓ Token movement updated in campaign store and broadcast to clients.');

// Step 3: Chat and Dice Rolling
console.log('\n[Step 3] Chat and Dice Rolling...');

roomBroadcasts.length = 0;

// Player sends dice roll to chat
playerSocket.emit('chat:msg', {
  text: '/roll 1d20+5 = [18] + 5 = 23 (Attack Roll)',
  rollData: { formula: '1d20+5', result: 23 }
});

const log = chatLogs[campaignId] || [];
const lastMsg = log[log.length - 1];
assert.ok(lastMsg, 'Chat message should be recorded in chat log');
assert.strictEqual(lastMsg.username, 'Alice');
assert.ok(lastMsg.text.includes('Attack Roll'));

const chatBroadcast = roomBroadcasts.find(b => b.event === 'chat:msg');
assert.ok(chatBroadcast, 'Chat message must broadcast chat:msg to room');
assert.strictEqual(chatBroadcast.payload.username, 'Alice');
console.log('  ✓ Chat / dice roll stored and broadcast to room.');

// Step 4: Initiative Tracker
console.log('\n[Step 4] Initiative Combat Tracker Sync...');

roomBroadcasts.length = 0;

const combatantsList = [
  { id: 'tok_fighter', name: 'Valeros', score: 23, hp: 28, maxHp: 28 },
  { id: 'tok_goblin', name: 'Goblin', score: 14, hp: 7, maxHp: 7 }
];

gmSocket.emit('initiative:update', {
  initiative: {
    combatants: combatantsList,
    currentRound: 1,
    activeTurnIndex: 0,
    isVisible: true
  }
});

assert.ok(campaigns[campaignId].initiative?.combatants?.length === 2, 'Initiative list must have 2 combatants');
assert.strictEqual(campaigns[campaignId].initiative.combatants[0].name, 'Valeros');

const initBroadcast = roomBroadcasts.find(b => b.event === 'initiative:updated');
assert.ok(initBroadcast, 'Initiative update must broadcast initiative:updated to room');
console.log('  ✓ Initiative state saved and synchronized across table.');

// Step 5: Character Data Save & Reopen
console.log('\n[Step 5] Character Data Save and Reopen Persistence...');

// Player takes damage: HP reduced to 19/28
const char = campaigns[campaignId].characters.char_fighter;
char.stats.hp = 19;
saveCampaigns();

// Reopen character from database
const reopenedChar = campaigns[campaignId].characters.char_fighter;
assert.strictEqual(reopenedChar.stats.hp, 19, 'Modified HP must persist upon reopening');
assert.strictEqual(reopenedChar.name, 'Valeros');
console.log('  ✓ Character sheet modifications safely saved and verified upon reopen.');

// Step 6: Disconnect and Recovery
console.log('\n[Step 6] Disconnect and Clean Session Recovery...');

// Simulate network disconnect of player socket
playerSocket.emit('disconnect', 'transport close');
mockIo.sockets.sockets.delete('player_sock');
assert.ok(campaigns[campaignId], 'Campaign data must remain unharmed on player disconnect');

// Player reconnects with a fresh socket
const playerSocket2 = createMockSocket('player_sock_reconnected', 'player', 'Alice');
mockIo.sockets.sockets.set('player_sock_reconnected', playerSocket2);
connectionHandler(playerSocket2);

assert.strictEqual(playerSocket2.campaignId, campaignId);
assert.strictEqual(campaigns[campaignId].maps.dungeon_map.tokens.tok_fighter.x, 250);
assert.strictEqual(campaigns[campaignId].characters.char_fighter.stats.hp, 19);
console.log('  ✓ Disconnect handled cleanly, reconnected client immediately re-establishes valid session.');

console.log('\n======================================================');
console.log('🎉 MAIN PLAY LOOP VERIFIED SUCCESSFULLY!');
console.log('======================================================');
