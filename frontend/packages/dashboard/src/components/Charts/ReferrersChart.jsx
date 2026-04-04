import React from 'react';
import { 
    Bar, 
    BarChart, 
    ResponsiveContainer, 
    Tooltip, 
    XAxis, 
    YAxis,
    Cell
} from 'recharts';

function truncateReferrer(value) {
    if (!value || value === 'direct') return 'Direct Traffic';
    try {
        const url = new URL(value);
        return url.hostname;
    } catch {
        return value.length > 30 ? `${value.slice(0, 27)}...` : value;
    }
}

export function ReferrersChart({ data = [], onSelect }) {
    const processedData = React.useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return [...data].sort((a,b) => (b.hits || 0) - (a.hits || 0)).slice(0, 10);
    }, [data]);

    if (processedData.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
                No referrer intelligence found...
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <BarChart 
                data={processedData} 
                layout="vertical" 
                margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
                barSize={24}
            >
                {/* Clean Ghost Axes */}
                <XAxis type="number" hide />
                <YAxis 
                    dataKey="referrer" 
                    type="category" 
                    width={150} 
                    tickFormatter={truncateReferrer} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--on-surface)', fontSize: 12, fontWeight: 700 }}
                />
                
                <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={{ 
                        backgroundColor: 'var(--surface-highest)', 
                        border: '1px solid var(--outline)', 
                        borderRadius: 'var(--radius-md)',
                        backdropFilter: 'blur(20px)',
                        padding: '1rem'
                    }}
                    labelStyle={{ color: 'var(--primary)', fontWeight: 800, marginBottom: '4px' }}
                    itemStyle={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: '0.85rem' }}
                    labelFormatter={(val) => truncateReferrer(val)}
                />

                <Bar 
                    dataKey="hits" 
                    radius={[0, 12, 12, 0]}
                    onClick={(entry) => onSelect?.(entry?.referrer)}
                    style={{ cursor: 'pointer' }}
                >
                    {processedData.map((entry, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? 'var(--primary)' : 'var(--surface-high)'}
                            fillOpacity={1 - (index * 0.08)}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
