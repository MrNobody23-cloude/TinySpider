import React, { useEffect, useRef, useState } from 'react';

import { computeKDE } from './useKDE.js';

function idle(fn) {
    if (window.requestIdleCallback) {
        window.requestIdleCallback(fn, { timeout: 500 });
        return;
    }
    setTimeout(fn, 0);
}

function drawHeatmap(canvas, points, bandwidth) {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
        return;
    }

    let ctx = null;
    try {
        ctx = canvas.getContext('2d');
    } catch {
        return;
    }
    if (!ctx) return;
    const width = canvas.width || 1;
    const height = canvas.height || 1;
    const density = computeKDE(points, width, height, bandwidth);
    const image = ctx.createImageData(width, height);

    for (let i = 0; i < density.length; i += 1) {
        const value = density[i];
        const hue = Math.round(60 * (1 - value));
        const alpha = Math.round(220 * value);
        const offset = i * 4;
        image.data[offset] = value > 0 ? 255 : 0;
        image.data[offset + 1] = value > 0 ? Math.round(255 - value * 200) : 0;
        image.data[offset + 2] = 0;
        image.data[offset + 3] = alpha;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${Math.max(0, Math.min(1, alpha / 255))})`;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(image, 0, 0);
}

export function HeatmapOverlay({ siteId, url, from, to }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [bandwidth, setBandwidth] = useState(0.05);

    const [screenshot, setScreenshot] = useState('');
    const [points, setPoints] = useState([]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const screenshotResponse = await fetch(`/api/screenshot?url=${encodeURIComponent(url)}`);
                const screenshotJson = await screenshotResponse.json();
                const heatmapResponse = await fetch(`/api/stats/heatmap?site_id=${encodeURIComponent(siteId)}&url=${encodeURIComponent(url)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
                const heatmapJson = await heatmapResponse.json();
                if (!active) return;
                setScreenshot(`data:image/png;base64,${screenshotJson.screenshot || screenshotJson.data || ''}`);
                setPoints(Array.isArray(heatmapJson) ? heatmapJson : heatmapJson.data || heatmapJson);
            } catch {
                if (!active) return;
                setScreenshot('');
                setPoints([]);
            }
        })();

        return () => {
            active = false;
        };
    }, [siteId, url, from, to]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            canvas.width = Math.max(1, Math.round(rect.width));
            canvas.height = Math.max(1, Math.round(rect.height));
        };

        resize();
        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => resize());
            observer.observe(container);
        }

        idle(() => drawHeatmap(canvas, points, bandwidth));

        return () => {
            if (observer) observer.disconnect();
        };
    }, [points, bandwidth]);

    return (
        <div>
            <label>
                Bandwidth
                <input
                    aria-label="Bandwidth"
                    type="range"
                    min="0.01"
                    max="0.2"
                    step="0.01"
                    value={bandwidth}
                    onChange={(event) => setBandwidth(Number(event.target.value))}
                />
            </label>
            <div ref={containerRef} style={{ position: 'relative' }}>
                {screenshot ? <img src={screenshot} alt="Screenshot" style={{ width: '100%', display: 'block' }} /> : <div style={{ height: 240, background: '#111' }} />}
                <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.7 }} />
            </div>
        </div>
    );
}
