/**
 * test/helpers/mock-socket.mjs
 * Mock Socket.IO client and server emitter for ForgeDVTT network synchronization tests.
 * Records all event transmissions and provides bidirectional simulation helpers.
 */

import { EventEmitter } from 'events';

export class MockSocket extends EventEmitter {
    constructor(options = {}) {
        super();
        this.id = options.id || `socket_${Math.random().toString(36).substring(2, 9)}`;
        this.rooms = new Set(['global', this.id]);
        this.emitted = [];
        this.connected = true;
    }

    /**
     * Intercept emit calls to record history and execute acks.
     * @param {string} event
     * @param  {...any} args
     * @returns {boolean}
     */
    emit(event, ...args) {
        let ack = null;
        let payload = args;

        if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            ack = args.pop();
            payload = args;
        }

        const record = {
            event,
            args: payload,
            data: payload.length === 1 ? payload[0] : payload,
            timestamp: Date.now(),
            targetRoom: null,
            isBroadcast: false
        };

        this.emitted.push(record);

        // If an acknowledgment callback was supplied, invoke it asynchronously
        if (ack) {
            setTimeout(() => ack({ success: true }), 0);
        }

        // Trigger local handlers if registered (loopback behavior)
        super.emit(event, ...payload);
        return true;
    }

    /**
     * Target a specific room for emission.
     * @param {string} room
     * @returns {object}
     */
    to(room) {
        return {
            emit: (event, ...args) => {
                this.emitted.push({
                    event,
                    args,
                    data: args.length === 1 ? args[0] : args,
                    timestamp: Date.now(),
                    targetRoom: room,
                    isBroadcast: true
                });
                return true;
            }
        };
    }

    in(room) {
        return this.to(room);
    }

    /**
     * Broadcast operator simulation.
     */
    get broadcast() {
        return {
            emit: (event, ...args) => {
                this.emitted.push({
                    event,
                    args,
                    data: args.length === 1 ? args[0] : args,
                    timestamp: Date.now(),
                    targetRoom: null,
                    isBroadcast: true
                });
                return true;
            },
            to: (room) => this.to(room)
        };
    }

    /**
     * Join a simulated room.
     * @param {string} room
     */
    join(room) {
        this.rooms.add(room);
    }

    /**
     * Leave a simulated room.
     * @param {string} room
     */
    leave(room) {
        this.rooms.delete(room);
    }

    /**
     * Simulate an incoming broadcast from server/network.
     * @param {string} event
     * @param  {...any} args
     */
    simulateServerBroadcast(event, ...args) {
        super.emit(event, ...args);
    }

    /**
     * Retrieve all emitted events matching the given name.
     * @param {string} eventName
     * @returns {Array<object>}
     */
    getEmitted(eventName) {
        return this.emitted.filter((e) => e.event === eventName);
    }

    /**
     * Retrieve the most recent emitted event matching the given name.
     * @param {string} eventName
     * @returns {object|null}
     */
    getLastEmitted(eventName) {
        const matches = this.getEmitted(eventName);
        return matches.length > 0 ? matches[matches.length - 1] : null;
    }

    /**
     * Clear all recorded emission history.
     */
    clearEmitted() {
        this.emitted.length = 0;
    }
}

/**
 * Factory helper for a MockSocket instance.
 * @param {object} options
 * @returns {MockSocket}
 */
export function createMockSocket(options = {}) {
    return new MockSocket(options);
}
