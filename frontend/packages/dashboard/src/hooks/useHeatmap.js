import useSWR from 'swr';

import { requestJson } from '../api/client.js';

export function useHeatmap({ siteId, url, from, to }) {
    return useSWR(
        siteId && url && from && to ? ['heatmap', siteId, url, from, to] : null,
        () => requestJson(`/api/stats/heatmap?site_id=${encodeURIComponent(siteId)}&url=${encodeURIComponent(url)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        { refreshInterval: 30000 }
    );
}
