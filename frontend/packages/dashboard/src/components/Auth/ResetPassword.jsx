import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth.js';

export const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const navigate = useNavigate();

    // Check token presence on mount
    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token. Please request a new password reset link.');
        }
    }, [token]);

    // Check password strength when it changes
    useEffect(() => {
        let pswdScore = 0;
        if (password.length > 5) pswdScore += 1;
        if (password.length > 8) pswdScore += 1;
        if (/[A-Z]/.test(password) && /[0-9]/.test(password)) pswdScore += 1;
        setPasswordStrength(pswdScore);
    }, [password]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!token) {
            setError('Invalid token. Cannot verify password reset.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await authApi.resetPassword(token, password);
            navigate('/login', { state: { message: 'Password reset successful. Please sign in with your new password.' } });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. The link might be expired.');
        } finally {
            setIsLoading(false);
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength === 0) return 'rgba(255,255,255,0.1)';
        if (passwordStrength === 1) return '#FF6B6B';
        if (passwordStrength === 2) return '#FDCB6E';
        return '#00B894';
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F23', padding: '1rem', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'rgba(26, 26, 46, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(108, 92, 231, 0.1)', border: '1px solid rgba(108, 92, 231, 0.3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#6C5CE7' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>Create New Password</h1>
                    <p style={{ color: '#A0A0B8', margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                        Please enter your new password below.
                    </p>
                </div>

                {error && (
                    <div style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', border: '1px solid #FF6B6B', color: '#FF6B6B', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <svg style={{ flexShrink: 0, marginTop: '2px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>New Password</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="••••••••"
                            style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            required
                            disabled={!token}
                        />
                        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', height: '4px' }}>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 1 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 2 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 3 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Confirm New Password</label>
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="••••••••"
                            style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            required
                            disabled={!token}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading || !token}
                        style={{ 
                            width: '100%', 
                            padding: '0.875rem', 
                            background: 'linear-gradient(90deg, #6C5CE7 0%, #A29BFE 100%)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontSize: '1rem', 
                            fontWeight: '600', 
                            cursor: (isLoading || !token) ? 'not-allowed' : 'pointer',
                            marginTop: '0.5rem',
                            opacity: (isLoading || !token) ? 0.7 : 1,
                            transition: 'opacity 0.2s',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {isLoading ? (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                Resetting...
                            </>
                        ) : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};
