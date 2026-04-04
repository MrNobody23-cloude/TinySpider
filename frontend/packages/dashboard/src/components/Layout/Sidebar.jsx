import React from 'react';

const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'heatmap', label: 'Heatmaps', icon: '🔥' },
    { id: 'funnels', label: 'Funnels', icon: '📈' },
    { id: 'live', label: 'Live Pulse', icon: '🌍' }
];

export function Sidebar({ activeTab, setActiveTab }) {
    return (
        <aside style={{
            width: '280px',
            backgroundColor: 'var(--surface)',
            color: 'var(--on-surface)',
            padding: '2.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative'
        }}>
            <div style={{ marginBottom: '2.5rem', paddingLeft: '1rem' }}>
                <h1 style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 800, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    letterSpacing: '-0.02em',
                    marginBottom: '0.5rem'
                }}>
                    <span style={{ 
                        background: 'var(--gradient)', 
                        padding: '0.5rem', 
                        borderRadius: '0.75rem',
                        fontSize: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        🕷️
                    </span>
                    <span className="gradient-text">TinySpider</span>
                </h1>
                <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Intelligence Hub
                </p>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            padding: '1rem 1.25rem',
                            backgroundColor: activeTab === item.id ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                            color: activeTab === item.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                            border: activeTab === item.id ? '1px solid rgba(108, 92, 231, 0.3)' : '1px solid transparent',
                            borderRadius: '1.25rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.95rem',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontWeight: activeTab === item.id ? 700 : 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== item.id) {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                e.target.style.color = 'var(--on-surface)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== item.id) {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = 'var(--on-surface-variant)';
                            }
                        }}
                    >
                        <span style={{ fontSize: '1.1rem', opacity: activeTab === item.id ? 1 : 0.6 }}>
                            {item.icon}
                        </span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                <a 
                    href="https://github.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="glass-card"
                    style={{ 
                        color: 'var(--on-surface)', 
                        textDecoration: 'none', 
                        fontSize: '0.85rem',
                        padding: '1rem',
                        display: 'block',
                        textAlign: 'center',
                        fontWeight: 600,
                        transition: 'transform 0.2s ease',
                        border: '1px solid var(--outline)'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                    📖 View Documentation
                </a>
                
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--on-surface-variant)',
                        opacity: 0.5,
                        letterSpacing: '0.05em'
                    }}>
                        v0.2.1-PROD
                    </div>
                </div>
            </div>
        </aside>
    );
}
