(function () {
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let reg of registrations) {
                    reg.unregister();
                }
            });
        }
        if ('caches' in window) {
            caches.keys().then(function (names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }
    } catch (e) {}

    try {
        const savedTheme = localStorage.getItem('vtt_theme') || 'classic';
        const savedColorblind = localStorage.getItem('vtt_colorblind_mode') || 'none';
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.documentElement.setAttribute('data-colorblind', savedColorblind);

        const savedScale = localStorage.getItem('vtt_font_scale_v2');
        const scaleNum = savedScale ? parseFloat(savedScale) : 1.0;
        if (!isNaN(scaleNum) && scaleNum >= 0.5 && scaleNum <= 2.2) {
            document.documentElement.style.setProperty('--vtt-font-scale', scaleNum);
            document.documentElement.style.fontSize = 'calc(15px * ' + scaleNum + ')';
        }
    } catch (e) {}
})();
