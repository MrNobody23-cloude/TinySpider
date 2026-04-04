/**
 * Insight-OS Tracker — v1.0
 * ─────────────────────────────────────────────────────────────────────
 * Paste this ONE script tag on any page you own to start tracking.
 * 
 *   <script src="http://localhost:3001/tracker.js" defer></script>
 * 
 * What it tracks:
 *   - Page URL (path only, no query strings by default)
 *   - Referrer domain
 *   - Browser & OS (from User-Agent — no fingerprinting)
 *   - Time on page (before user leaves or hides tab)
 *   - Unique sessions (sessionStorage — cleared when tab closes)
 * 
 * What it does NOT track:
 *   - IP addresses
 *   - Cookies beyond sessionStorage
 *   - Any personal/identifiable information
 *   - Mouse movements or keystrokes
 * ─────────────────────────────────────────────────────────────────────
 */
(function () {
    'use strict';

    const ENDPOINT = 'http://localhost:3001/track';

    // ── Generate a unique visitor ID (persists across sessions via localStorage) ──
    function genUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // Unique visitor ID — stored in localStorage so it survives page refreshes
    let visitorId = localStorage.getItem('_ios_vid');
    if (!visitorId) {
        visitorId = genUUID();
        localStorage.setItem('_ios_vid', visitorId);
    }

    // Session ID — stored in sessionStorage so a new session starts each tab/window open
    let sessionId = sessionStorage.getItem('_ios_sid');
    if (!sessionId) {
        sessionId = genUUID();
        sessionStorage.setItem('_ios_sid', sessionId);
    }

    // ── Page start time ───────────────────────────────────────────────────
    const pageStartTime = Date.now();

    // ── Sanitize page path (strip query & hash by default) ───────────────
    function getPage() {
        return window.location.pathname || '/';
    }

    // ── Sanitize referrer (only domain) ──────────────────────────────────
    function getReferrer() {
        try {
            const ref = document.referrer;
            if (!ref) return 'direct';
            const u = new URL(ref);
            // Don't count self-referrals
            if (u.hostname === window.location.hostname) return 'direct';
            return ref;
        } catch (_) { return 'direct'; }
    }

    // ── Send event via sendBeacon (fire-and-forget, non-blocking) ─────────
    function send(payload) {
        const data = JSON.stringify({
            ...payload,
            visitorId,
            sessionId,
            ua: navigator.userAgent,
        });

        // sendBeacon is preferred (works during page unload)
        if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(ENDPOINT, blob);
        } else {
            // Fallback for older browsers
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: data,
                keepalive: true,
            }).catch(() => { /* silent */ });
        }
    }

    // ── Fire pageview ──────────────────────────────────────────────────────
    function trackPageview() {
        send({
            type: 'pageview',
            page: getPage(),
            referrer: getReferrer(),
        });
    }

    // ── Fire time-on-page when user leaves ────────────────────────────────
    function trackTimeOnPage() {
        const seconds = Math.round((Date.now() - pageStartTime) / 1000);
        if (seconds < 1) return; // ignore bounces under 1s (tab accidentally opened)
        send({
            type: 'timeonpage',
            page: getPage(),
            timeOnPage: seconds,
        });
    }

    // ── SPA support: re-fire on history navigation ───────────────────────
    function patchHistory(method) {
        const original = history[method];
        return function () {
            const result = original.apply(this, arguments);
            trackPageview();
            return result;
        };
    }

    // Fire initial pageview
    trackPageview();

    // Track clicks for heatmaps — store ABSOLUTE pixel coords for pixel-perfect accuracy
    document.addEventListener('click', (e) => {
        send({
            type: 'click',
            page: getPage(),
            x: Math.round(e.pageX),                              // absolute px from page left
            y: Math.round(e.pageY),                              // absolute px from page top
            pageW: document.documentElement.scrollWidth,             // total page width
            pageH: document.documentElement.scrollHeight,            // total page height
            viewportW: window.innerWidth,                               // browser viewport width
        });
    });

    // Time on page — fires when user hides tab or closes it
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') trackTimeOnPage();
    });
    window.addEventListener('pagehide', trackTimeOnPage);

    // SPA navigation (pushState / replaceState)
    history.pushState = patchHistory('pushState');
    history.replaceState = patchHistory('replaceState');
    window.addEventListener('popstate', trackPageview);

})();
