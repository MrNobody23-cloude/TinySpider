import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Simple Fetcher (logic from Frontend folder)
const API = 'http://localhost:3000'; // Target TinySpider main backend

const formatNum = (n) => (n === undefined || n === null ? '—' : Number(n).toLocaleString());
const formatTime = (sec) => {
    if (!sec || sec < 1) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
};

// Components
const StatCard = ({ title, value, icon, colorGrad }) => (
    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ 
            width: '48px', height: '48px', borderRadius: '12px', 
            background: colorGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem'
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        </div>
    </div>
);

const DashboardContent = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ visitors: 0, pageviews: 0, bounceRate: 0, avgTime: 0, live: 0 });
    const [siteId, setSiteId] = useState('demo-site');
    const [heatmapPage, setHeatmapPage] = useState('/');
    const [targetDomain, setTargetDomain] = useState('http://localhost:8080');
    const [heatmapData, setHeatmapData] = useState([]);
    const [hmDimensions, setHmDimensions] = useState({ w: 1280, h: 3200, vw: 1280 });
    const heatmapCanvasRef = useRef(null);

    // Initial load and polling
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const now = new Date().toISOString();
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const res = await fetch(`${API}/api/stats/overview?site_id=${siteId}&from=${yesterday}&to=${now}`);
                const data = await res.json();
                setStats({
                    visitors: data.unique_visitors || 0,
                    pageviews: data.total_pageviews || 0,
                    bounceRate: Math.round(data.bounce_rate * 100) || 0,
                    avgTime: Math.round(data.avg_session_duration) || 0,
                    live: data.current_live_users || 0
                });
            } catch (e) { console.error('Stats fetch error:', e); }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, [siteId]); // Refresh stats when siteId changes

    useEffect(() => {
        let interval;
        if (activeTab === 'heatmaps' && targetDomain) {
            fetchHeatmap();
            interval = setInterval(fetchHeatmap, 10000);
        }
        return () => clearInterval(interval);
    }, [activeTab, targetDomain]);

    // Tab Navigation Logic
    const renderNav = () => {
        const tabs = [
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'realtime', icon: '⚡', label: 'Real-time' },
            { id: 'heatmaps', icon: '🔥', label: 'Heatmaps' },
            { id: 'funnels', icon: '🧬', label: 'Funnels' },
            { id: 'referrers', icon: '🔗', label: 'Referrers' },
        ];

        return (
            <nav style={{ 
                display: 'flex', gap: '0.5rem', background: 'var(--surface)', 
                padding: '0.4rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline)',
                marginBottom: '2.5rem'
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1, padding: '0.6rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)',
                            background: activeTab === tab.id ? 'linear-gradient(135deg, var(--primary), var(--primary-variant))' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--on-surface-variant)',
                            fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                        }}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </nav>
        );
    };

    // Heatmap Draw Logic
    useEffect(() => {
        if (activeTab === 'heatmaps' && heatmapData.length > 0 && heatmapCanvasRef.current) {
            const canvas = heatmapCanvasRef.current;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = hmDimensions.vw * dpr;
            canvas.height = hmDimensions.h * dpr;
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, hmDimensions.vw, hmDimensions.h);

            heatmapData.forEach(pt => {
                const rad = 25;
                const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
                g.addColorStop(0, 'rgba(255, 107, 107, 0.7)');
                g.addColorStop(0.5, 'rgba(255, 159, 67, 0.3)');
                g.addColorStop(1, 'rgba(255, 159, 67, 0)');
                ctx.beginPath(); ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
                ctx.fillStyle = g; ctx.fill();
            });
        }
    }, [activeTab, heatmapData, hmDimensions]);

    const fetchHeatmap = async () => {
        const now = new Date().toISOString();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`${API}/api/stats/heatmap?site_id=${siteId}&url=${encodeURIComponent(heatmapPage)}&from=${weekAgo}&to=${now}`);
        const data = await res.json();
        // data looks like { x, y, weight }
        setHeatmapData(data || []);
    };

    return (
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem' }}>
            <div className="mesh-bg" />
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>
                        Insight<span style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 700, textTransform: 'uppercase' }}>Tracking Context:</span>
                        <input 
                            value={siteId} 
                            onChange={(e) => setSiteId(e.target.value)}
                            style={{ 
                                background: 'var(--surface-high)', color: 'var(--primary)', border: '1px solid var(--primary)', 
                                padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 800, width: '120px'
                            }} 
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(29, 209, 161, 0.1)', padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid rgba(29, 209, 161, 0.2)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>{stats.live} Active Now</span>
                    </div>
                    <StatCard title="Total Visitors" value={formatNum(stats.visitors)} icon="👥" colorGrad="linear-gradient(135deg, #6C5CE7, #A29BFE)" />
                </div>
            </header>

            {renderNav()}

            <main>
                {activeTab === 'overview' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <StatCard title="Page Views" value={formatNum(stats.pageviews)} icon="📄" colorGrad="linear-gradient(135deg, #00D2D3, #00B6D4)" />
                        <StatCard title="Bounce Rate" value={`${stats.bounceRate}%`} icon="📉" colorGrad="linear-gradient(135deg, #FF6B6B, #FF4545)" />
                        <StatCard title="Avg Session" value={formatTime(stats.avgTime)} icon="⏱️" colorGrad="linear-gradient(135deg, #FF9F43, #FFB843)" />
                        <StatCard title="Neural Health" value="99.9%" icon="🧠" colorGrad="linear-gradient(135deg, #54A0FF, #00D2D3)" />
                    </div>
                )}

                {activeTab === 'heatmaps' && (
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--surface-high)', borderRadius: '16px', border: '1px solid var(--outline-variant)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Visual Click Intelligence</h2>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>Enter any domain below to overlay live click data onto the website.</p>
                                </div>
                                <button className="btn-primary" onClick={fetchHeatmap} style={{ padding: '0.8rem 2rem', fontWeight: 800 }}>Start Tracking Intelligence</button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface-highest)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--primary-container)' }}>
                                <input 
                                    type="text" 
                                    className="glass-input" 
                                    placeholder="Enter target website URL (e.g. http://localhost:8080)" 
                                    value={targetDomain}
                                    onChange={(e) => setTargetDomain(e.target.value)}
                                    style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '1rem', padding: '0.5rem 1rem' }}
                                />
                            </div>
                        </div>
                        <div style={{ background: 'rgba(108, 92, 231, 0.05)', border: '1px dashed var(--primary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem' }}>
                                💡 <strong>To track this site properly:</strong> Paste this into your website's <code>&lt;head&gt;</code>
                            </p>
                            <code style={{ fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all' }}>
                                {`<script>window.InsightConfig={siteId:'${siteId}',endpoint:'${API}/collect'}</script>`}
                                <br />
                                {`<script src="${API}/tracker.js" defer></script>`}
                            </code>
                        </div>

                        <div style={{ 
                            position: 'relative', width: '100%', height: '70vh', background: 'black', borderRadius: '12px', overflow: 'auto',
                            border: '4px solid var(--surface-highest)'
                        }}>
                            <div style={{ position: 'relative', width: `${hmDimensions.vw}px`, height: `${hmDimensions.h}px` }}>
                                <iframe 
                                    src={`${targetDomain}${heatmapPage}`} 
                                    style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none', opacity: 0.7 }}
                                    title="Heatmap View"
                                />
                                <canvas 
                                    ref={heatmapCanvasRef}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Other tabs would go here, simplified for this demo upgrade */}
                {activeTab !== 'overview' && activeTab !== 'heatmaps' && (
                    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Module Calibrating</h3>
                            <p style={{ color: 'var(--on-surface-variant)' }}>Connecting to TinySpider global neural network...</p>
                        </div>
                    </div>
                )}
            </main>

            <footer style={{ marginTop: '5rem', borderTop: '1px solid var(--outline)', padding: '2rem 0', textAlign: 'center', color: 'var(--on-surface-low)', fontSize: '0.9rem' }}>
                © 2025 TinySpider Intelligence Systems · Built with STITCH
            </footer>
        </div>
    );
};

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/*" element={<DashboardContent />} />
            </Routes>
        </BrowserRouter>
    );
}
