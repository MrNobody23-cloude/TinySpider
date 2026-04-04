import React from 'react';

export function BotToggle({ includeBots, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={includeBots}
                    onChange={(e) => onChange(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.95rem', color: '#333' }}>
                    {includeBots ? '🤖 Including bot traffic' : '🚫 Excluding bots'}
                </span>
            </label>
        </div>
    );
}
