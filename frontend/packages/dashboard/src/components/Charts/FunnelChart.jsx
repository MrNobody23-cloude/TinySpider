import React from 'react';

export function FunnelChart({ steps = [], onStepClick }) {
    const maxVisitors = steps[0]?.visitors || 1;

    return (
        <svg width="100%" viewBox="0 0 900 240" role="img" aria-label="Funnel chart">
            {steps.map((step, index) => {
                const width = Math.max(10, ((step.converted_to_next ?? step.visitors) / maxVisitors) * 800);
                const y = 20 + index * 60;
                const dropText = step.drop_off_rate == null ? '0%' : `${Math.round(step.drop_off_rate * 100)}%`;
                return (
                    <g key={`${step.step_url}-${index}`} data-testid="funnel-step" transform={`translate(40 ${y})`} onClick={() => onStepClick?.(step.step_url)} style={{ cursor: 'pointer' }}>
                        <rect width={width} height={34} rx="8" fill="url(#funnelGradient)" opacity="0.9" />
                        <rect width={Math.max(0, width - 40)} height={34} rx="8" fill="#1f9d55" opacity="0.85" />
                        <text x="14" y="22" fill="#fff" fontSize="13">{step.step_url} · {step.visitors} visitors · {dropText} drop-off</text>
                    </g>
                );
            })}
            <defs>
                <linearGradient id="funnelGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
            </defs>
        </svg>
    );
}
