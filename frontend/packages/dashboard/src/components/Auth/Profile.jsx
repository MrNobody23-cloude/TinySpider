import React, { useState } from 'react';
import { useAuthStore } from '../../hooks/useAuthStore.js';
import { authApi } from '../../api/auth.js';

export const Profile = () => {
    const { user, updateProfile, logout } = useAuthStore();
    
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        company_name: user?.company_name || ''
    });
    
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    const [status, setStatus] = useState({ type: '', message: '' }); // 'success' or 'error'
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await updateProfile(formData);
            setStatus({ type: 'success', message: 'Profile updated successfully' });
            setIsEditing(false);
        } catch (err) {
            setStatus({ type: 'error', message: err.message || 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (passwordData.new_password !== passwordData.confirm_password) {
            setStatus({ type: 'error', message: 'New passwords do not match' });
            return;
        }

        if (passwordData.new_password.length < 6) {
            setStatus({ type: 'error', message: 'New password must be at least 6 characters' });
            return;
        }

        setIsLoading(true);
        try {
            await authApi.changePassword({
                current_password: passwordData.current_password,
                new_password: passwordData.new_password
            });
            setStatus({ type: 'success', message: 'Password changed successfully' });
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to change password' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsLoading(true);
        try {
            await authApi.deleteAccount();
            logout(); // Store logic will wipe token and unauth the session
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to delete account' });
            setIsLoading(false);
            setIsDeleteModalOpen(false);
        }
    };

    const inputStyle = { width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', marginBottom: '0.5rem', color: '#A0A0B8', fontSize: '0.85rem', fontWeight: '500' };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: '700' }}>Account Settings</h1>
                <button onClick={logout} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0A0B8', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}>
                    Sign Out
                </button>
            </div>

            {status.message && (
                <div style={{ backgroundColor: status.type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 184, 148, 0.1)', border: `1px solid ${status.type === 'error' ? '#FF6B6B' : '#00B894'}`, color: status.type === 'error' ? '#FF6B6B' : '#00B894', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {status.type === 'error' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    )}
                    <span>{status.message}</span>
                </div>
            )}

            <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem', color: '#1A1A2E' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '600' }}>Profile Information</h2>
                    <button onClick={() => setIsEditing(!isEditing)} style={{ background: 'none', border: 'none', color: '#6C5CE7', fontWeight: '500', cursor: 'pointer', padding: 0 }}>
                        {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                    </button>
                </div>
                
                <div style={{ padding: '2rem' }}>
                    {isEditing ? (
                        <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ ...labelStyle, color: '#4A5568' }}>Full Name</label>
                                    <input 
                                        type="text" 
                                        value={formData.full_name} 
                                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                        style={{ ...inputStyle, color: '#1A1A2E', backgroundColor: '#F8F9FA', borderColor: '#E2E8F0' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ ...labelStyle, color: '#4A5568' }}>Company</label>
                                    <input 
                                        type="text" 
                                        value={formData.company_name} 
                                        onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                                        style={{ ...inputStyle, color: '#1A1A2E', backgroundColor: '#F8F9FA', borderColor: '#E2E8F0' }} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ ...labelStyle, color: '#4A5568' }}>Email Address</label>
                                <input 
                                    type="email" 
                                    value={user?.email || ''} 
                                    style={{ ...inputStyle, color: '#A0A0B8', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', cursor: 'not-allowed' }} 
                                    disabled 
                                />
                                <span style={{ fontSize: '0.8rem', color: '#718096', display: 'block', marginTop: '0.25rem' }}>Email cannot be changed</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6C5CE7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(108, 92, 231, 0.1)', color: '#6C5CE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: '700' }}>
                                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem 0', fontWeight: '600' }}>{user?.full_name || 'Anonymous User'}</h3>
                                    <p style={{ margin: 0, color: '#718096' }}>{user?.company_name || 'Personal Account'}</p>
                                </div>
                            </div>
                            <div style={{ padding: '1.5rem', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.85rem', color: '#718096', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Email</span>
                                        <span style={{ fontWeight: '500' }}>{user?.email}</span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.85rem', color: '#718096', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }}>Account Created</span>
                                        <span style={{ fontWeight: '500' }}>{new Date(user?.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem', color: '#1A1A2E' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '600' }}>Change Password</h2>
                </div>
                <div style={{ padding: '2rem' }}>
                    <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ ...labelStyle, color: '#4A5568' }}>Current Password</label>
                            <input 
                                type="password" 
                                value={passwordData.current_password} 
                                onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                                style={{ ...inputStyle, color: '#1A1A2E', backgroundColor: '#F8F9FA', borderColor: '#E2E8F0' }} 
                                required
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: '#4A5568' }}>New Password</label>
                            <input 
                                type="password" 
                                value={passwordData.new_password} 
                                onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                                style={{ ...inputStyle, color: '#1A1A2E', backgroundColor: '#F8F9FA', borderColor: '#E2E8F0' }} 
                                required
                            />
                        </div>
                        <div>
                            <label style={{ ...labelStyle, color: '#4A5568' }}>Confirm New Password</label>
                            <input 
                                type="password" 
                                value={passwordData.confirm_password} 
                                onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                                style={{ ...inputStyle, color: '#1A1A2E', backgroundColor: '#F8F9FA', borderColor: '#E2E8F0' }} 
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                            <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1A1A2E', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}>
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: '#1A1A2E' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #E2E8F0' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '600', color: '#E53E3E' }}>Danger Zone</h2>
                </div>
                <div style={{ padding: '2rem' }}>
                    <p style={{ margin: '0 0 1.5rem 0', color: '#718096', lineHeight: '1.5' }}>
                        Once you delete your account, there is no going back. All of your data along with associated sites and analytics data will be permanently disabled or removed. Please be certain.
                    </p>
                    <button 
                        onClick={() => setIsDeleteModalOpen(true)}
                        style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', border: '1px solid #FC8181', color: '#E53E3E', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseOver={(e) => { e.target.style.backgroundColor = '#FFF5F5'; }}
                        onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                    >
                        Delete Account
                    </button>
                </div>
            </div>

            {isDeleteModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 15, 35, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1A1A2E', margin: '0 0 1rem 0' }}>Delete Account?</h3>
                        <p style={{ color: '#4A5568', margin: '0 0 2rem 0', lineHeight: 1.5 }}>
                            Are you absolutely sure you want to delete your account? This action cannot be undone and you will lose access to all your analytics data instantly.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid #E2E8F0', borderRadius: '6px', color: '#4A5568', fontWeight: '500', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={isLoading}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#E53E3E', border: 'none', borderRadius: '6px', color: 'white', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
                            >
                                {isLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
