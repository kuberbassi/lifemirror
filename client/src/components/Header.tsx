import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const Header: React.FC = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header className="top-bar">
            <div className="date-time">
                <span id="current-time" style={{ fontWeight: 600, marginRight: '16px', color: 'var(--c-text-dark)' }}>
                    {format(currentTime, 'HH:mm')}
                </span>
                <span>{format(currentTime, 'EEEE, d MMMM yyyy')}</span>
            </div>
            <div className="global-controls">
                <div className="control-icon-wrapper" onClick={() => logout()} title="Logout">
                    <Icon.LogOut />
                </div>
                <div className="control-icon-wrapper">
                    <Icon.Bell />
                </div>
                {isAuthenticated && user?.picture ? (
                    <img src={user.picture} alt={user.name} className="profile-pic" />
                ) : (
                    <div className="profile-pic" style={{ display: 'grid', placeItems: 'center', background: 'var(--c-primary)', color: 'white' }}>
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
