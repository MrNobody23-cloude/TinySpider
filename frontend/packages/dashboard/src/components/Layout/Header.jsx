import React from 'react';

export function Header({ title = 'Insight-OS Analytics' }) {
    return (
        <header style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #ecf0f1',
            padding: '1.5rem 2rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: '0', fontSize: '1.8rem', color: '#2c3e50' }}>
                    {title}
                </h1>
                <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </header>
    );
}
