import { useEffect, useState } from 'react';

const listeners = new Set();

export function simulateWSMessage(message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    for (const listener of listeners) {
        listener(payload);
    }
}

export function useLivePulse(siteId) {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const onMessage = (raw) => {
            const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (siteId && payload.site_id !== siteId) return;
            setEvents((current) => [...current, { ...payload, id: crypto.randomUUID() }]);
        };

        listeners.add(onMessage);
        return () => {
            listeners.delete(onMessage);
        };
    }, [siteId]);

    return events;
}
