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
    
    // Normalize points if they are in 0-1 range, or assume absolute pixels
    const coords = points.map(p => ({
        x: p.click_x * width,
        y: p.click_y * height,
        weight: p.weight || 1
    }));

    const density = computeKDE(coords, width, height, bandwidth * width);
    const image = ctx.createImageData(width, height);

    for (let i = 0; i < density.length; i += 1) {
        const value = density[i];
        const offset = i * 4;
        
        // Premium Heatmap Gradient (Purple to Cyan to White)
        if (value > 0.001) {
            image.data[offset] = Math.round(108 + (255 - 108) * value);     // R
            image.data[offset + 1] = Math.round(92 + (210 - 92) * value);    // G
            image.data[offset + 2] = Math.round(231 + (255 - 231) * value);   // B
            image.data[offset + 3] = Math.round(200 * Math.pow(value, 0.5)); // Alpha with curve
        } else {
            image.data[offset + 3] = 0;
        }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(image, 0, 0);
}

export function HeatmapOverlay({ data = [], pageUrl }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [bandwidth, setBandwidth] = useState(0.05);
    const [screenshot, setScreenshot] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            if (!pageUrl) return;
            try {
                const response = await fetch(`/api/screenshot?url=${encodeURIComponent(pageUrl)}`);
                const json = await response.json();
                if (active) {
                    setScreenshot(json.screenshot ? `data:image/png;base64,${json.screenshot}` : '');
                }
            } catch {
                if (active) setScreenshot('');
            }
        })();
        return () => { active = false; };
    }, [pageUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            canvas.width = Math.max(1, Math.round(rect.width));
            canvas.height = Math.max(1, Math.round(rect.height));
            draw();
        };

        const draw = () => {
            if (data && data.length > 0) {
                idle(() => drawHeatmap(canvas, data, bandwidth));
            } else {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };

        resize();
        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => resize());
            observer.observe(container);
        }

        draw();

        return () => {
            if (observer) observer.disconnect();
        };
    }, [data, bandwidth]);

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <div style={{ 
                position: 'absolute', 
                top: '1rem', 
                right: '1rem', 
                zIndex: 20,
                backgroundColor: 'var(--surface-highest)',
                padding: '0.75rem 1.25rem',
                borderRadius: '1rem',
                border: '1px solid var(--outline)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bandwidth</span>
                <input
                    type="range"
                    min="0.01"
                    max="0.2"
                    step="0.01"
                    value={bandwidth}
                    onChange={(e) => setBandwidth(Number(e.target.value))}
                    style={{
                        appearance: 'none',
                        background: 'rgba(255,255,255,0.1)',
                        height: '4px',
                        borderRadius: '2px',
                        width: '100px',
                        accentColor: 'var(--primary)'
                    }}
                />
            </div>

            <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: '400px', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {screenshot ? (
                    <img 
                        src={screenshot} 
                        alt="Target Page Preview" 
                        style={{ width: '100%', display: 'block', opacity: 0.8 }} 
                    />
                ) : (
                    <div style={{ 
                        height: '600px', 
                        width: '100%', 
                        background: 'radial-gradient(circle at center, var(--surface-low) 0%, #000 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        color: 'var(--on-surface-variant)'
                    }}>
                        <div style={{ fontSize: '2rem' }}>🖼️</div>
                        <p style={{ fontWeight: 600 }}>Capturing page surface...</p>
                    </div>
                )}
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        pointerEvents: 'none'
                    }} 
                />
            </div>
            {!data || data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
                    No click intelligence data detected for this URL yet.
                </div>
            ) : null}
        </div>
    );
}
