import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore.js';

export const ProtectedRoute = () => {
    const { isAuthenticated, isInitialized, init } = useAuthStore();
    const location = useLocation();

    useEffect(() => {
        if (!isInitialized) {
            init();
        }
    }, [isInitialized, init]);

    if (!isInitialized) {
        return (
            <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F23', color: 'white' }}>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(108, 92, 231, 0.3)', borderTopColor: '#6C5CE7', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p>Loading Insight-OS...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};
