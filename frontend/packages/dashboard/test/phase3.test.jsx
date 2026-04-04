import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { HeatmapOverlay } from '../src/components/Heatmap/HeatmapOverlay.jsx';
import { computeKDE } from '../src/components/Heatmap/useKDE.js';
import { FunnelChart } from '../src/components/Charts/FunnelChart.jsx';
import { BotToggle } from '../src/components/BotToggle.jsx';
import { LivePulseMap, simulateWSMessage } from '../src/components/LiveMap/LivePulseMap.jsx';

beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async (url) => {
        if (String(url).includes('/api/screenshot')) {
            return {
                ok: true,
                json: async () => ({ screenshot: 'ZmFrZQ==' })
            };
        }
        if (String(url).includes('/api/stats/heatmap')) {
            return {
                ok: true,
                json: async () => ([{ x: 0.4, y: 0.4, weight: 5 }])
            };
        }
        if (String(url).includes('/api/stats/live-count')) {
            return {
                ok: true,
                json: async () => ({ active_users: 1 })
            };
        }
        return {
            ok: true,
            json: async () => []
        };
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('Phase 3 smoke', () => {
    test('HeatmapOverlay renders a canvas element', () => {
        render(<HeatmapOverlay siteId="test" url="https://example.com" from="2024-01-01" to="2024-01-02" />);
        expect(document.querySelector('canvas')).toBeTruthy();
    });

    test('useKDE returns density values between 0 and 1', () => {
        const points = [{ x: 0.5, y: 0.5, weight: 10 }, { x: 0.2, y: 0.3, weight: 5 }];
        const grid = computeKDE(points, 10, 10, 0.05);
        grid.forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });
    });

    test('FunnelChart renders correct number of steps', () => {
        const steps = [
            { step_url: '/', visitors: 1000, converted_to_next: 600, drop_off_rate: 0.4 },
            { step_url: '/pricing', visitors: 600, converted_to_next: 200, drop_off_rate: 0.67 },
            { step_url: '/checkout', visitors: 200, converted_to_next: null, drop_off_rate: null }
        ];
        render(<FunnelChart steps={steps} />);
        expect(document.querySelectorAll('[data-testid="funnel-step"]').length).toBe(3);
    });

    test('BotToggle adds include_bots=true to API calls when enabled', async () => {
        const { getByRole } = render(<BotToggle />);
        fireEvent.click(getByRole('switch'));
        await waitFor(() => {
            expect(global.fetch.mock.calls.some((call) => String(call[0]).includes('include_bots=true'))).toBe(true);
        });
    });

    test('LivePulseMap removes markers after 30 seconds', async () => {
        vi.useFakeTimers();
        render(<LivePulseMap siteId="test" />);
        act(() => simulateWSMessage({ lat: 40.7, lon: -74.0, site_id: 'test' }));
        expect(document.querySelectorAll('.pulse-marker').length).toBe(1);
        act(() => vi.advanceTimersByTime(31000));
        expect(document.querySelectorAll('.pulse-marker').length).toBe(0);
    });
});
