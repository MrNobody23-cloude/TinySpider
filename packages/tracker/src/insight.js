(function () {
    var cfg = window.InsightConfig || {};
    var siteId = cfg.siteId;
    var endpoint = cfg.endpoint;

    if (!siteId || !endpoint) return;

    var sessionKey = '__insight_session_id__';
    var honeypotKey = '__insight_honeypot_hit__';
    var interacted = false;
    var hasMouseMove = false;
    var botHint = !!navigator.webdriver;
    var firstInteractionAt = 0;

    function idle(fn) {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(fn, { timeout: 1000 });
            return;
        }
        setTimeout(fn, 0);
    }

    function getSessionId() {
        var sid = '';
        try {
            sid = sessionStorage.getItem(sessionKey) || '';
            if (!sid) {
                sid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
                sessionStorage.setItem(sessionKey, sid);
            }
        } catch (e) {
            sid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        }
        return sid;
    }

    function beacon(data) {
        var body = JSON.stringify(data);
        if (navigator.sendBeacon) {
            try {
                if (navigator.sendBeacon(endpoint, body)) return;
            } catch (e) { }
        }
        fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body,
            keepalive: true,
            credentials: 'omit'
        }).catch(function () { });
    }

    function payload(type, extra) {
        return Object.assign({
            site_id: siteId,
            event_type: type,
            url: location.href.slice(0, 2048),
            referrer: document.referrer || '',
            session_id: getSessionId(),
            bot_hint: botHint || (!hasMouseMove && Date.now() - startTs > 3000)
        }, extra || {});
    }

    function track(type, extra) {
        idle(function () {
            beacon(payload(type, extra));
        });
    }

    function onRoute() {
        track('pageview');
    }

    function patchHistory() {
        var push = history.pushState;
        var replace = history.replaceState;
        history.pushState = function () {
            var out = push.apply(this, arguments);
            onRoute();
            return out;
        };
        history.replaceState = function () {
            var out = replace.apply(this, arguments);
            onRoute();
            return out;
        };
        window.addEventListener('popstate', onRoute, { passive: true });
    }

    function markInteraction() {
        if (!interacted) {
            interacted = true;
            firstInteractionAt = Date.now();
        }
    }

    function initHoneypot() {
        try {
            var img = document.createElement('img');
            img.alt = '';
            img.width = 1;
            img.height = 1;
            img.style.cssText = 'position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
            img.src = '/insight-honeypot.gif?sid=' + encodeURIComponent(getSessionId());
            img.addEventListener('load', function () {
                if (!interacted) {
                    try { sessionStorage.setItem(honeypotKey, '1'); } catch (e) { }
                    botHint = true;
                }
            });
            document.body.appendChild(img);
        } catch (e) { }
    }

    var startTs = Date.now();
    document.addEventListener('mousemove', function () {
        hasMouseMove = true;
        markInteraction();
    }, { passive: true, once: true });

    document.addEventListener('click', function (ev) {
        markInteraction();
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        var x = ev.clientX / w;
        var y = ev.clientY / h;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        track('click', { click_x: x, click_y: y });
    }, { passive: true });

    idle(function () {
        patchHistory();
        onRoute();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initHoneypot, { once: true });
        } else {
            initHoneypot();
        }
    });
})();
