import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Finance from './pages/Finance';
import Fitness from './pages/Fitness';
import Mood from './pages/Mood';
import Vault from './pages/Vault';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';
import * as Icon from 'react-feather';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}><Icon.Loader className="spin" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="finance" element={<Finance />} />
          <Route path="fitness" element={<Fitness />} />
          <Route path="mood" element={<Mood />} />
          <Route path="vault" element={<Vault />} />
          <Route path="insights" element={<Insights />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
