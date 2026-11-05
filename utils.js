/**
 * Creates a default campaign template.
 * @param {string} id - The campaign ID.
 * @param {string} name - The campaign name.
 * @returns {object} The default campaign object.
 */
export function createCampaignTemplate(id, name) {
  const defaultMapId = `map_${id}_default_${Date.now()}`;
  return {
    id,
    name,
    activeMapId: defaultMapId,
    activeGMMapId: defaultMapId,
    maps: {
      [defaultMapId]: {
        id: defaultMapId,
        name: "Initial Map",
        mapImage: "",
        grid: { size: 50, offsetX: 0, offsetY: 0, scale: 1, feetPerSquare: 5 },
        tokens: {},
        walls: [],
        lights: [],
        shapes: {},
        drawings: {},
        traps: [],
        portals: []
      }
    },
    initiative: {
      combatants: [],
      currentRound: 1,
      activeTurnIndex: -1,
      isVisible: false
    },
    characters: {},
    settings: {
      monsterHpBarVisible: 'hover',
      monsterHpBarNumberVisible: false,
      playerHpBarVisible: 'always',
      playerHpBarNumberVisible: true,
      tempHpBarVisible: 'always',
      tempHpBarNumberVisible: true,
      tempHpBarStyle: 'stacked'
    },
    playerMapOverrides: {},
    description: "",
    allowedUsers: [],
    knownPlayers: [],
    isPaused: false,
    pauseState: { isPaused: false, source: null, by: null, at: null }
  };
}

import crypto from 'crypto';

export const PBKDF2_ITERATIONS = 600000;
export const PBKDF2_LEGACY_ITERATIONS = 1000;

/**
 * Hashes a password with a salt using PBKDF2-HMAC-SHA256 (600,000 iterations).
 * @param {string} password
 * @param {string} [salt]
 * @param {number} [iterations=PBKDF2_ITERATIONS]
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password, salt = null, iterations = PBKDF2_ITERATIONS) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, iterations, 64, 'sha256').toString('hex');
  return { hash, salt: generatedSalt };
}

/**
 * Verifies a password against a salt and hash.
 * Tests 600,000 iterations first (OWASP standard), falling back to 1,000 iterations
 * for backward compatibility with legacy password hashes.
 * @param {string} password
 * @param {string} salt
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  // 1. Try modern 600,000 iterations
  const computedModern = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha256').toString('hex');
  if (computedModern === hash) return true;

  // 2. Fall back to legacy 1,000 iterations for backward compatibility
  const computedLegacy = crypto.pbkdf2Sync(password, salt, PBKDF2_LEGACY_ITERATIONS, 64, 'sha256').toString('hex');
  return computedLegacy === hash;
}

/**
 * Updates a specific property on a campaign map.
 * @param {object} campaigns - The global campaigns state object.
 * @param {string} campaignId - The ID of the campaign.
 * @param {string} mapId - The ID of the map (can be undefined to use activeMapId).
 * @param {string} propertyKey - The key of the property to update (e.g., 'grid', 'walls').
 * @param {any} value - The new value for the property.
 * @returns {object|null} The resolved mapId if successful, null otherwise.
 */
export function updateMapProperty(campaigns, campaignId, mapId, propertyKey, value, fallbackMapId) {
  if (!campaigns[campaignId]) return null;
  const targetMapId = mapId || fallbackMapId || campaigns[campaignId].activeGMMapId || campaigns[campaignId].activeMapId;
  if (campaigns[campaignId].maps && campaigns[campaignId].maps[targetMapId]) {
    campaigns[campaignId].maps[targetMapId][propertyKey] = value;
    return targetMapId;
  }
  return null;
}

import path from 'path';

/**
 * Validates that a target path starts with the allowed assets directory.
 * @param {string} targetPath - The resolved target path.
 * @param {string} assetsDir - The base assets directory.
 * @returns {boolean} True if the path is valid, false otherwise.
 */
export function isValidAssetPath(targetPath, assetsDir) {
  if (!targetPath || !assetsDir) return false;
  const resolvedTarget = path.resolve(targetPath);
  const resolvedAssets = path.resolve(assetsDir);
  return resolvedTarget === resolvedAssets || resolvedTarget.startsWith(resolvedAssets + path.sep);
}

