/**
 * Insight-OS Dashboard — script.js
 * All data comes from the real backend (localhost:3001).
 * No fake/random values anywhere.
 */

/* ── TOP OF SCRIPT.JS ── */

// 1. Paste your Render URL here (e.g., https://your-backend.onrender.com)
const PROD_API_URL = "https://tinyspider.onrender.com";

const API = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : PROD_API_URL;

const getWSUrl = () => {
    const isLocal = window.location.hostname === 'localhost';
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

    if (isLocal) return `${protocol}//localhost:3001`;

    // For Production: Strip 'https://' from the URL for WebSocket
    const host = PROD_API_URL.replace(/^https?:\/\//, '');
    return `${protocol}//${host}`;
};

/* ── Chart.js global defaults ─────────────────────────── */
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Outfit', sans-serif";

// Register Chart.js Plugin
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

/* ── Utility ──────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function fmtTime(sec) {
    if (!sec || sec < 1) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
}

function fmtNum(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString();
}

/* ── API helpers ──────────────────────────────────────── */
async function apiFetch(path) {
    try {
        const r = await fetch(API + path);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } catch (e) {
        console.warn('[Insight-OS] API error:', path, e.message);
        return null;
    }
}

/* ── Empty chart defaults (shown before data arrives) ─── */
const CHART_DEFAULTS = {
    emptyScales: {
        x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#475569' },
        },
        y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#475569' },
        },
    },
};

/* ══════════════════════════════════════════════════════
   InsightOS Dashboard Class
══════════════════════════════════════════════════════ */
class InsightOS {
    constructor() {
        this.charts = {};
        this.ws = null;
        this.rtBins = Array(30).fill(0); // 30 × 2s buckets = 60s window
        this.rtLabels = Array.from({ length: 30 }, (_, i) => `-${(29 - i) * 2}s`);
        this.init();
    }

    async init() {
        this.initTheme();
        this.initNavigation();
        this.initCharts();
        this.connectWebSocket();

        // Load initial data from API
        await this.refreshOverview();
        await this.refreshTraffic();
        await this.refreshPages();
        await this.refreshSessions();
        await this.refreshReferrers();
        await this.refreshRealtime();
        await this.refreshHeatmaps();
        await this.refreshBotStats();

        // Bind heatmap controls
        const pmSelect = $('heatmapPageSelect');
        if (pmSelect) {
            pmSelect.addEventListener('change', () => this.refreshHeatmaps());
        }
        const refreshBtn = $('heatmapRefreshBtn'); // Corrected ID
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('[Insight-OS] Refreshing heatmaps...');
                this.refreshHeatmaps();
            });
        }

        // Poll every 10 seconds to keep data fresh
        setInterval(() => this.refreshOverview(), 10_000);
        setInterval(() => this.refreshSessions(), 5_000);
        setInterval(() => this.refreshRealtime(), 2_000);
    }

    /* ── THEME ─────────────────────────────────────────── */
    initTheme() {
        const btn = $('themeToggleBtn');
        const root = document.documentElement;
        const saved = localStorage.getItem('ios-theme') || 'dark';
        root.setAttribute('data-theme', saved);

        btn?.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            localStorage.setItem('ios-theme', next);
            this.updateChartColors();
        });
    }

    updateChartColors() {
        const dark = document.documentElement.getAttribute('data-theme') !== 'light';
        const grid = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        const tick = dark ? '#475569' : '#64748b';
        Object.values(this.charts).forEach(c => {
            if (!c?.options?.scales) return;
            ['x', 'y'].forEach(ax => {
                if (c.options.scales[ax]) {
                    c.options.scales[ax].grid = { color: grid };
                    c.options.scales[ax].ticks = { color: tick };
                }
            });
            c.update('none');
        });
    }



    /* ── NAVIGATION ────────────────────────────────────── */
    initNavigation() {
        const btns = document.querySelectorAll('.top-nav-btn');
        const panels = document.querySelectorAll('.tab-panel');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab)?.classList.add('active');
                // Refresh charts so they resize properly in the newly-visible panel
                requestAnimationFrame(() => {
                    Object.values(this.charts).forEach(c => c?.resize?.());
                });
                // Load fresh data for the activated tab
                const tab = btn.dataset.tab;
                if (tab === 'realtime') { this.refreshSessions(); this.refreshRealtime(); }
                if (tab === 'referrers') this.refreshReferrers();
                if (tab === 'overview') { this.refreshTraffic(); this.refreshPages(); }
                if (tab === 'heatmaps') this.refreshHeatmaps();
                if (tab === 'bots') this.refreshBotStats();
                if (tab === 'funnels') this.buildFunnel(this._lastFunnelSteps || ['/', '/pricing', '/checkout']);
            });
        });
    }

    /* ── CREATE CHARTS (empty until data arrives) ──────── */
    initCharts() {
        Chart.register(ChartDataLabels);

        /* Traffic line */
        this.charts.traffic = new Chart($('trafficChart'), {
            type: 'line',
            data: {
                labels: [], datasets: [{
                    label: 'Page Views', data: [],
                    borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.10)',
                    pointBackgroundColor: '#a78bfa', pointRadius: 4, pointHoverRadius: 6,
                    tension: 0.45, fill: true, borderWidth: 2.5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false }, datalabels: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(14,17,24,0.92)', borderColor: 'rgba(124,58,237,0.4)',
                        borderWidth: 1, titleColor: '#f1f5f9', bodyColor: '#94a3b8', padding: 12, cornerRadius: 10
                    }
                },
                scales: CHART_DEFAULTS.emptyScales,
            },
        });

        /* Top pages bar */
        this.charts.pages = new Chart($('pagesChart'), {
            type: 'bar',
            data: {
                labels: [], datasets: [{
                    label: 'Page Views', data: [],
                    backgroundColor: ['rgba(124,58,237,0.75)', 'rgba(6,182,212,0.75)',
                        'rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)', 'rgba(244,63,94,0.75)',
                        'rgba(124,58,237,0.55)', 'rgba(6,182,212,0.55)', 'rgba(16,185,129,0.55)'],
                    borderRadius: 8, borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569' } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569' } },
                },
            },
        });

        /* Real-time line */
        this.charts.realtime = new Chart($('realtimeChart'), {
            type: 'line',
            data: {
                labels: [...this.rtLabels],
                datasets: [{
                    label: 'Page Views', data: [...this.rtBins],
                    borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.10)',
                    tension: 0.45, fill: true, borderWidth: 2.5, pointRadius: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { display: false }, datalabels: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#475569', maxTicksLimit: 8 } },
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569' } },
                },
            },
        });

        /* Funnel bar (horizontal) */
        this.charts.funnel = new Chart($('funnelChart'), {
            type: 'bar',
            data: {
                labels: [], datasets: [{
                    label: 'Users', data: [],
                    backgroundColor: ['rgba(124,58,237,0.8)', 'rgba(6,182,212,0.8)', 'rgba(16,185,129,0.8)'],
                    borderRadius: 10, borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end', align: 'end', color: '#94a3b8',
                        font: { weight: 600 }, formatter: v => v ? v.toLocaleString() : '0'
                    },
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569' } },
                    y: { grid: { display: false }, ticks: { color: '#f1f5f9', font: { weight: 600 } } },
                },
            },
        });

        /* Referrers doughnut */
        this.charts.referrers = new Chart($('referrersChart'), {
            type: 'doughnut',
            data: {
                labels: [], datasets: [{
                    data: [],
                    backgroundColor: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e',
                        '#a855f7', '#0891b2', '#059669'],
                    borderWidth: 2, borderColor: 'rgba(8,11,18,0.8)', hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '68%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', boxWidth: 12, padding: 16, font: { size: 13 } }
                    },
                    datalabels: { display: false },
                },
            },
        });

        /* Funnel analyze button */
        $('analyzeFunnel')?.addEventListener('click', () => {
            const steps = [...document.querySelectorAll('.funnel-step')].map(i => i.value.trim() || i.placeholder);
            this._lastFunnelSteps = steps;
            this.buildFunnel(steps);
        });

        // Auto-load default funnel
        const defaultSteps = ['/', '/pricing', '/checkout'];
        this._lastFunnelSteps = defaultSteps;
        setTimeout(() => this.buildFunnel(defaultSteps), 500);
    }

    /* ── API REFRESH METHODS ───────────────────────────── */

    async refreshOverview() {
        const data = await apiFetch('/api/overview');
        if (!data) return;

        // Header live count
        const liveEl = $('realTimeCount');
        if (liveEl) liveEl.textContent = data.liveCount;

        // Header KPIs
        const tvEl = $('totalVisitors');
        if (tvEl) tvEl.textContent = fmtNum(data.totalVisitors);
        const brEl = $('bounceRate');
        if (brEl) brEl.textContent = data.bounceRate + '%';

        // KPI Cards on overview tab
        this.setKPI('kpi-visitors', fmtNum(data.totalVisitors));
        this.setKPI('kpi-pageviews', fmtNum(data.totalPageviews));
        this.setKPI('kpi-session', fmtTime(data.avgTime));
        this.setKPI('kpi-bounce', data.bounceRate + '%');
    }

    setKPI(id, value) {
        const el = $(id);
        if (el) el.textContent = value;
    }

    async refreshTraffic() {
        const data = await apiFetch('/api/traffic');
        if (!data) return;
        const ch = this.charts.traffic;
        ch.data.labels = data.labels;
        ch.data.datasets[0].data = data.data;
        ch.update();
    }

    async refreshPages() {
        const data = await apiFetch('/api/pages');
        if (!data) return;
        const ch = this.charts.pages;
        ch.data.labels = data.labels;
        ch.data.datasets[0].data = data.data;
        ch.update();
    }

    async refreshSessions() {
        const data = await apiFetch('/api/sessions');
        if (!data) return;

        // Live count
        const liveEl = $('realTimeCount');
        if (liveEl) liveEl.textContent = data.count;

        // Session list
        const list = $('sessionList');
        if (!list) return;

        if (!data.sessions.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>No active sessions yet.</p>
                    <p>Open the <a href="http://localhost:8081" target="_blank">demo site</a> to start tracking.</p>
                </div>`;
            return;
        }

        list.innerHTML = data.sessions.map(s => `
            <div class="session-item">
                <span class="session-dot"></span>
                <span class="session-page">${s.page || '/'}</span>
                <span class="session-meta">${s.browser} · ${fmtTime(s.duration)}</span>
            </div>`).join('');
    }

    async refreshRealtime() {
        const data = await apiFetch('/api/realtime');
        if (!data) return;
        const ch = this.charts.realtime;
        ch.data.labels = data.labels;
        ch.data.datasets[0].data = data.data;
        ch.update('none');
    }

    async refreshReferrers() {
        const data = await apiFetch('/api/referrers');
        if (!data) return;
        const ch = this.charts.referrers;
        ch.data.labels = data.labels;
        ch.data.datasets[0].data = data.data;
        ch.update();
    }

    async refreshBotStats() {
        const data = await apiFetch('/api/bot-stats');
        if (!data) return;

        $('bot-count').textContent = data.summary.botCount;
        $('suspicious-count').textContent = data.summary.suspiciousCount;
        $('human-count').textContent = data.summary.humanCount;

        const list = $('botSessionList');
        if (!list) return;

        if (!data.sessions.length) {
            list.innerHTML = `<div class="empty-state"><p>Zero bots detected. Pure human traffic.</p></div>`;
            return;
        }

        list.innerHTML = data.sessions.map(s => `
            <div class="session-item" style="padding: 1.25rem; border-left: 4px solid ${s.risk === 'HIGH' ? 'var(--rose)' : 'var(--amber)'}">
                <div style="flex: 1">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem">
                        <span class="session-page" style="font-family: monospace; font-size: 0.8rem">Session: ${s.sessionId}</span>
                        <span class="card-badge" style="background: ${s.risk === 'HIGH' ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.1)'}; color: ${s.risk === 'HIGH' ? 'var(--rose)' : 'var(--amber)'}">
                            ${s.risk} RISK (Score: ${s.score})
                        </span>
                    </div>
                    <div class="session-meta" style="margin-bottom: 0.75rem">${s.userAgent}</div>
                    <div style="display:flex; gap: 0.5rem">
                        ${s.indicators.map(ind => `<span style="font-size: 0.7rem; padding: 2px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text-2)">${ind}</span>`).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    async buildFunnel(steps) {
        // Fetch pages data to build a funnel from real counts
        const data = await apiFetch('/api/pages');
        if (!data) return;
        const pageMap = {};
        data.labels.forEach((p, i) => { pageMap[p] = data.data[i]; });

        const counts = steps.map(s => pageMap[s] || 0);
        const ch = this.charts.funnel;
        ch.data.labels = steps;
        ch.data.datasets[0].data = counts;
        ch.update();
    }

    /* ── HEATMAPS REFRESH AND DRAW ────────────────────── */
    async refreshHeatmaps() {
        const select = $('heatmapPageSelect');
        if (!select) return;
        const page = select.value || '/';
        const data = await apiFetch(`/api/heatmaps?page=${encodeURIComponent(page)}`);
        if (!data) return;

        // API returns { clicks: [{x,y} in absolute px], pageW, pageH, viewportW }
        this._heatmapData = data.clicks || [];

        if (data.pageH) {
            this._setHeatmapDimensions(data.pageW, data.pageH, data.viewportW);
        }

        // Small delay so CSS dimensions propagate before we read them
        requestAnimationFrame(() => this.drawHeatmap());
    }

    // Set iframe + canvas to exact real page dimensions and cache them
    _setHeatmapDimensions(pageW, pageH, viewportW) {
        // viewportW = browser width when user clicked → same layout inside iframe
        const w = Math.round(viewportW || pageW || 1280);
        const h = Math.round(pageH || 3400);

        // Cache for use in drawHeatmap (avoids offsetWidth timing issues)
        this._hmW = w;
        this._hmH = h;

        const iframe = $('heatmapIframe');
        const inner = $('heatmapInner');
        const canvas = $('heatmapCanvas');

        // All three set to identical dimensions — no CSS scaling, pure 1:1
        [iframe, canvas].forEach(el => {
            if (!el) return;
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.transform = 'none';
        });
        if (inner) {
            inner.style.width = w + 'px';
            inner.style.height = h + 'px';
        }
    }

    drawHeatmap() {
        const canvas = $('heatmapCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        const w = this._hmW || 1280;
        const h = this._hmH || 3400;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // x, y are absolute pixels — plot directly, no conversion needed
        if (this._heatmapData?.length) {
            this._heatmapData.forEach(pt => this.paintHeatmapBlob(ctx, pt.x, pt.y));
        }
    }

    // absX, absY are raw e.pageX / e.pageY values — zero percentage math
    paintHeatmapBlob(ctx, absX, absY) {
        // High-fidelity, non-manipulated plotting
        const rad = 25; // Slightly smaller for precision
        const g = ctx.createRadialGradient(absX, absY, 0, absX, absY, rad);
        g.addColorStop(0, 'rgba(244, 63, 94, 0.5)'); // More transparent
        g.addColorStop(0.5, 'rgba(245, 158, 11, 0.25)');
        g.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.beginPath();
        ctx.arc(absX, absY, rad, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
    }

    /* ── WEBSOCKET — real-time push ────────────────────── */
    connectWebSocket() {
        const connect = () => {
            console.log('[Insight-OS] Connecting WS to:', getWSUrl());
            this.ws = new WebSocket(getWSUrl());

            this.ws.onopen = () => {
                console.log('[Insight-OS] WebSocket connected successfully');
                this.setConnectionStatus(true);
            };

            this.ws.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    this.handleWSMessage(msg);
                } catch (_) { }
            };

            this.ws.onclose = () => {
                console.log('[Insight-OS] WebSocket closed, reconnecting in 3s...');
                this.setConnectionStatus(false);
                setTimeout(connect, 3000);
            };

            this.ws.onerror = (err) => {
                console.error('[Insight-OS] WebSocket error:', err);
                this.setConnectionStatus(false);
            };
        };
        connect();
    }

    handleWSMessage(msg) {
        if (msg.type === 'pageview') {
            const liveEl = $('realTimeCount');
            if (liveEl) liveEl.textContent = msg.liveCount;

            this.spawnMapBlob(msg.page);

            this.rtBins = [...this.rtBins.slice(1), this.rtBins[this.rtBins.length - 1] + 1];
            const ch = this.charts.realtime;
            if (ch) { ch.data.datasets[0].data = [...this.rtBins]; ch.update('none'); }

            this.refreshOverview();
            this.refreshSessions();
            this.refreshTraffic();
            this.refreshPages();
            this.refreshReferrers();

        } else if (msg.type === 'click') {
            if (msg.pageH) this._setHeatmapDimensions(msg.pageW, msg.pageH, msg.viewportW);

            const select = $('heatmapPageSelect');
            if (select && select.value === msg.page) {
                if (!this._heatmapData) this._heatmapData = [];
                this._heatmapData.push({ x: msg.x, y: msg.y });
                // Redraw all dots — ensures canvas buffer is properly sized
                this.drawHeatmap();
            }
        }
    }

    setConnectionStatus(connected) {
        const badge = document.querySelector('.live-badge');
        if (!badge) return;
        if (connected) {
            badge.style.opacity = '1';
        } else {
            badge.style.opacity = '0.4';
        }
    }

    /* ── LIVE MAP BLOBS ────────────────────────────────── */
    spawnMapBlob(page) {
        const container = $('mapBlobs');
        if (!container) return;
        const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b'];
        const blob = document.createElement('div');
        blob.className = 'map-blob';
        const size = 12 + Math.random() * 16;
        blob.style.cssText = `
            left: ${5 + Math.random() * 87}%;
            top:  ${5 + Math.random() * 83}%;
            width: ${size}px; height: ${size}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            opacity: 0.8;
            animation-duration: ${1.5 + Math.random() * 2}s;
        `;
        container.appendChild(blob);
        setTimeout(() => blob.remove(), 3500);
    }
}

/* ── Bootstrap ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    window.insightOS = new InsightOS();
});

function copyCollector() {
    const ta = $('collectorCode');
    if (ta) { ta.select(); document.execCommand('copy'); }
}