import { format, parseISO } from 'date-fns';
import React from 'react';
import { 
    Line, 
    LineChart, 
    ResponsiveContainer, 
    Tooltip, 
    XAxis, 
    YAxis, 
    Area, 
    AreaChart 
} from 'recharts';

export function TimeseriesChart({ data = [] }) {
    // Ensure data is sorted by time and dates are parsed
    const processedData = React.useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return [...data].map(d => ({
            ...d,
            timeLabel: d.bucket ? format(parseISO(d.bucket), 'HH:mm') : format(new Date(d.time), 'HH:mm'),
            fullDate: d.bucket ? format(parseISO(d.bucket), 'MMM d HH:mm') : format(new Date(d.time), 'MMM d HH:mm'),
            pageviews: Number(d.pageviews || 0),
            sessions: Number(d.sessions || 0)
        })).sort((a,b) => a.bucket?.localeCompare(b.bucket));
    }, [data]);

    if (processedData.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-surface-variant)' }}>
                No traffic data for selected period.
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={processedData}>
                <defs>
                    <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                
                {/* Clean axis without grid as per Obsidian Lens rule */}
                <XAxis 
                    dataKey="timeLabel" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--on-surface-variant)', fontSize: 12, fontWeight: 600 }}
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--on-surface-variant)', fontSize: 12, fontWeight: 600 }}
                    dx={-10}
                />
                
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'var(--surface-highest)', 
                        border: '1px solid var(--outline)', 
                        borderRadius: 'var(--radius-md)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        padding: '1.25rem'
                    }}
                    itemStyle={{ fontSize: '0.9rem', fontWeight: 700, margin: '4px 0' }}
                    labelStyle={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                />
                
                {/* Glow effects via Area shading */}
                <Area 
                    type="monotone" 
                    dataKey="pageviews" 
                    stroke="var(--primary)" 
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorPageviews)"
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--primary)', filter: 'drop-shadow(0 0 8px var(--primary))' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="sessions" 
                    stroke="var(--secondary)" 
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSessions)"
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--secondary)', filter: 'drop-shadow(0 0 8px var(--secondary))' }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
