import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function truncateReferrer(value) {
    if (!value) return '(direct)';
    return value.length > 30 ? `${value.slice(0, 27)}...` : value;
}

export function ReferrersChart({ data = [], onSelect }) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="referrer" type="category" width={180} tickFormatter={truncateReferrer} />
                <Tooltip />
                <Bar dataKey="hits" fill="#38bdf8" onClick={(entry) => onSelect?.(entry?.referrer)} />
            </BarChart>
        </ResponsiveContainer>
    );
}
