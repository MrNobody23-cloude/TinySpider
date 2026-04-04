import useSWR from 'swr';
import { requestJson } from '../api/client.js';

export function useReferrers({ siteId, from, to, limit = 10 }) {
    return useSWR(
        siteId && from && to ? ['referrers', siteId, from, to, limit] : null,
        () => requestJson(`/api/stats/referrers?site_id=${encodeURIComponent(siteId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`),
        { refreshInterval: 60000 }
    );
}
