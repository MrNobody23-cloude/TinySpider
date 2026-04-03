import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
    return (
        <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
            <h1>Insight-OS Dashboard</h1>
            <p>Phase 1 scaffold complete.</p>
        </main>
    );
}

createRoot(document.getElementById('root')).render(<App />);
