(() => {
  'use strict';

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function applyAndroidPcMode() {
    if (!isAndroid()) return;

    const doc = document;
    const html = doc.documentElement;
    html.classList.add('android-app-pc-mode');

    let viewport = doc.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = doc.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      (doc.head || html).appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1280, initial-scale=0.3, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes');

    if (!doc.getElementById('android-app-pc-mode-style')) {
      const style = doc.createElement('style');
      style.id = 'android-app-pc-mode-style';
      style.textContent = `
html.android-app-pc-mode{
  width:1280px !important;
  min-width:1280px !important;
  overflow:auto !important;
  overflow-x:auto !important;
  overflow-y:auto !important;
}
html.android-app-pc-mode body{
  min-width:1280px !important;
  overflow:auto !important;
  overflow-x:auto !important;
  overflow-y:auto !important;
  -webkit-text-size-adjust:100% !important;
}
html.android-app-pc-mode .app,
html.android-app-pc-mode main{
  max-width:none !important;
}
`;
      (doc.head || html).appendChild(style);
    }

    const unlock = () => {
      html.classList.add('android-app-pc-mode');
      html.style.setProperty('width', '1280px', 'important');
      html.style.setProperty('min-width', '1280px', 'important');
      html.style.setProperty('overflow', 'auto', 'important');
      html.style.setProperty('overflow-x', 'auto', 'important');
      html.style.setProperty('overflow-y', 'auto', 'important');
      if (doc.body) {
        doc.body.style.setProperty('min-width', '1280px', 'important');
        doc.body.style.setProperty('overflow', 'auto', 'important');
        doc.body.style.setProperty('overflow-x', 'auto', 'important');
        doc.body.style.setProperty('overflow-y', 'auto', 'important');
        doc.body.style.setProperty('-webkit-text-size-adjust', '100%', 'important');
      }
    };

    unlock();
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', unlock, { once: true });
    }
    window.addEventListener('load', unlock, { once: true });
    window.setTimeout(unlock, 100);
    window.setTimeout(unlock, 500);
    window.setTimeout(unlock, 1200);
  }

  applyAndroidPcMode();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
