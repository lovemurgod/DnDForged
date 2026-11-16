/**
 * test/helpers/factories.mjs
 * Canonical test object factories for ForgeDVTT domain models.
 * Guarantees schema consistency and eliminates boilerplate mock declarations across tests.
 */

let idCounter = 1;

/**
 * Generate a unique sequential identifier for test fixtures.
 * @param {string} prefix
 * @returns {string}
 */
export function generateTestId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${idCounter++}`;
}

/**
 * Create a mock tabletop token adhering to ForgeDVTT token schema.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockToken(overrides = {}) {
    const id = overrides.id || generateTestId('tok');
    return {
        id,
        name: 'Mock Token',
        img: 'icons/token.png',
        x: 100,
        y: 100,
        size: 1,
        gridSize: 50,
        hp: 15,
        maxHp: 15,
        tempHp: 0,
        ac: 12,
        baseAc: 12,
        acMod: 0,
        acToggles: [],
        speed: 30,
        rotation: 0,
        flipX: false,
        flipY: false,
        layer: 'token',
        zIndex: 1,
        conditions: [],
        isPlayer: false,
        characterId: null,
        elevation: 0,
        invisible: false,
        hidden: false,
        locked: false,
        light: {
            brightRadius: 0,
            dimRadius: 0,
            color: '#ffffff',
            opacity: 0.5,
            enabled: false
        },
        auras: [],
        ...overrides
    };
}

/**
 * Create a mock 5e character sheet adhering to ForgeDVTT character schema.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockCharacter(overrides = {}) {
    const id = overrides.id || generateTestId('char');
    return {
        id,
        characterName: 'Mock Character',
        owner: 'Player1',
        level: 1,
        race: 'Human',
        classes: [{ name: 'Fighter', level: 1, subclassName: '' }],
        stats: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        hp: {
            current: 10,
            max: 10,
            temp: 0
        },
        ac: 10,
        baseAc: 10,
        acMod: 0,
        acToggles: [],
        speed: 30,
        proficiencyBonus: 2,
        proficiencies: {
            armor: [],
            weapons: [],
            tools: [],
            languages: ['Common'],
            skills: [],
            expertises: []
        },
        savingThrows: [],
        spellcasting: {
            ability: 'int',
            saveDc: 10,
            attackBonus: 2,
            slots: {},
            spells: []
        },
        features: [],
        inventory: [],
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
        notes: '',
        ...overrides
    };
}

/**
 * Create a mock map container adhering to ForgeDVTT map schema.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockMap(overrides = {}) {
    const id = overrides.id || generateTestId('map');
    return {
        id,
        name: 'Mock Map',
        gridSize: 50,
        gridType: 'square',
        gridColor: '#000000',
        gridOpacity: 0.5,
        width: 2000,
        height: 2000,
        image: 'maps/dungeon.png',
        thumbnail: 'maps/dungeon_thumb.png',
        tokens: {},
        walls: [],
        portals: [],
        traps: [],
        drawings: [],
        lighting: {
            enabled: false,
            ambientLight: 1.0,
            darknessLevel: 0,
            fogExplored: null
        },
        weather: {
            type: 'none',
            intensity: 0
        },
        ...overrides
    };
}

/**
 * Create a mock wall segment adhering to ForgeDVTT wall schema.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockWall(overrides = {}) {
    const id = overrides.id || generateTestId('wall');
    return {
        id,
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        door: 0, // 0 = standard wall, 1 = door, 2 = secret door
        doorState: 0, // 0 = closed, 1 = open, 2 = locked
        sense: 0, // 0 = blocks normal vision/light
        blocksMovement: true,
        blocksLight: true,
        ...overrides
    };
}

/**
 * Create a mock campaign container adhering to ForgeDVTT server state schema.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockCampaign(overrides = {}) {
    const id = overrides.id || generateTestId('camp');
    const defaultMap = createMockMap({ id: 'map_default', name: 'Starting Area' });
    return {
        id,
        name: 'Mock Campaign',
        gmUsername: 'GM',
        activeMapId: defaultMap.id,
        activeGMMapId: defaultMap.id,
        playerMapOverrides: {},
        initiative: {
            combatants: [],
            currentRound: 1,
            activeTurnIndex: -1,
            isVisible: false
        },
        maps: {
            [defaultMap.id]: defaultMap
        },
        characters: {},
        chatLog: [],
        folders: [],
        settings: {
            allowPlayerDiceRolling: true,
            gridSnapping: true
        },
        ...overrides
    };
}

/**
 * Create a mock VTT global context with default GM or player properties.
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createMockVtt(overrides = {}) {
    const defaultCampaign = createMockCampaign();
    return {
        role: 'GM',
        username: 'GM',
        isPaused: false,
        activeMapId: defaultCampaign.activeMapId,
        campaignState: defaultCampaign,
        socket: {
            emit: () => {},
            on: () => {},
            off: () => {}
        },
        ...overrides
    };
}
