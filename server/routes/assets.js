import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { ASSETS_DIR, isAuthorizedGmOrSecret, isValidAssetPath, verifyGmOrSecret } from '../state.js';
import { processMediaUrl } from './media.js';

export const assetsRouter = express.Router();

// Custom storage for assets to support subfolders, nested hierarchies, and batch uploads
const assetStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isGm = isAuthorizedGmOrSecret(req);
        let targetPath = ASSETS_DIR;
        if (!isGm) {
            targetPath = path.join(ASSETS_DIR, 'players');
        } else {
            const folderPath = req.query.folderPath || (req.body && req.body.folderPath);
            const relPath = req.query.relativePath || (req.body && req.body.relativePath);

            if (folderPath) {
                targetPath = path.join(ASSETS_DIR, folderPath);
            }
            if (relPath) {
                const relDir = path.dirname(relPath);
                if (relDir && relDir !== '.') {
                    targetPath = path.join(targetPath, relDir);
                }
            }
        }

        if (!isValidAssetPath(targetPath, ASSETS_DIR)) {
            return cb(new Error('Invalid destination path'));
        }

        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        cb(null, targetPath);
    },
    filename: (req, file, cb) => {
        const isGm = isAuthorizedGmOrSecret(req);
        let originalName = file.originalname;
        if (isGm && (req.query.relativePath || (req.body && req.body.relativePath))) {
            originalName = path.basename(req.query.relativePath || req.body.relativePath);
        }
        const safeName = originalName.replace(/[\/\\?%*:|"<>]/g, '_');
        cb(null, safeName);
    }
});
const assetUpload = multer({ storage: assetStorage, limits: { fileSize: 250 * 1024 * 1024 } });

// Recursively get directory structure for assets
function getAssetTree(dirPath, relativePath = '') {
    const result = {
        name: path.basename(dirPath) === 'assets' && relativePath === '' ? 'Root' : path.basename(dirPath),
        path: relativePath,
        type: 'folder',
        children: []
    };
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
        if (item.name === '_urls.json') continue; // Skip metadata

        if (item.isDirectory()) {
            result.children.push(
                getAssetTree(path.join(dirPath, item.name), path.join(relativePath, item.name).replace(/\\/g, '/'))
            );
        } else {
            result.children.push({
                name: item.name,
                path: path.join(relativePath, item.name).replace(/\\/g, '/'),
                type: 'file',
                url: `/assets/${path.join(relativePath, item.name).replace(/\\/g, '/')}`
            });
        }
    }

    // Load URLs
    const urlsFile = path.join(dirPath, '_urls.json');
    if (fs.existsSync(urlsFile)) {
        try {
            const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
            for (const u of urls) {
                result.children.push(u);
            }
        } catch (e) {}
    }
    return result;
}

let cachedAssetTree = null;
let assetTreeDirty = true;

export function invalidateAssetTree() {
    assetTreeDirty = true;
    cachedAssetTree = null;
}

// Get asset gallery tree
assetsRouter.get('/assets', (req, res) => {
    try {
        if (!assetTreeDirty && cachedAssetTree) {
            return res.json(cachedAssetTree);
        }
        cachedAssetTree = getAssetTree(ASSETS_DIR);
        assetTreeDirty = false;
        res.json(cachedAssetTree);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new folder in assets
assetsRouter.post('/assets/folder', verifyGmOrSecret, (req, res) => {
    const { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
    const targetPath = path.join(ASSETS_DIR, folderPath);
    if (!isValidAssetPath(targetPath, ASSETS_DIR)) return res.status(403).json({ error: 'Invalid path' });
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    invalidateAssetTree();
    res.json({ success: true, path: folderPath });
});

// Upload batch assets (GMs upload to chosen folder; non-GMs/players are safely sandboxed into /players)
assetsRouter.post('/assets/upload', assetUpload.any(), (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return res.status(400).json({ error: 'No file provided' });

    invalidateAssetTree();

    const results = files.map((file) => {
        const relPath = path.relative(ASSETS_DIR, file.path).replace(/\\/g, '/');
        return {
            url: `/assets/${relPath}`,
            name: file.filename,
            originalName: file.originalname,
            size: file.size,
            path: relPath
        };
    });

    res.json({
        success: true,
        count: results.length,
        files: results,
        url: results[0].url,
        name: results[0].name
    });
});

// Add external URL asset
assetsRouter.post('/assets/url', verifyGmOrSecret, async (req, res) => {
    const { url, name, folderPath } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const finalUrl = await processMediaUrl(url);

    const targetDir = folderPath ? path.join(ASSETS_DIR, folderPath) : ASSETS_DIR;
    if (!isValidAssetPath(targetDir, ASSETS_DIR)) return res.status(403).json({ error: 'Invalid path' });
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const urlsFile = path.join(targetDir, '_urls.json');
    let urls = [];
    if (fs.existsSync(urlsFile)) {
        urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    }

    const newAsset = {
        name: name || 'External URL',
        url: finalUrl,
        type: 'url',
        path: folderPath ? `${folderPath}/${name || 'External URL'}` : name || 'External URL'
    };
    urls.push(newAsset);
    fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));

    invalidateAssetTree();
    res.json(newAsset);
});

// Delete assets
assetsRouter.post('/assets/delete', verifyGmOrSecret, (req, res) => {
    const { path: relPath, isUrl, folderPath, name, items } = req.body;
    const toDelete = Array.isArray(items) ? items : [{ path: relPath, isUrl, folderPath, name }];

    try {
        for (const item of toDelete) {
            if (item.isUrl) {
                const targetDir = item.folderPath ? path.join(ASSETS_DIR, item.folderPath) : ASSETS_DIR;
                if (!isValidAssetPath(targetDir, ASSETS_DIR)) continue;
                const urlsFile = path.join(targetDir, '_urls.json');
                if (fs.existsSync(urlsFile)) {
                    let urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                    urls = urls.filter((u) => u.name !== item.name && u.url !== item.url);
                    fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
                }
            } else if (item.path) {
                const targetPath = path.join(ASSETS_DIR, item.path);
                if (!isValidAssetPath(targetPath, ASSETS_DIR)) continue;
                if (fs.existsSync(targetPath)) {
                    if (fs.statSync(targetPath).isDirectory()) {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(targetPath);
                    }
                }
            }
        }
        invalidateAssetTree();
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Rename / edit asset
assetsRouter.post('/assets/edit', verifyGmOrSecret, (req, res) => {
    const { path: oldRelPath, newName, isUrl, folderPath, oldName, newUrl } = req.body;
    if (!newName) return res.status(400).json({ error: 'New name required' });

    try {
        if (isUrl) {
            const targetDir = folderPath ? path.join(ASSETS_DIR, folderPath) : ASSETS_DIR;
            if (!isValidAssetPath(targetDir, ASSETS_DIR)) return res.status(403).json({ error: 'Invalid path' });
            const urlsFile = path.join(targetDir, '_urls.json');
            if (fs.existsSync(urlsFile)) {
                let urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                const idx = urls.findIndex((u) => u.name === oldName);
                if (idx !== -1) {
                    urls[idx].name = newName;
                    if (newUrl) urls[idx].url = newUrl;
                    urls[idx].path = folderPath ? `${folderPath}/${newName}` : newName;
                    fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
                }
            }
            invalidateAssetTree();
            return res.json({ success: true });
        } else {
            const oldPath = path.join(ASSETS_DIR, oldRelPath);
            const parentDir = path.dirname(oldPath);
            const newPath = path.join(parentDir, newName);

            if (!isValidAssetPath(oldPath, ASSETS_DIR) || !isValidAssetPath(newPath, ASSETS_DIR))
                return res.status(403).json({ error: 'Invalid path' });
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
            }
            invalidateAssetTree();
            return res.json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Move assets
assetsRouter.post('/assets/move', verifyGmOrSecret, (req, res) => {
    const { items, targetFolder } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array required' });
    }

    const destDir = targetFolder && targetFolder !== 'Root' ? path.join(ASSETS_DIR, targetFolder) : ASSETS_DIR;
    if (!isValidAssetPath(destDir, ASSETS_DIR)) return res.status(403).json({ error: 'Invalid target folder' });
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    try {
        for (const item of items) {
            if (item.isUrl) {
                // Remove from source folder's _urls.json
                const srcDir = item.folderPath ? path.join(ASSETS_DIR, item.folderPath) : ASSETS_DIR;
                if (isValidAssetPath(srcDir, ASSETS_DIR)) {
                    const srcUrlsFile = path.join(srcDir, '_urls.json');
                    if (fs.existsSync(srcUrlsFile)) {
                        let urls = JSON.parse(fs.readFileSync(srcUrlsFile, 'utf8'));
                        urls = urls.filter((u) => u.name !== item.name && u.url !== item.url);
                        fs.writeFileSync(srcUrlsFile, JSON.stringify(urls, null, 2));
                    }
                }
                // Add to destDir _urls.json
                const destUrlsFile = path.join(destDir, '_urls.json');
                let destUrls = [];
                if (fs.existsSync(destUrlsFile)) {
                    destUrls = JSON.parse(fs.readFileSync(destUrlsFile, 'utf8'));
                }
                destUrls.push({
                    name: item.name,
                    url: item.url,
                    type: 'url',
                    path: targetFolder && targetFolder !== 'Root' ? `${targetFolder}/${item.name}` : item.name
                });
                fs.writeFileSync(destUrlsFile, JSON.stringify(destUrls, null, 2));
            } else if (item.path) {
                const oldPath = path.join(ASSETS_DIR, item.path);
                if (!isValidAssetPath(oldPath, ASSETS_DIR) || !fs.existsSync(oldPath)) continue;

                const baseName = path.basename(oldPath);
                let newPath = path.join(destDir, baseName);
                if (oldPath === newPath) continue;
                if (path.resolve(destDir).startsWith(path.resolve(oldPath) + path.sep)) continue; // Can't move folder into itself

                // Auto-rename if destination already contains a file with this name
                if (fs.existsSync(newPath) && !fs.statSync(oldPath).isDirectory()) {
                    const parsed = path.parse(baseName);
                    let candidate = baseName;
                    let counter = 1;
                    while (fs.existsSync(path.join(destDir, candidate))) {
                        candidate = `${parsed.name} (${counter})${parsed.ext}`;
                        counter++;
                    }
                    newPath = path.join(destDir, candidate);
                }

                fs.renameSync(oldPath, newPath);
            }
        }
        invalidateAssetTree();
        res.json({ success: true });
    } catch (err) {
        console.error('Asset move error:', err);
        res.status(500).json({ error: err.message });
    }
});
