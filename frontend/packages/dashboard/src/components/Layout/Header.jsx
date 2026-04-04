import React from 'react';

export function Header({ title }) {
    return (
        <header style={{
            padding: '2.5rem 2.5rem 1rem 2.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'transparent',
            zIndex: 10
        }}>
            <div>
                <h2 style={{ 
                    fontSize: '2.25rem', 
                    fontWeight: 900, 
                    color: 'var(--on-surface)',
                    letterSpacing: '-0.05em',
                    lineHeight: '1.2'
                }}>
                    {title}
                </h2>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    marginTop: '0.75rem'
                }}>
                    <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        color: 'var(--on-surface-variant)',
                        fontWeight: 600,
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--outline)'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#00D2D3',
                            boxShadow: '0 0 10px rgba(0, 210, 211, 0.5)'
                        }}></span>
                        Connected to Cloud API
                    </span>
                    <span style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--on-surface-variant)',
                        fontWeight: 600,
                        padding: '0.35rem 0.75rem'
                    }}>
                        Region: <span style={{ color: 'var(--on-surface)' }}>us-east-1</span>
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button 
                    className="btn-ghost"
                    style={{ 
                        borderRadius: '1.25rem', 
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: '1px solid var(--outline)'
                    }}
                >
                    Refresh
                </button>
                <button 
                    className="btn-primary"
                    style={{ 
                        boxShadow: '0 0 20px rgba(108, 92, 231, 0.3)',
                        fontSize: '0.9rem',
                        fontWeight: 700
                    }}
                >
                    Export Insights
                </button>
            </div>
        </header>
    );
}
