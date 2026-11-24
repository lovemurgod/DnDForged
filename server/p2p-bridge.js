/**
 * ForgeDVTT - P2P Server Bridge & Session Coordinator
 * Manages Room Code generation, STUN health checks, and bridging WebRTC peers
 * into the authoritative ForgeDVTT campaign state synchronization engine.
 */

import crypto from 'crypto';
import EventEmitter from 'events';

const WORD_LIST = [
    'DRAGON', 'TAVERN', 'GOBLIN', 'WIZARD', 'DUNGEON',
    'KNIGHT', 'SHADOW', 'ROD', 'SWORD', 'SHIELD',
    'PORTAL', 'POTION', 'SPELL', 'BEAST', 'TEMPLE'
];

export const DEFAULT_STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun.cloudflare.com:3478'
];

class P2PBridge extends EventEmitter {
    constructor() {
        super();
        this.active = false;
        this.roomCode = null;
        this.createdAt = null;
        this.peers = new Map(); // peerId -> { id, username, role, connectedAt, lastSeen }
        this.stunServers = [...DEFAULT_STUN_SERVERS];
    }

    /**
     * Generate a high-entropy Crockford Base32 room code like "K7M4-P9Q2"
     */
    generateRoomCode() {
        const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        const bytes = crypto.randomBytes(8);
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += ALPHABET[bytes[i] % ALPHABET.length];
            if (i === 3) code += '-';
        }
        return code;
    }

    /**
     * Start a new P2P room session
     */
    startRoom(options = {}) {
        this.roomCode = options.roomCode || this.generateRoomCode();
        this.active = true;
        this.createdAt = Date.now();
        this.peers.clear();
        this.emit('room:started', this.getStatus());
        return this.getStatus();
    }

    /**
     * Stop active P2P room session
     */
    stopRoom() {
        this.active = false;
        const previousCode = this.roomCode;
        this.roomCode = null;
        this.peers.clear();
        this.emit('room:stopped', { previousCode });
        return { success: true };
    }

    /**
     * Register a peer connection into the active room
     */
    registerPeer(peerId, metadata = {}) {
        if (!this.active) return null;

        const peerInfo = {
            id: peerId,
            username: metadata.username || 'Anonymous Player',
            role: metadata.role || 'Player',
            connectedAt: Date.now(),
            lastSeen: Date.now()
        };

        this.peers.set(peerId, peerInfo);
        this.emit('peer:connected', peerInfo);
        return peerInfo;
    }

    /**
     * Unregister a disconnected peer
     */
    unregisterPeer(peerId) {
        if (this.peers.has(peerId)) {
            const peer = this.peers.get(peerId);
            this.peers.delete(peerId);
            this.emit('peer:disconnected', peer);
            return peer;
        }
        return null;
    }

    /**
     * Returns the live status payload of the P2P bridge
     */
    getStatus() {
        return {
            active: this.active,
            roomCode: this.roomCode,
            createdAt: this.createdAt,
            peerCount: this.peers.size,
            peers: Array.from(this.peers.values()),
            stunServers: this.stunServers
        };
    }

    /**
     * Creates a synthetic Socket.IO-compatible socket for a P2P peer.
     * Allows server/socket.js to handle P2P clients identically to WebSocket clients.
     */
    createSyntheticSocket(peerId, username, role) {
        const socket = new EventEmitter();
        socket.id = `p2p_${peerId}`;
        socket.isP2P = true;
        socket.username = username;
        socket.role = role || 'Player';
        socket.handshake = {
            headers: { host: 'localhost:5050' },
            address: '127.0.0.1' // Treated as verified local channel
        };

        socket.disconnect = (closeConnection = true) => {
            this.unregisterPeer(peerId);
            socket.emit('disconnect', 'p2p closed');
        };

        return socket;
    }
}

export const p2pBridge = new P2PBridge();
