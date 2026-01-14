import React from 'react';
import * as Icon from 'react-feather';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <div className="page-grid">
            <div className="card" style={{ gridColumn: 'span 2' }}>
                <h3><Icon.User size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} /> Profile Information</h3>

                <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px', gap: '20px' }}>
                    {user?.picture && <img src={user.picture} alt={user.name} style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid var(--c-primary)' }} />}
                    <div>
                        <h4 style={{ margin: 0, fontSize: '20px' }}>{user?.name}</h4>
                        <p style={{ margin: '5px 0', color: '#999' }}>{user?.email}</p>
                    </div>
                </div>

                <div className="modal-form-group" style={{ marginTop: '30px' }}>
                    <label>Display Name</label>
                    <input type="text" value={user?.name || ''} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>Managed by Google Account</p>
                </div>

                <div className="modal-form-group">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                </div>
            </div>

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Quick Stats</h3> <Icon.BarChart2 />
                </div>
                <p className="kpi-value">7</p>
                <p className="kpi-label">Days Active</p>
            </div>

            <div className="card" style={{ gridColumn: 'span 3' }}>
                <h3><Icon.Settings size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} /> Preferences</h3>

                <div className="modal-form-group" style={{ marginTop: '20px' }}>
                    <label>Theme</label>
                    <select disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }}>
                        <option>Light Mode</option>
                        <option>Dark Mode (Coming Soon)</option>
                    </select>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>Dark mode will be available in a future update.</p>
                </div>

                <div className="modal-form-group">
                    <label>Default Dashboard View</label>
                    <select disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }}>
                        <option>Overview (Current)</option>
                        <option>Tasks</option>
                        <option>Finance</option>
                    </select>
                </div>
            </div>

            <div className="card" style={{ gridColumn: 'span 3', border: '2px solid var(--c-accent-red)' }}>
                <h3 style={{ color: 'var(--c-accent-red)' }}><Icon.AlertTriangle size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} /> Danger Zone</h3>

                <div style={{ marginTop: '20px', padding: '20px', background: '#fff5f5', borderRadius: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--c-accent-red)' }}>Logout</h4>
                    <p style={{ margin: '10px 0', fontSize: '14px', color: '#555' }}>Sign out of your account.</p>
                    <button className="modal-button warning" onClick={logout}>
                        <Icon.LogOut size={16} style={{ marginRight: '8px' }} /> Logout
                    </button>
                </div>

                <div style={{ marginTop: '20px', padding: '20px', background: '#fff5f5', borderRadius: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--c-accent-red)' }}>Delete Account</h4>
                    <p style={{ margin: '10px 0', fontSize: '14px', color: '#555' }}>
                        Permanently delete your LifeMirror account and all associated data. This action cannot be undone.
                    </p>
                    <button
                        className="modal-button delete"
                        onClick={() => alert('Account deletion is not yet implemented. Please contact support.')}
                    >
                        <Icon.Trash2 size={16} style={{ marginRight: '8px' }} /> Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
