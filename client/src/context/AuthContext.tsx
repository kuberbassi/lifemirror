import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

interface User {
    name: string;
    email: string;
    picture: string;
    sub: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
    setLoginSuccess: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Internal component to manage state, nested inside GoogleOAuthProvider
const AuthStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('google_id_token');
        if (storedToken) {
            try {
                const decoded: any = jwtDecode(storedToken);
                // Simple expiry check (exp is in seconds)
                if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                    throw new Error("Token expired");
                }
                setUser({
                    name: decoded.name,
                    email: decoded.email,
                    picture: decoded.picture,
                    sub: decoded.sub
                });
                setToken(storedToken);
            } catch (e) {
                console.error("Invalid or expired stored token", e);
                localStorage.removeItem('google_id_token');
            }
        }
        setIsLoading(false);
    }, []);

    const logout = () => {
        googleLogout();
        localStorage.removeItem('google_id_token');
        setUser(null);
        setToken(null);
    };

    const setLoginSuccess = (idToken: string) => {
        try {
            localStorage.setItem('google_id_token', idToken);
            setToken(idToken);
            const decoded: any = jwtDecode(idToken);
            setUser({
                name: decoded.name,
                email: decoded.email,
                picture: decoded.picture,
                sub: decoded.sub
            });
        } catch (error) {
            console.error("Failed to decode token", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, logout, isAuthenticated: !!user, isLoading, setLoginSuccess }}>
            {children}
        </AuthContext.Provider>
    );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <AuthStateProvider>{children}</AuthStateProvider>
        </GoogleOAuthProvider>
    );
};
