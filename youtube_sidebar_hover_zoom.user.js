// ==UserScript==
// @name         YouTube Sidebar Hover Zoom
// @namespace    https://local.userscripts/
// @version      1.1.0
// @description  Enlarge only the sidebar thumbnail on YouTube watch pages and move it to the screen center while hovered.
// @match        https://www.youtube.com/watch*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const settings = {
    maxWidthVw: 0.78,
    maxWidthPx: 1400,
    maxHeightVh: 0.82,
    durationMs: 180,
    shadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
    borderRadius: '18px',
    backdrop: 'rgba(0, 0, 0, 0.34)',
  };

  const styleId = 'yt-sidebar-hover-zoom-style';
  const overlayId = 'yt-sidebar-hover-zoom-overlay';
  const activeThumbnailClass = 'yt-sidebar-hover-thumbnail-active';
  const activeSourceClass = 'yt-sidebar-hover-source-active';
  const targetSelector = [
    '#related ytd-compact-video-renderer',
    '#related ytd-compact-radio-renderer',
    '#related ytd-compact-playlist-renderer',
    '#related ytd-compact-movie-renderer',
    '#related ytd-compact-promoted-video-renderer',
    '#related yt-lockup-view-model',
  ].join(', ');
  const thumbnailSelector = [
    'ytd-thumbnail',
    'a.ytLockupViewModelContentImage',
    'yt-thumbnail-view-model',
    '.ytThumbnailViewModelHost',
    'a#thumbnail',
  ].join(', ');

  let overlay = null;
  let activeTarget = null;
  let activeThumbnail = null;

  function injectStyle() {
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      :root {
        --yt-sidebar-hover-duration: ${settings.durationMs}ms;
        --yt-sidebar-hover-shadow: ${settings.shadow};
        --yt-sidebar-hover-radius: ${settings.borderRadius};
      }

      #${overlayId} {
        position: fixed;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        background: ${settings.backdrop};
        backdrop-filter: blur(2px);
        transition: opacity var(--yt-sidebar-hover-duration) ease;
        z-index: 2147483645;
      }

      #${overlayId}.is-visible {
        opacity: 1;
      }

      #secondary,
      #secondary-inner,
      #related,
      #related #items,
      #related #contents,
      ytd-watch-next-secondary-results-renderer,
      ytd-watch-next-secondary-results-renderer #items,
      ${targetSelector},
      ${targetSelector} #dismissible {
        overflow: visible !important;
      }

      #related {
        isolation: isolate;
      }

      ${targetSelector} {
        position: relative !important;
        z-index: 0;
      }

      ${targetSelector}.${activeSourceClass} {
        z-index: 2147483646 !important;
      }

      .${activeThumbnailClass} {
        position: relative !important;
        z-index: 2147483647 !important;
        overflow: hidden !important;
        border-radius: var(--yt-sidebar-hover-radius) !important;
        transform-origin: center center !important;
        transform: translate3d(
          var(--yt-sidebar-hover-translate-x, 0px),
          var(--yt-sidebar-hover-translate-y, 0px),
          0
        ) scale(var(--yt-sidebar-hover-scale, 1)) !important;
        filter: drop-shadow(var(--yt-sidebar-hover-shadow));
        transition:
          transform var(--yt-sidebar-hover-duration) ease,
          filter var(--yt-sidebar-hover-duration) ease,
          border-radius var(--yt-sidebar-hover-duration) ease;
        will-change: transform;
        pointer-events: none !important;
      }

      .${activeThumbnailClass} img,
      .${activeThumbnailClass} video,
      .${activeThumbnailClass} iframe,
      .${activeThumbnailClass} canvas,
      .${activeThumbnailClass} .yt-core-image,
      .${activeThumbnailClass} #img {
        border-radius: inherit !important;
      }

      @media (prefers-reduced-motion: reduce) {
        #${overlayId},
        .${activeThumbnailClass} {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) {
      return;
    }

    overlay = document.createElement('div');
    overlay.id = overlayId;
    document.body.appendChild(overlay);
  }

  function findThumbnailHost(target) {
    if (!target) {
      return null;
    }

    return target.querySelector(thumbnailSelector);
  }

  function clearActivePreview() {
    if (activeThumbnail) {
      activeThumbnail.classList.remove(activeThumbnailClass);
      activeThumbnail.style.removeProperty('--yt-sidebar-hover-translate-x');
      activeThumbnail.style.removeProperty('--yt-sidebar-hover-translate-y');
      activeThumbnail.style.removeProperty('--yt-sidebar-hover-scale');
    }

    if (activeTarget) {
      activeTarget.classList.remove(activeSourceClass);
    }

    overlay?.classList.remove('is-visible');
    activeTarget = null;
    activeThumbnail = null;
  }

  function activatePreview(target) {
    const thumbnail = findThumbnailHost(target);
    if (!thumbnail) {
      clearActivePreview();
      return;
    }

    const rect = thumbnail.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      clearActivePreview();
      return;
    }

    const maxWidth = Math.min(window.innerWidth * settings.maxWidthVw, settings.maxWidthPx);
    const maxHeight = window.innerHeight * settings.maxHeightVh;
    const scale = Math.max(1, Math.min(maxWidth / rect.width, maxHeight / rect.height));
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const translateX = centerX - (rect.left + rect.width / 2);
    const translateY = centerY - (rect.top + rect.height / 2);

    if (activeThumbnail && activeThumbnail !== thumbnail) {
      clearActivePreview();
    }

    activeTarget = target;
    activeThumbnail = thumbnail;

    thumbnail.style.setProperty('--yt-sidebar-hover-translate-x', `${translateX}px`);
    thumbnail.style.setProperty('--yt-sidebar-hover-translate-y', `${translateY}px`);
    thumbnail.style.setProperty('--yt-sidebar-hover-scale', scale.toFixed(4));
    thumbnail.classList.add(activeThumbnailClass);
    target.classList.add(activeSourceClass);
    overlay?.classList.add('is-visible');
  }

  function handlePointerOver(event) {
    const target = event.target instanceof Element ? event.target.closest(targetSelector) : null;
    if (!target) {
      return;
    }

    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) {
      return;
    }

    activatePreview(target);
  }

  function handlePointerOut(event) {
    const target = event.target instanceof Element ? event.target.closest(targetSelector) : null;
    if (!target || target !== activeTarget) {
      return;
    }

    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) {
      return;
    }

    clearActivePreview();
  }

  function boot() {
    if (!document.head || !document.body) {
      return;
    }

    injectStyle();
    ensureOverlay();
  }

  boot();
  document.addEventListener('pointerover', handlePointerOver, true);
  document.addEventListener('pointerout', handlePointerOut, true);
  window.addEventListener('scroll', clearActivePreview, { passive: true });
  window.addEventListener('resize', clearActivePreview, { passive: true });
  document.addEventListener('yt-navigate-start', clearActivePreview, { passive: true });
  document.addEventListener('yt-navigate-finish', boot, { passive: true });
})();
