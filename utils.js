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
        shapes: {}
      }
    },
    initiative: [],
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
    knownPlayers: []
  };
}

import crypto from 'crypto';

/**
 * Hashes a password with a salt.
 * @param {string} password
 * @param {string} [salt]
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha256').toString('hex');
  return { hash, salt: generatedSalt };
}

/**
 * Verifies a password against a salt and hash.
 * @param {string} password
 * @param {string} salt
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return computed === hash;
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

/**
 * Validates that a target path starts with the allowed assets directory.
 * @param {string} targetPath - The resolved target path.
 * @param {string} assetsDir - The base assets directory.
 * @returns {boolean} True if the path is valid, false otherwise.
 */
export function isValidAssetPath(targetPath, assetsDir) {
  return targetPath.startsWith(assetsDir);
}

