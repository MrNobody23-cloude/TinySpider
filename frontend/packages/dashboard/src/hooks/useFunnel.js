import useSWR from 'swr';

import { requestJson } from '../api/client.js';

export function useFunnel({ funnelId, from, to }) {
    return useSWR(
        funnelId && from && to ? ['funnel', funnelId, from, to] : null,
        () => requestJson(`/api/funnels/${encodeURIComponent(funnelId)}/analysis?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        { refreshInterval: 30000 }
    );
}
