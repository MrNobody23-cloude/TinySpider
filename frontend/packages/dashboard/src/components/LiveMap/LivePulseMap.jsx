import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

import { simulateWSMessage, useLivePulse } from '../../hooks/useLivePulse.js';
import { requestJson } from '../../api/client.js';

export { simulateWSMessage };

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
        const timer = setInterval(load, 30000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, [siteId]);

    useEffect(() => {
        const latest = events[events.length - 1];
        if (!latest) return;

        setVisibleEvents((current) => (current.some((item) => item.id === latest.id) ? current : [...current, latest]));
        const timer = setTimeout(() => {
            setVisibleEvents((current) => current.filter((item) => item.id !== latest.id));
        }, 30000);

        return () => clearTimeout(timer);
    }, [events]);

    return (
        <div>
            <div aria-live="polite">{activeUsers} users active in last 5 min</div>
            <div style={{ position: 'relative', minHeight: 320 }}>
                <MapContainer center={[20, 0]} zoom={2} style={{ height: 320, width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </MapContainer>
                {visibleEvents.map((event) => (
                    <div
                        key={event.id}
                        data-event-id={event.id}
                        className="pulse-marker"
                        style={{
                            position: 'absolute',
                            left: `${50 + (Number(event.lon) || 0)}%`,
                            top: `${50 - (Number(event.lat) || 0)}%`,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: 'rgba(248, 113, 113, 0.85)',
                            boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.5)',
                            animation: 'pulse 1.5s ease-out infinite'
                        }}
                    />
                ))}
            </div>
            <style>{`@keyframes pulse { from { transform: scale(1); opacity: 1; } to { transform: scale(2); opacity: 0; } }`}</style>
        </div>
    );
}
