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
    pauseState: { isPaused: false, source: null, by: null, at: null },
    rollTables: { tables: [], assetTables: [], decks: [] }
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
function timingSafeHexEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  // 1. Try modern 600,000 iterations
  const computedModern = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha256').toString('hex');
  if (timingSafeHexEquals(computedModern, hash)) return true;

  // 2. Fall back to legacy 1,000 iterations for backward compatibility
  const computedLegacy = crypto.pbkdf2Sync(password, salt, PBKDF2_LEGACY_ITERATIONS, 64, 'sha256').toString('hex');
  return timingSafeHexEquals(computedLegacy, hash);
}

function pbkdf2Async(password, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 64, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

/**
 * Non-blocking async password verification (prevents event-loop stalls on PBKDF2).
 * @param {string} password
 * @param {string} salt
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPasswordAsync(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const computedModern = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS);
  if (timingSafeHexEquals(computedModern, hash)) return true;
  const computedLegacy = await pbkdf2Async(password, salt, PBKDF2_LEGACY_ITERATIONS);
  return timingSafeHexEquals(computedLegacy, hash);
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
import fs from 'fs';
import { execFileSync } from 'child_process';

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

export const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips reserved prototype-pollution keys from imported JSON objects.
 * @param {any} value
 * @returns {any}
 */
export function sanitizeImportedObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeImportedObject(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (RESERVED_OBJECT_KEYS.has(k)) continue;
    clean[k] = sanitizeImportedObject(v);
  }
  return clean;
}

/**
 * Atomically writes data to filePath via a temp file + rename.
 * Preserves a .bak copy when overwriting campaigns.json.
 * @param {string} filePath
 * @param {string|Buffer} data
 */
export function atomicWriteFileSync(filePath, data) {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
  fs.writeFileSync(tempPath, data, 'utf8');
  if (filePath.endsWith('campaigns.json') && fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    } catch {}
  }
  fs.renameSync(tempPath, filePath);
}

/**
 * Lists and validates archive entries with `tar -tf` before extraction to prevent Zip Slip / path traversal.
 * @param {string} archivePath
 * @param {string} [tarBin]
 * @returns {string[]} Validated relative entry names
 */
export function validateZipArchiveEntries(archivePath, tarBin = process.platform === 'win32' ? 'tar.exe' : 'tar') {
  const rawVerbose = execFileSync(tarBin, ['-tvf', archivePath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  for (const vLine of rawVerbose.split(/\r?\n/)) {
    const trimmed = vLine.trim();
    if (!trimmed) continue;
    if (/^[lh]/.test(trimmed) || trimmed.includes(' -> ')) {
      throw new Error(`Archive contains unsafe link entry: ${trimmed}`);
    }
  }
  const raw = execFileSync(tarBin, ['-tf', archivePath], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error('Archive is empty.');
  }
  for (const entry of entries) {
    if (entry.includes('\0')) {
      throw new Error('Archive contains invalid null-byte path.');
    }
    const normalized = entry.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
      throw new Error(`Archive contains absolute path entry: ${entry}`);
    }
    const parts = normalized.split('/');
    if (parts.some((p) => p === '..')) {
      throw new Error(`Archive contains path traversal entry: ${entry}`);
    }
  }
  return entries;
}

