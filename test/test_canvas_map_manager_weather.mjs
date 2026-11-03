import test from 'node:test';
import assert from 'node:assert/strict';

import {
    WEATHER_CATEGORIES,
    WEATHER_PRESET_OPTIONS,
    parseWeatherSettings
} from '../vtt/js/canvas/vtt-canvas-weather.js';

import {
    hasMapManagerDataChanged,
    escapeMapHtml,
    detectMapMediaType,
    buildMapThumbnailMarkup
} from '../vtt/js/canvas/vtt-canvas-map-manager.js';

test('Canvas Weather: Presets & Settings Normalization', async (t) => {
    await t.test('WEATHER_CATEGORIES includes all atmospheric, wilderness, hazard and planar options', () => {
        assert.ok(WEATHER_CATEGORIES.length >= 4, 'Should have at least 4 weather categories');
        const ids = WEATHER_PRESET_OPTIONS.map((o) => o.id);
        assert.ok(ids.includes('rain'), 'Contains rain preset');
        assert.ok(ids.includes('snow'), 'Contains snow preset');
        assert.ok(ids.includes('fog'), 'Contains fog preset');
        assert.ok(ids.includes('storm'), 'Contains storm preset');
        assert.ok(ids.includes('embers'), 'Contains embers preset');
        assert.ok(ids.includes('spores'), 'Contains spores preset');
    });

    await t.test('parseWeatherSettings normalizes legacy single preset format to layered effects array', () => {
        const legacy = {
            preset: 'rain',
            intensity: 0.8,
            speed: 1.5,
            direction: 45,
            zoom: 1.2,
            tint: '#8899aa',
            tintOpacity: 0.3,
            saturation: 85
        };
        const parsed = parseWeatherSettings(legacy);
        assert.equal(parsed.saturation, 85);
        assert.equal(parsed.effects.length, 1);
        assert.equal(parsed.effects[0].preset, 'rain');
        assert.equal(parsed.effects[0].intensity, 0.8);
        assert.equal(parsed.effects[0].speed, 1.5);
        assert.equal(parsed.effects[0].direction, 45);
        assert.equal(parsed.effects[0].zoom, 1.2);
        assert.equal(parsed.effects[0].color, '#8899aa');
        assert.equal(parsed.effects[0].colorStrength, 0.3);
        assert.equal(parsed.effects[0].ambientWash, true);
    });

    await t.test('parseWeatherSettings preserves multi-layer weather and sets default saturation', () => {
        const multi = {
            effects: [
                { id: 'l1', preset: 'fog', intensity: 0.5, ambientWash: false },
                { id: 'l2', preset: 'embers', intensity: 0.9, ambientWash: true }
            ]
        };
        const parsed = parseWeatherSettings(multi);
        assert.equal(parsed.saturation, 100);
        assert.equal(parsed.effects.length, 2);
        assert.equal(parsed.effects[0].ambientWash, false);
        assert.equal(parsed.effects[1].ambientWash, true);
    });
});

test('Canvas Map Manager: Cache Invalidation & Data Fingerprinting', async (t) => {
    await t.test('hasMapManagerDataChanged produces reproducible fingerprint and flags changes', () => {
        const camp = {
            maps: {
                m1: { id: 'm1', name: 'Dungeon Level 1', folder: 'Dungeons' },
                m2: { id: 'm2', name: 'Tavern Ground Floor', folder: 'Town' }
            },
            mapOrder: ['m1', 'm2'],
            activeMapId: 'm1',
            activeGMMapId: 'm1',
            playerMapOverrides: { Alice: 'm2' }
        };

        const fp1 = hasMapManagerDataChanged(camp, '');
        assert.ok(fp1, 'Returns valid initial fingerprint');

        // Same state returns false
        assert.equal(hasMapManagerDataChanged(camp, fp1), false, 'Returns false when state is unchanged');

        // Changing active GM map updates fingerprint
        camp.activeGMMapId = 'm2';
        const fp2 = hasMapManagerDataChanged(camp, fp1);
        assert.notEqual(fp2, false, 'Detects GM active map change');
        assert.notEqual(fp2, fp1);

        // Reordering maps updates fingerprint
        camp.mapOrder = ['m2', 'm1'];
        const fp3 = hasMapManagerDataChanged(camp, fp2);
        assert.notEqual(fp3, false, 'Detects map reorder');
        assert.notEqual(fp3, fp2);

        // Modifying map folder updates fingerprint
        camp.maps.m1.folder = 'Underdark';
        const fp4 = hasMapManagerDataChanged(camp, fp3);
        assert.notEqual(fp4, false, 'Detects map folder rename');
    });

    await t.test('escapeMapHtml cleanses XSS injection vectors in map names and folders', () => {
        const dirty = '<script>alert("xss")</script> & \'Castle\'';
        const clean = escapeMapHtml(dirty);
        assert.equal(clean, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;Castle&#039;');
    });
});

test('Canvas Map Manager: Thumbnail Media Classification & Markup Rendering', async (t) => {
    await t.test('detectMapMediaType classifies video, gif, YouTube and static thumbnails correctly', () => {
        // Video file
        const videoRes = detectMapMediaType({ name: 'Animated Cave' }, 'https://assets.dndforged.io/maps/cave.webm');
        assert.equal(videoRes.isVideo, true);
        assert.equal(videoRes.isGif, false);
        assert.equal(videoRes.isYt, false);

        // GIF file
        const gifRes = detectMapMediaType({ name: 'Flickering Hearth' }, '/uploads/fireplace.gif?v=2');
        assert.equal(gifRes.isVideo, false);
        assert.equal(gifRes.isGif, true);
        assert.equal(gifRes.isYt, false);

        // YouTube URL
        const ytRes = detectMapMediaType({ name: 'Waterfall Stream' }, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        assert.equal(ytRes.isVideo, false);
        assert.equal(ytRes.isYt, true);
        assert.ok(ytRes.resolvedThumb.includes('img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'));

        // Static image
        const imgRes = detectMapMediaType({ name: 'Forest Path' }, '/maps/forest.webp');
        assert.equal(imgRes.isVideo, false);
        assert.equal(imgRes.isGif, false);
        assert.equal(imgRes.isYt, false);
    });

    await t.test('buildMapThumbnailMarkup generates correct video, gif canvas, and fallback elements', () => {
        const map = { name: 'Dragon Lair' };

        // Video thumbnail markup
        const videoHtml = buildMapThumbnailMarkup(map, 'https://cdn.example.com/lair.mp4', true, false);
        assert.ok(videoHtml.includes('<video class="map-thumb-video"'));
        assert.ok(videoHtml.includes('src="https://cdn.example.com/lair.mp4#t=0.001"'));
        assert.ok(videoHtml.includes('playsinline'));
        assert.ok(videoHtml.includes('muted'));

        // GIF thumbnail markup
        const gifHtml = buildMapThumbnailMarkup(map, 'https://cdn.example.com/lava.gif', false, true);
        assert.ok(gifHtml.includes('<canvas class="map-thumb-gif-canvas"'));
        assert.ok(gifHtml.includes('<img class="map-thumb-gif-img"'));

        // Empty thumbnail fallback
        const emptyHtml = buildMapThumbnailMarkup(map, '', false, false);
        assert.ok(emptyHtml.includes('fa-solid fa-map'));
    });
});
