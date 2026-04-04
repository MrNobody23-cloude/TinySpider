import React from 'react';

const navItems = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'heatmap', label: '🔥 Heatmap', icon: '🔥' },
    { id: 'funnels', label: '📈 Funnels', icon: '📈' },
    { id: 'live', label: '🌍 Live Map', icon: '🌍' }
];

export function Sidebar({ activeTab, setActiveTab }) {
    return (
        <aside style={{
            width: '200px',
            backgroundColor: '#2c3e50',
            color: 'white',
            padding: '1.5rem',
            borderRight: '1px solid #ecf0f1',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
        }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ marginBottom: '0.5rem', fontSize: '1.3rem' }}>
                    🎯 Insight-OS
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#bdc3c7', margin: '0' }}>
                    Analytics Platform
                </p>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: activeTab === item.id ? '#3498db' : 'transparent',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '0.95rem',
                            transition: 'background-color 0.2s',
                            fontWeight: activeTab === item.id ? 'bold' : 'normal'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== item.id) {
                                e.target.style.backgroundColor = '#34495e';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== item.id) {
                                e.target.style.backgroundColor = 'transparent';
                            }
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', borderTop: '1px solid #34495e', paddingTop: '1rem' }}>
                <a 
                    href="https://github.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#3498db', textDecoration: 'none', fontSize: '0.9rem' }}
                >
                    📖 Documentation
                </a>
                <div style={{ marginTop: '1rem' }}>
                    <button
                        onClick={() => setActiveTab('profile')}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: activeTab === 'profile' ? '#34495e' : 'transparent',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontWeight: activeTab === 'profile' ? 'bold' : 'normal'
                        }}
                    >
                        Account Settings
                    </button>
                </div>
            </div>
        </aside>
    );
}
