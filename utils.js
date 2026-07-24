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
    allowedUsers: [],
    knownPlayers: []
  };
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
export function updateMapProperty(campaigns, campaignId, mapId, propertyKey, value) {
  if (!campaigns[campaignId]) return null;
  const targetMapId = mapId || campaigns[campaignId].activeMapId;
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
