import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import * as Icon from 'react-feather';

const Login: React.FC = () => {
    const { isAuthenticated, setLoginSuccess } = useAuth();

    if (isAuthenticated) {
        return <Navigate to="/" />;
    }

    const onSuccess = (credentialResponse: CredentialResponse) => {
        if (credentialResponse.credential) {
            setLoginSuccess(credentialResponse.credential);
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-bg-main)',
            flexDirection: 'column',
            gap: '20px'
        }}>
            <div style={{
                background: 'var(--c-bg-card)',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                textAlign: 'center',
                maxWidth: '400px',
                width: '100%'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'var(--c-primary)',
                    borderRadius: '16px',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 24px auto',
                    color: 'white'
                }}>
                    <Icon.Feather size={32} />
                </div>

                <h1 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>Welcome Back</h1>
                <p style={{ margin: '0 0 32px 0', color: 'var(--c-text-muted)' }}>
                    Sign in to manage your entire life in one place.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={onSuccess}
                        onError={() => {
                            console.log('Login Failed');
                        }}
                        useOneTap
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
