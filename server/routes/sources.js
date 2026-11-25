import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rootDir, DATA_DIR, verifyGmOrSecret, loadSourcesConfig, getActiveIo, isValidAssetPath } from '../state.js';
import { SourceManager } from '../../electron/source-manager.js';

export const sourcesRouter = express.Router();

let compendiumInvalidator = null;
export function registerSourcesCompendiumInvalidator(fn) {
    compendiumInvalidator = fn;
}

const serverSourceManager = new SourceManager({
    rootDir,
    campaignDataDir: DATA_DIR
});

function getSourceManager() {
    if (path.resolve(serverSourceManager.campaignDataDir) !== path.resolve(DATA_DIR)) {
        serverSourceManager.setCampaignDataDir(DATA_DIR);
    } else {
        serverSourceManager.loadConfig();
    }
    return serverSourceManager;
}

function broadcastSourcesSync() {
    loadSourcesConfig(true);
    if (typeof compendiumInvalidator === 'function') {
        compendiumInvalidator();
    }
    const io = getActiveIo();
    if (io) {
        io.emit('sources:updated', { timestamp: Date.now() });
    }
}

sourcesRouter.get('/sources', verifyGmOrSecret, (req, res) => {
    try {
        const campaignId = req.query.campaignId ? String(req.query.campaignId) : null;
        res.json(getSourceManager().getAllSources(campaignId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/toggle', verifyGmOrSecret, (req, res) => {
    try {
        const { code, enabled, campaignId } = req.body || {};
        const result = getSourceManager().toggleSource(code, enabled, campaignId || null);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/batch-toggle', verifyGmOrSecret, (req, res) => {
    try {
        const { codes, enabled, campaignId } = req.body || {};
        const result = getSourceManager().batchToggle(codes, enabled, campaignId || null);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/toggle-partnered', verifyGmOrSecret, (req, res) => {
    try {
        const { enabled, campaignId } = req.body || {};
        const result = getSourceManager().togglePartnered(enabled, campaignId || null);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/toggle-ua', verifyGmOrSecret, (req, res) => {
    try {
        const { enabled, campaignId } = req.body || {};
        const result = getSourceManager().toggleUA(enabled, campaignId || null);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/ui-state', verifyGmOrSecret, (req, res) => {
    try {
        const result = getSourceManager().saveUiState(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/apply-preset', verifyGmOrSecret, (req, res) => {
    try {
        const { preset, campaignId } = req.body || {};
        const result = getSourceManager().applyPreset(preset, campaignId || null);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/reset-campaign', verifyGmOrSecret, (req, res) => {
    try {
        const { campaignId } = req.body || {};
        const result = getSourceManager().resetCampaignSources(campaignId);
        broadcastSourcesSync();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.get('/sources/details', verifyGmOrSecret, (req, res) => {
    try {
        const { category, code } = req.query;
        res.json(getSourceManager().getSourceDetails(String(category || ''), String(code || '')));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/details', verifyGmOrSecret, (req, res) => {
    try {
        const result = getSourceManager().saveSourceDetails(req.body || {});
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/custom', verifyGmOrSecret, (req, res) => {
    try {
        const result = getSourceManager().createCustomSource(req.body || {});
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.delete('/sources/custom', verifyGmOrSecret, (req, res) => {
    try {
        const category = String(req.query.category || req.body?.category || '');
        const code = String(req.query.code || req.body?.code || '');
        const result = getSourceManager().deleteCustomSource(category, code);
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.post('/sources/add-file', verifyGmOrSecret, (req, res) => {
    const { category, fileName, content } = req.body || {};
    if (!category || !fileName || content === undefined) {
        return res.status(400).json({ success: false, error: 'category, fileName, and content are required' });
    }
    const safeName = path.basename(String(fileName)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'import.json';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-src-'));
    const tmpFile = path.join(tmpDir, safeName);
    try {
        const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        fs.writeFileSync(tmpFile, text, 'utf8');
        const result = getSourceManager().addDatabaseFile({ category, filePath: tmpFile });
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
});

sourcesRouter.get('/sources/search', verifyGmOrSecret, (req, res) => {
    try {
        const category = String(req.query.category || '');
        const query = String(req.query.query || '');
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
        res.json(getSourceManager().searchCompendium({ category, query, limit }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.get('/sources/search-global', verifyGmOrSecret, (req, res) => {
    try {
        const query = String(req.query.query || '');
        const category = req.query.category ? String(req.query.category) : undefined;
        const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
        res.json(getSourceManager().searchAllCompendium(query, { category, limit }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.get('/sources/entity', verifyGmOrSecret, (req, res) => {
    try {
        const category = String(req.query.category || '');
        const name = String(req.query.name || '');
        const source = String(req.query.source || '');
        res.json(getSourceManager().getEntityFullData({ category, name, source }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.get('/sources/preview', verifyGmOrSecret, (req, res) => {
    try {
        const category = String(req.query.category || '');
        const name = String(req.query.name || '');
        const source = String(req.query.source || '');
        res.json(getSourceManager().getFormattedStatblock(category, name, source));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

sourcesRouter.get('/sources/export', verifyGmOrSecret, (req, res) => {
    const category = String(req.query.category || '');
    const code = String(req.query.code || '');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-exp-'));
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_') || 'source';
    const tmpFile = path.join(tmpDir, `${safeCode}.json`);
    try {
        const result = getSourceManager().exportSource(category, code, tmpFile);
        if (!result || !result.success || !fs.existsSync(tmpFile)) {
            return res.status(404).json({ success: false, error: result?.error || 'Source export failed' });
        }
        const jsonText = fs.readFileSync(tmpFile, 'utf8');
        res.json({ success: true, fileName: `${safeCode}.json`, content: jsonText });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
});

const BULK_STAGE_TTL_MS = 30 * 60 * 1000;
const stagedBulkBatches = new Map();

function pruneExpiredBulkStages() {
    const now = Date.now();
    for (const [token, entry] of stagedBulkBatches.entries()) {
        if (!entry || now - entry.createdAt >= BULK_STAGE_TTL_MS) {
            stagedBulkBatches.delete(token);
            if (entry?.dir) {
                try {
                    fs.rmSync(entry.dir, { recursive: true, force: true });
                } catch (_) {}
            }
        }
    }
}

sourcesRouter.post('/sources/inspect-bulk', verifyGmOrSecret, (req, res) => {
    const { files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ success: false, error: 'files array is required' });
    }
    pruneExpiredBulkStages();

    const stageToken = crypto.randomBytes(16).toString('hex');
    const stageRoot = path.join(DATA_DIR, 'scratch', 'bulk-stage');
    const stageDir = path.join(stageRoot, stageToken);
    fs.mkdirSync(stageDir, { recursive: true });

    try {
        const tmpPaths = [];
        for (const f of files) {
            if (!f || !f.name || f.content === undefined) continue;
            const safeName = path.basename(String(f.name)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'source.json';
            const dest = path.resolve(stageDir, safeName);
            if (!isValidAssetPath(dest, stageDir)) continue;
            fs.writeFileSync(dest, typeof f.content === 'string' ? f.content : JSON.stringify(f.content), 'utf8');
            tmpPaths.push(dest);
        }

        const inspected = getSourceManager().inspectImportFiles(tmpPaths);
        if (!inspected?.success || !Array.isArray(inspected.candidates) || inspected.candidates.length === 0) {
            try {
                fs.rmSync(stageDir, { recursive: true, force: true });
            } catch (_) {}
            return res.json(inspected);
        }

        stagedBulkBatches.set(stageToken, { dir: stageDir, createdAt: Date.now() });
        const safeCandidates = inspected.candidates.map((cand) => ({
            ...cand,
            filePath: '',
            originalPath: cand.fileName,
            stageToken,
            stageFileName: cand.fileName
        }));
        return res.json({
            ...inspected,
            candidates: safeCandidates,
            files: safeCandidates
        });
    } catch (err) {
        try {
            fs.rmSync(stageDir, { recursive: true, force: true });
        } catch (_) {}
        return res.status(500).json({ success: false, error: err.message });
    }
});

sourcesRouter.post('/sources/execute-bulk', verifyGmOrSecret, (req, res) => {
    const consumedTokens = new Set();
    try {
        pruneExpiredBulkStages();
        const { candidates, conflictDecisions } = req.body || {};
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ success: false, error: 'candidates array is required' });
        }

        const resolvedCandidates = [];
        for (const cand of candidates) {
            if (cand?.selected === false) continue;
            const token = String(cand?.stageToken || '');
            const stage = token ? stagedBulkBatches.get(token) : null;
            const baseName = path.basename(String(cand?.stageFileName || cand?.fileName || ''));
            const stagedPath = stage && baseName ? path.resolve(stage.dir, baseName) : '';
            if (!stage || !stagedPath || !isValidAssetPath(stagedPath, stage.dir) || !fs.existsSync(stagedPath)) {
                return res.status(400).json({
                    success: false,
                    error: 'Staged upload expired or invalid. Please re-select the files.'
                });
            }
            consumedTokens.add(token);
            resolvedCandidates.push({
                ...cand,
                filePath: stagedPath,
                originalPath: baseName
            });
        }

        const result = getSourceManager().bulkImportSources(resolvedCandidates, conflictDecisions);
        if (result && result.success) {
            broadcastSourcesSync();
        }
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    } finally {
        for (const token of consumedTokens) {
            const stage = stagedBulkBatches.get(token);
            stagedBulkBatches.delete(token);
            if (stage?.dir) {
                try {
                    fs.rmSync(stage.dir, { recursive: true, force: true });
                } catch (_) {}
            }
        }
    }
});

sourcesRouter.post('/sources/import-url', verifyGmOrSecret, async (req, res) => {
    try {
        const { url, ...metadata } = req.body || {};
        const result = await getSourceManager().importFromUrl(url, metadata);
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
