import { format } from 'date-fns';
import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export function TimeseriesChart({ data = [] }) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={(value) => format(new Date(value), 'MMM d HH:mm')} />
                <YAxis />
                <Tooltip labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd HH:mm')} />
                <Line type="monotone" dataKey="pageviews" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessions" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}
