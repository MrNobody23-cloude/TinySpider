/* ═══════════════════════════════════════════
   TinySpider Demo Site — Event Logger & UI
   ═══════════════════════════════════════════ */

(function () {
    'use strict';

    let eventCount = 0;
    let logOpen = false;

    // ─── Event Log ───
    function createEventLog() {
        const panel = document.createElement('div');
        panel.className = 'event-log';
        panel.id = 'event-log';
        panel.innerHTML = `
            <div class="event-log-header">
                <h4>📡 Live Event Stream</h4>
                <button class="btn btn-ghost btn-sm" id="clear-log">Clear</button>
            </div>
            <div class="event-log-body" id="event-log-body"></div>
        `;
        document.body.appendChild(panel);

        document.getElementById('clear-log').addEventListener('click', function () {
            document.getElementById('event-log-body').innerHTML = '';
        });
    }

    function logEvent(type, detail) {
        eventCount++;
        updateCounter();

        var body = document.getElementById('event-log-body');
        if (!body) return;

        var entry = document.createElement('div');
        entry.className = 'event-log-entry';
        var now = new Date();
        var time = now.toLocaleTimeString('en-US', { hour12: false });

        entry.innerHTML =
            '<span class="time">' + time + '</span>' +
            '<span class="type ' + type + '">' + type + '</span>' +
            '<span class="detail">' + escapeHtml(detail) + '</span>';

        body.insertBefore(entry, body.firstChild);

        // Keep only last 50 entries
        while (body.children.length > 50) {
            body.removeChild(body.lastChild);
        }
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── Tracking Status Badge ───
    function createTrackingBadge() {
        var badge = document.createElement('div');
        badge.className = 'tracking-status';
        badge.id = 'tracking-status';
        badge.innerHTML =
            '<span class="dot"></span>' +
            '<span>TinySpider Active</span>' +
            '<span class="counter" id="event-counter">0 events</span>';
        badge.addEventListener('click', toggleEventLog);
        document.body.appendChild(badge);
    }

    function toggleEventLog() {
        logOpen = !logOpen;
        var panel = document.getElementById('event-log');
        if (panel) {
            panel.classList.toggle('open', logOpen);
        }
    }

    function updateCounter() {
        var el = document.getElementById('event-counter');
        if (el) {
            el.textContent = eventCount + ' events';
        }
    }

    // ─── Scroll Progress Bar ───
    function createScrollProgress() {
        var bar = document.createElement('div');
        bar.className = 'scroll-progress';
        bar.id = 'scroll-progress';
        bar.style.width = '0%';
        document.body.appendChild(bar);

        window.addEventListener('scroll', function () {
            var scrollTop = window.scrollY;
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            bar.style.width = progress + '%';
        }, { passive: true });
    }

    // ─── Toast Notifications ───
    function createToastContainer() {
        var container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    function showToast(message, icon) {
        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = '<span>' + (icon || '✅') + '</span><span>' + escapeHtml(message) + '</span>';
        container.appendChild(toast);

        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

    // ─── Intercept tracker beacon calls to log them ───
    function interceptTracker() {
        var origBeacon = navigator.sendBeacon;
        if (origBeacon) {
            navigator.sendBeacon = function (url, data) {
                try {
                    var parsed = JSON.parse(data);
                    if (parsed && parsed.event_type) {
                        var detail = parsed.url || '';
                        if (parsed.event_type === 'click') {
                            detail = 'x:' + (parsed.click_x || 0).toFixed(3) + ' y:' + (parsed.click_y || 0).toFixed(3);
                        }
                        logEvent(parsed.event_type, detail);
                    }
                } catch (e) { }
                return origBeacon.call(navigator, url, data);
            };
        }

        var origFetch = window.fetch;
        window.fetch = function (url, opts) {
            try {
                if (opts && opts.body && typeof opts.body === 'string') {
                    var parsed = JSON.parse(opts.body);
                    if (parsed && parsed.event_type) {
                        var detail = parsed.url || '';
                        if (parsed.event_type === 'click') {
                            detail = 'x:' + (parsed.click_x || 0).toFixed(3) + ' y:' + (parsed.click_y || 0).toFixed(3);
                        }
                        logEvent(parsed.event_type, detail);
                    }
                }
            } catch (e) { }
            return origFetch.apply(window, arguments);
        };
    }

    // ─── Interactive Demo Handlers ───
    function setupDemoInteractions() {
        // Newsletter form
        var newsletterForm = document.getElementById('newsletter-form');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', function (e) {
                e.preventDefault();
                showToast('Newsletter subscription tracked!', '📧');
                logEvent('custom', 'newsletter_signup');

                // Send custom event to tracker
                if (window.InsightConfig && window.InsightConfig.endpoint) {
                    var payload = {
                        site_id: window.InsightConfig.siteId,
                        event_type: 'custom',
                        url: location.href,
                        session_id: sessionStorage.getItem('__insight_session_id__') || ''
                    };
                    try {
                        navigator.sendBeacon(window.InsightConfig.endpoint, JSON.stringify(payload));
                    } catch (e) { }
                }
            });
        }

        // Contact form
        var contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', function (e) {
                e.preventDefault();
                showToast('Contact form submission tracked!', '📬');
                logEvent('custom', 'contact_form_submit');
            });
        }

        // CTA buttons
        document.querySelectorAll('[data-track-event]').forEach(function (el) {
            el.addEventListener('click', function () {
                var eventName = el.getAttribute('data-track-event');
                showToast('Event tracked: ' + eventName, '🎯');
                logEvent('custom', eventName);
            });
        });

        // Pricing cards
        document.querySelectorAll('.pricing-card .btn').forEach(function (el) {
            el.addEventListener('click', function () {
                var tier = el.closest('.pricing-card').querySelector('.pricing-tier');
                var tierName = tier ? tier.textContent : 'unknown';
                showToast('Pricing click: ' + tierName, '💰');
                logEvent('custom', 'pricing_click_' + tierName.toLowerCase().replace(/\s/g, '_'));
            });
        });
    }

    // ─── Init ───
    function init() {
        interceptTracker();
        createToastContainer();
        createEventLog();
        createTrackingBadge();
        createScrollProgress();

        // Wait for DOM content
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                setupDemoInteractions();
                logEvent('pageview', location.pathname);
            });
        } else {
            setupDemoInteractions();
            logEvent('pageview', location.pathname);
        }
    }

    init();
})();
