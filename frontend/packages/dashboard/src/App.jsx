import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Dashboard & Metrics
import { useTimeseries } from './hooks/useTimeseries.js';
import { useFunnel } from './hooks/useFunnel.js';
import { useHeatmap } from './hooks/useHeatmap.js';
import { useLivePulse } from './hooks/useLivePulse.js';

import { BotToggle } from './components/BotToggle.jsx';
import { Header } from './components/Layout/Header.jsx';
import { Sidebar } from './components/Layout/Sidebar.jsx';
import { TimeseriesChart } from './components/Charts/TimeseriesChart.jsx';
import { ReferrersChart } from './components/Charts/ReferrersChart.jsx';
import { FunnelChart } from './components/Charts/FunnelChart.jsx';
import { HeatmapOverlay } from './components/Heatmap/HeatmapOverlay.jsx';
import { LivePulseMap } from './components/LiveMap/LivePulseMap.jsx';

// Auth Components
import { Login } from './components/Auth/Login.jsx';
import { Register } from './components/Auth/Register.jsx';
import { ForgotPassword } from './components/Auth/ForgotPassword.jsx';
import { ResetPassword } from './components/Auth/ResetPassword.jsx';
import { Profile } from './components/Auth/Profile.jsx';
import { ProtectedRoute } from './components/Auth/ProtectedRoute.jsx';

const DEMO_SITE_ID = 'demo-site';

const DashboardContent = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [includeBots, setIncludeBots] = useState(false);
    const [selectedPage, setSelectedPage] = useState('/');

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: timeseriesData } = useTimeseries({
        siteId: DEMO_SITE_ID,
        from: last24h.toISOString(),
        to: now.toISOString(),
        interval: 'hour'
    });

    const { data: heatmapData } = useHeatmap({
        siteId: DEMO_SITE_ID,
        url: selectedPage
    });

    const { data: livePulseData } = useLivePulse({
        siteId: DEMO_SITE_ID
    });

    // Content based on active tab
    const renderContent = () => {
        if (activeTab === 'profile') {
            return <Profile />;
        }

        return (
            <div style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <BotToggle includeBots={includeBots} onChange={setIncludeBots} />
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                        Site ID: <code>{DEMO_SITE_ID}</code>
                    </span>
                </div>

                {activeTab === 'overview' && (
                    <div>
                        <h2>Traffic Overview (Last 24 Hours)</h2>
                        <div style={{ 
                            backgroundColor: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '8px', 
                            marginBottom: '2rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            {timeseriesData ? (
                                <TimeseriesChart data={timeseriesData} />
                            ) : (
                                <p>Loading traffic data...</p>
                            )}
                        </div>

                        <h2>Top Referrers</h2>
                        <div style={{ 
                            backgroundColor: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <ReferrersChart siteId={DEMO_SITE_ID} />
                        </div>
                    </div>
                )}

                {activeTab === 'heatmap' && (
                    <div>
                        <h2>Click Heatmap</h2>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>
                                Page URL:{' '}
                                <input
                                    type="text"
                                    value={selectedPage}
                                    onChange={(e) => setSelectedPage(e.target.value)}
                                    style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
                                    placeholder="/path/to/page"
                                />
                            </label>
                        </div>
                        <div style={{ 
                            backgroundColor: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            {heatmapData ? (
                                <HeatmapOverlay data={heatmapData} pageUrl={selectedPage} />
                            ) : (
                                <p>Loading heatmap data...</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'funnels' && (
                    <div>
                        <h2>Funnel Analysis</h2>
                        <div style={{ 
                            backgroundColor: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <FunnelChart siteId={DEMO_SITE_ID} />
                        </div>
                    </div>
                )}

                {activeTab === 'live' && (
                    <div>
                        <h2>Live User Activity</h2>
                        <div style={{ 
                            backgroundColor: 'white', 
                            padding: '1.5rem', 
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            height: '500px'
                        }}>
                            {livePulseData ? (
                                <LivePulseMap data={livePulseData} siteId={DEMO_SITE_ID} />
                            ) : (
                                <p>Loading live data...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ 
            display: 'flex', 
            height: '100vh', 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#f5f5f5'
        }}>
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <Header title={activeTab === 'profile' ? "Account Settings" : "Insight-OS Analytics Dashboard"} />
                {renderContent()}
            </div>
        </div>
    );
};

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected Dashboard Route */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/*" element={<DashboardContent />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
