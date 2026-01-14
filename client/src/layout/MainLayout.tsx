import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Outlet } from 'react-router-dom';

const MainLayout: React.FC = () => {
    return (
        <>
            <Sidebar />
            <main className="main-content">
                <Header />
                <Outlet />
            </main>
        </>
    );
};

export default MainLayout;
