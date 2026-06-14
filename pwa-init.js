(() => {
  'use strict';

  function isAndroidWebViewOrCapacitor() {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const hasWebViewToken = /;\s*wv\)/i.test(ua) || /\bwv\b/i.test(ua);
    const hasAndroidWebViewVersionPattern = /Version\/\d+(?:\.\d+)?\s+Chrome\/[\d.]+\s+Mobile Safari/i.test(ua);
    const cap = window.Capacitor;
    let isCapacitorAndroid = false;
    try {
      isCapacitorAndroid = !!(cap && (
        (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
        (typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android') ||
        cap.platform === 'android'
      ));
    } catch (e) {}
    return isCapacitorAndroid || (isAndroid && (hasWebViewToken || hasAndroidWebViewVersionPattern));
  }

  function applyAndroidWebViewPcMode() {
    if (!isAndroidWebViewOrCapacitor()) return;

    const doc = document;
    const html = doc.documentElement;
    html.classList.add('android-webview-pc-mode');

    let viewport = doc.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = doc.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      (doc.head || html).appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1280, user-scalable=yes');

    if (!doc.getElementById('android-webview-pc-mode-style')) {
      const style = doc.createElement('style');
      style.id = 'android-webview-pc-mode-style';
      style.textContent = `
html.android-webview-pc-mode{
  width:1280px !important;
  min-width:1280px !important;
  overflow:auto !important;
  overflow-x:auto !important;
  overflow-y:auto !important;
}
html.android-webview-pc-mode body{
  min-width:1280px !important;
  overflow:auto !important;
  overflow-x:auto !important;
  overflow-y:auto !important;
  -webkit-text-size-adjust:100%;
}
`;
      (doc.head || html).appendChild(style);
    }

    const unlock = () => {
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
    window.setTimeout(unlock, 300);
    window.setTimeout(unlock, 1000);
  }

  applyAndroidWebViewPcMode();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
