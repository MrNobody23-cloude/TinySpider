import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { useLivePulse } from '../../hooks/useLivePulse.js';
import { requestJson } from '../../api/client.js';

export function LivePulseMap({ siteId }) {
    const events = useLivePulse(siteId);
    const [activeUsers, setActiveUsers] = useState(0);
    const [visibleEvents, setVisibleEvents] = useState([]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const data = await requestJson(`/api/stats/live-count?site_id=${encodeURIComponent(siteId)}`);
                if (mounted) setActiveUsers(Number(data.active_users || 0));
            } catch {
                if (mounted) setActiveUsers(0);
            }
        };
        void load();
        const timer = setInterval(load, 15000); // Faster refresh for 'Live' feel
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, [siteId]);

    useEffect(() => {
        if (!events || events.length === 0) return;
        const latest = events[events.length - 1];
        
        setVisibleEvents((current) => {
            if (current.some(e => e.id === latest.id)) return current;
            return [...current, latest].slice(-20); // Keep last 20 events
        });

        const timer = setTimeout(() => {
            setVisibleEvents((current) => current.filter(e => e.id !== latest.id));
        }, 10000);

        return () => clearTimeout(timer);
    }, [events]);

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <div style={{ 
                position: 'absolute', 
                top: '1.5rem', 
                left: '1.5rem', 
                zIndex: 1000,
                backgroundColor: 'rgba(12, 12, 32, 0.8)',
                backdropFilter: 'blur(10px)',
                padding: '0.75rem 1.25rem',
                borderRadius: '1rem',
                border: '1px solid var(--outline)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
                <div style={{ 
                    width: '10px', 
                    height: '10px', 
                    backgroundColor: '#00D2D3', 
                    borderRadius: '50%',
                    boxShadow: '0 0 10px #00D2D3'
                }}></div>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--on-surface)' }}>{activeUsers}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Propagations</span>
            </div>

            <MapContainer 
                center={[20, 0]} 
                zoom={2} 
                zoomControl={false}
                attributionControl={false}
                style={{ height: '100%', width: '100%', background: '#0c0c20' }}
            >
                {/* Premium Dark Map Tiles */}
                <TileLayer 
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                />
            </MapContainer>

            {/* Custom Coordinate Overlay for Markers */}
            <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                pointerEvents: 'none',
                zIndex: 500 
            }}>
                {visibleEvents.map((event) => {
                    // Simple mercator projection approximation for visual pulse
                    const x = ((Number(event.lon) || 0) + 180) * (100 / 360);
                    const y = (90 - (Number(event.lat) || 0)) * (100 / 180);
                    
                    return (
                        <div
                            key={event.id}
                            style={{
                                position: 'absolute',
                                left: `${x}%`,
                                top: `${y}%`,
                                width: '12px',
                                height: '12px',
                                background: 'var(--primary)',
                                borderRadius: '50%',
                                boxShadow: '0 0 15px var(--primary)',
                                transform: 'translate(-50%, -50%)',
                                animation: 'neural-pulse 2s ease-out forwards'
                            }}
                        />
                    );
                })}
            </div>

            <style>{`
                @keyframes neural-pulse {
                    0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                    50% { opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
                }
                .leaflet-container {
                    filter: saturate(0.5) brightness(0.8) contrast(1.2);
                }
            `}</style>
        </div>
    );
}
