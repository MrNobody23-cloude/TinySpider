import useSWR from 'swr';

import { requestJson } from '../api/client.js';

export function useTimeseries({ siteId, from, to, interval = 'hour', referrer }) {
    const params = { site_id: siteId, from, to, interval };
    if (referrer) params.referrer = referrer;

    return useSWR(
        siteId && from && to ? ['timeseries', siteId, from, to, interval, referrer || ''] : null,
        () => requestJson(`/api/stats/timeseries?site_id=${encodeURIComponent(siteId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&interval=${encodeURIComponent(interval)}${referrer ? `&referrer=${encodeURIComponent(referrer)}` : ''}`),
        { refreshInterval: 30000 }
    );
}
