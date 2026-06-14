(() => {
  'use strict';
  const VERSION = '20260614_android_pc_safe_v4';
  const ANDROID_VIEWPORT = 'width=1280, initial-scale=0.3, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes';
  const isAndroid = /Android/i.test(navigator.userAgent || '');

  function applyAndroidPcMode() {
    if (!isAndroid) return;
    document.documentElement.classList.add('android-app-pc-mode');

    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.insertBefore(meta, document.head.firstChild);
    }
    meta.setAttribute('content', ANDROID_VIEWPORT);

    let style = document.getElementById('android-app-pc-mode-final-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'android-app-pc-mode-final-style';
      document.head.appendChild(style);
    }
    style.textContent = 'html.android-app-pc-mode{width:1280px!important;min-width:1280px!important;overflow:auto!important;overflow-x:auto!important;overflow-y:auto!important;}html.android-app-pc-mode body{min-width:1280px!important;overflow:auto!important;overflow-x:auto!important;overflow-y:auto!important;-webkit-text-size-adjust:100%;touch-action:pan-x pan-y;}';

    if (document.body) {
      document.documentElement.style.setProperty('width', '1280px', 'important');
      document.documentElement.style.setProperty('min-width', '1280px', 'important');
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.documentElement.style.setProperty('overflow-x', 'auto', 'important');
      document.documentElement.style.setProperty('overflow-y', 'auto', 'important');
      document.body.style.setProperty('min-width', '1280px', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('overflow-x', 'auto', 'important');
      document.body.style.setProperty('overflow-y', 'auto', 'important');
    }
  }

  applyAndroidPcMode();
  document.addEventListener('DOMContentLoaded', applyAndroidPcMode);
  window.addEventListener('load', applyAndroidPcMode);
  window.addEventListener('pageshow', applyAndroidPcMode);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=' + encodeURIComponent(VERSION)).catch(() => {});
    });
  }
})();
