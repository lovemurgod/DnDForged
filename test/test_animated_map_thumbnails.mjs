import assert from 'assert';

console.log('--- RUNNING ANIMATED MAP THUMBNAILS TESTS ---');

// Emulate helper functions from vtt-canvas.js
function escapeMapHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function detectMapMediaType(map, safeThumb) {
    const rawThumb =
        map.thumbnail ||
        map.mapImage ||
        Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img)?.img ||
        '';
    let thumbUrl = safeThumb || rawThumb;
    const ytThumbMatch = thumbUrl
        ? thumbUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
        : null;
    if (ytThumbMatch && ytThumbMatch[1]) {
        thumbUrl = `https://img.youtube.com/vi/${ytThumbMatch[1]}/hqdefault.jpg`;
    }
    const cleanThumb = (thumbUrl || '').split('?')[0].toLowerCase();
    const isVideo =
        !ytThumbMatch &&
        Boolean(
            cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i) ||
            (thumbUrl && thumbUrl.includes('pinimg.com/videos')) ||
            map.isVideo ||
            (map.tokens &&
                Object.values(map.tokens).some(
                    (t) =>
                        t.layer === 'map' &&
                        (t.isVideo || (t.img && t.img.split('?')[0].match(/\.(mp4|webm|ogg|m4v|mov)$/i)))
                ))
        );
    let resolvedThumb = thumbUrl;
    if (isVideo && !cleanThumb.match(/\.(mp4|webm|ogg|m4v|mov)$/i)) {
        const mapToken = Object.values(map.tokens || {}).find((t) => t.layer === 'map' && t.img);
        if (mapToken && mapToken.img) {
            resolvedThumb = mapToken.img;
        }
    }
    const isGif = !isVideo && !ytThumbMatch && cleanThumb.endsWith('.gif');
    return { isVideo, isGif, resolvedThumb, isYt: !!ytThumbMatch };
}

function buildMapThumbnailMarkup(map, safeThumb, isVideo, isGif, iconSize = '1.8rem') {
    if (!safeThumb) {
        return `<i class="fa-solid fa-map" style="font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>`;
    }

    if (isVideo) {
        const videoSrc = safeThumb.includes('#') ? safeThumb : `${safeThumb}#t=0.001`;
        return `
            <video class="map-thumb-video" 
                   src="${escapeMapHtml(videoSrc)}" 
                   preload="metadata" 
                   muted 
                   playsinline 
                   loop 
                   style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"
                   onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
            </video>
            <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
        `;
    }

    if (isGif) {
        return `
            <canvas class="map-thumb-gif-canvas" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; display: block;"></canvas>
            <img class="map-thumb-gif-img" 
                 src="${escapeMapHtml(safeThumb)}" 
                 loading="lazy" 
                 alt="${escapeMapHtml(map.name)}" 
                 style="width: 100%; height: 100%; object-fit: cover; pointer-events: none; display: none;" 
                 onerror="this.style.display='none'; if(this.previousElementSibling) this.previousElementSibling.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
            <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
        `;
    }

    return `
        <img src="${escapeMapHtml(safeThumb)}" 
             loading="lazy" 
             alt="${escapeMapHtml(map.name)}" 
             style="width: 100%; height: 100%; object-fit: cover;" 
             onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
        <i class="fa-solid fa-map" style="display: none; font-size: ${iconSize}; color: rgba(212,175,55,0.25);"></i>
    `;
}

// TEST 1: Video Format Detection
console.log('\n[TEST 1] Testing Video Format Detection (.webm, .mp4, .mov, .ogg, .m4v)...');
const webmMap = { name: 'Dungeon Webm', thumbnail: 'maps/dungeon.webm' };
const mp4Map = { name: 'River MP4', mapImage: 'maps/river.mp4' };
const movMap = { name: 'Cave MOV', thumbnail: 'https://example.com/cave.mov?token=123' };
const tokenVideoMap = {
    name: 'Token Layer Video',
    thumbnail: '',
    tokens: {
        asset_1: { layer: 'map', img: 'maps/animated_crypt.webm', isVideo: true }
    }
};

const d1 = detectMapMediaType(webmMap, webmMap.thumbnail);
assert.strictEqual(d1.isVideo, true, 'Webm map must be detected as video');
assert.strictEqual(d1.isGif, false);

const d2 = detectMapMediaType(mp4Map, mp4Map.mapImage);
assert.strictEqual(d2.isVideo, true, 'MP4 map must be detected as video');

const d3 = detectMapMediaType(movMap, movMap.thumbnail);
assert.strictEqual(d3.isVideo, true, 'MOV map with query params must be detected as video');

const d4 = detectMapMediaType(tokenVideoMap, '');
assert.strictEqual(d4.isVideo, true, 'Token layer animated map must be detected as video');
assert.strictEqual(d4.resolvedThumb, 'maps/animated_crypt.webm');
console.log('✓ All video formats correctly identified as isVideo = true.');

// TEST 2: GIF Format Detection
console.log('\n[TEST 2] Testing GIF Format Detection (.gif)...');
const gifMap = { name: 'Fireplace Animated', thumbnail: 'maps/fireplace.gif' };
const dGif = detectMapMediaType(gifMap, gifMap.thumbnail);
assert.strictEqual(dGif.isVideo, false, 'GIF must not be detected as isVideo');
assert.strictEqual(dGif.isGif, true, 'GIF must be detected as isGif');
console.log('✓ GIF maps correctly identified as isGif = true.');

// TEST 3: Static Images and YouTube Detection
console.log('\n[TEST 3] Testing Static Images and YouTube...');
const jpgMap = { name: 'Forest', thumbnail: 'maps/forest.jpg' };
const ytMap = { name: 'YouTube Map', mapImage: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };

const dJpg = detectMapMediaType(jpgMap, jpgMap.thumbnail);
assert.strictEqual(dJpg.isVideo, false);
assert.strictEqual(dJpg.isGif, false);

const dYt = detectMapMediaType(ytMap, ytMap.mapImage);
assert.strictEqual(dYt.isYt, true);
assert.strictEqual(dYt.isVideo, false);
assert.ok(dYt.resolvedThumb.includes('img.youtube.com'), 'YouTube converts to image thumbnail');
console.log('✓ Standard images and YouTube remain normal image previews.');

// TEST 4: Video Markup Generation (#t=0.001, muted, loop, playsinline, preload)
console.log('\n[TEST 4] Testing Video Markup Generation...');
const videoMarkup = buildMapThumbnailMarkup(webmMap, webmMap.thumbnail, true, false, '1.8rem');
assert.ok(videoMarkup.includes('<video class="map-thumb-video"'), 'Must render <video> tag');
assert.ok(videoMarkup.includes('src="maps/dungeon.webm#t=0.001"'), 'Must include #t=0.001 for frame 0 seek');
assert.ok(videoMarkup.includes('preload="metadata"'), 'Must set preload="metadata"');
assert.ok(videoMarkup.includes('muted'), 'Must be muted');
assert.ok(videoMarkup.includes('playsinline'), 'Must have playsinline');
assert.ok(videoMarkup.includes('loop'), 'Must have loop');
assert.ok(videoMarkup.includes('pointer-events: none'), 'Must have pointer-events: none so container gets hover');
console.log('✓ Video markup properly constructed with static frame seek and silent looped attributes.');

// TEST 5: GIF Markup Generation (Canvas + Img)
console.log('\n[TEST 5] Testing GIF Markup Generation...');
const gifMarkup = buildMapThumbnailMarkup(gifMap, gifMap.thumbnail, false, true, '1.8rem');
assert.ok(gifMarkup.includes('<canvas class="map-thumb-gif-canvas"'), 'Must render <canvas> for static frame');
assert.ok(gifMarkup.includes('<img class="map-thumb-gif-img"'), 'Must render <img> for animated frame');
assert.ok(gifMarkup.includes('display: block'), 'Canvas must be default visible');
assert.ok(gifMarkup.includes('display: none'), 'Image must be default hidden');
console.log('✓ GIF markup properly constructed with static canvas and revealable image.');

console.log('\n======================================================');
console.log('ALL 5 ANIMATED MAP THUMBNAIL TESTS PASSED!');
console.log('======================================================\n');
