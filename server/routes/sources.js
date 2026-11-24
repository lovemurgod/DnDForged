import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    rootDir,
    DATA_DIR,
    verifyGmOrSecret,
    loadSourcesConfig,
    getActiveIo
} from '../state.js';
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

sourcesRouter.post('/sources/inspect-bulk', verifyGmOrSecret, (req, res) => {
    const { files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ success: false, error: 'files array is required' });
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgedvtt-bulk-'));
    try {
        const tmpPaths = [];
        for (const f of files) {
            if (!f || !f.name || f.content === undefined) continue;
            const safeName = path.basename(String(f.name)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'source.json';
            const dest = path.join(tmpDir, safeName);
            fs.writeFileSync(dest, typeof f.content === 'string' ? f.content : JSON.stringify(f.content), 'utf8');
            tmpPaths.push(dest);
        }
        res.json(getSourceManager().inspectImportFiles(tmpPaths));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
});

sourcesRouter.post('/sources/execute-bulk', verifyGmOrSecret, (req, res) => {
    try {
        const { candidates, conflictDecisions } = req.body || {};
        const result = getSourceManager().bulkImportSources(candidates, conflictDecisions);
        if (result && result.success) {
            broadcastSourcesSync();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
