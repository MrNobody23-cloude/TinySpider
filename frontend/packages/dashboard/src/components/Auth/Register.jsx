import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore.js';

export const Register = () => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        company_name: '',
        password: '',
        confirmPassword: ''
    });
    const [passwordStrength, setPasswordStrength] = useState(0); // 0-3
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [formError, setFormError] = useState('');
    
    const { register, isLoading, error, setError } = useAuthStore();
    const navigate = useNavigate();

    // Check password strength when it changes
    useEffect(() => {
        const { password } = formData;
        let pswdScore = 0;
        if (password.length > 5) pswdScore += 1;
        if (password.length > 8) pswdScore += 1;
        if (/[A-Z]/.test(password) && /[0-9]/.test(password)) pswdScore += 1;
        setPasswordStrength(pswdScore);
    }, [formData.password]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setFormError('');
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.email || !formData.password || !formData.full_name) {
            setFormError('Please fill in all required fields');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setFormError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setFormError('Password must be at least 6 characters');
            return;
        }

        if (!termsAccepted) {
            setFormError('You must accept the Terms and Conditions');
            return;
        }

        try {
            await register({
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                company_name: formData.company_name
            });
            navigate('/');
        } catch (err) {
            // Error is handled by the store
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength === 0) return 'rgba(255,255,255,0.1)';
        if (passwordStrength === 1) return '#FF6B6B';
        if (passwordStrength === 2) return '#FDCB6E';
        return '#00B894';
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0F23', padding: '2rem 1rem', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'rgba(26, 26, 46, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '48px', height: '48px', backgroundColor: '#6C5CE7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0 0 0.5rem 0' }}>Create an Account</h1>
                    <p style={{ color: '#A0A0B8', margin: 0, fontSize: '0.9rem' }}>Join TinySpider Analytics today</p>
                </div>

                {(error || formError) && (
                    <div style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', border: '1px solid #FF6B6B', color: '#FF6B6B', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <svg style={{ flexShrink: 0, marginTop: '2px' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span>{formError || error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Full Name *</label>
                            <input 
                                type="text" 
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                placeholder="John Doe"
                                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Company</label>
                            <input 
                                type="text" 
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                placeholder="Acme Inc"
                                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Email Address *</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#A0A0B8' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <input 
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 0.75rem 0.75rem 2.5rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Password *</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#A0A0B8' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <input 
                                type="password" 
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 2.5rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                                onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '8px', height: '4px' }}>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 1 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 2 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                            <div style={{ flex: 1, backgroundColor: passwordStrength >= 3 ? getStrengthColor() : 'rgba(255,255,255,0.1)', borderRadius: '2px', transition: 'background-color 0.3s' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#A0A0B8', marginTop: '4px', textAlign: 'right' }}>
                            {passwordStrength === 0 && ' '}
                            {passwordStrength === 1 && 'Weak'}
                            {passwordStrength === 2 && 'Good'}
                            {passwordStrength === 3 && 'Strong'}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' }}>Confirm Password *</label>
                        <input 
                            type="password" 
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="••••••••"
                            style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                            onFocus={(e) => e.target.style.borderColor = '#6C5CE7'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <input 
                            type="checkbox" 
                            id="terms" 
                            checked={termsAccepted}
                            onChange={(e) => {
                                setTermsAccepted(e.target.checked);
                                if (formError === 'You must accept the Terms and Conditions') setFormError('');
                            }}
                            style={{ accentColor: '#6C5CE7', width: '16px', height: '16px', marginTop: '2px' }} 
                        />
                        <label htmlFor="terms" style={{ color: '#A0A0B8', fontSize: '0.85rem', lineHeight: '1.4' }}>
                            I agree to the <a href="#" style={{ color: '#A29BFE', textDecoration: 'none' }}>Terms of Service</a> and <a href="#" style={{ color: '#A29BFE', textDecoration: 'none' }}>Privacy Policy</a>.
                        </label>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        style={{ 
                            width: '100%', 
                            padding: '0.875rem', 
                            background: 'linear-gradient(90deg, #6C5CE7 0%, #A29BFE 100%)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontSize: '1rem', 
                            fontWeight: '600', 
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            marginTop: '0.5rem',
                            opacity: isLoading ? 0.7 : 1,
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
                                Create Account...
                            </>
                        ) : 'Create Account'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: '#A0A0B8' }}>
                    Already have an account? <Link to="/login" style={{ color: '#A29BFE', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
                </div>
            </div>
        </div>
    );
};
