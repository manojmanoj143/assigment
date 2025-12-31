import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
// Placeholder imports
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import Transfers from './pages/Transfers';
import Assignments from './pages/Assignments';

const ProtectedRoute = ({ children, roles }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
    return <Layout>{children}</Layout>;
};

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />

            <Route path="/purchases" element={
                <ProtectedRoute roles={['admin', 'logistics']}>
                    <Purchases />
                </ProtectedRoute>
            } />

            <Route path="/transfers" element={
                <ProtectedRoute roles={['admin', 'logistics']}>
                    <Transfers />
                </ProtectedRoute>
            } />

            <Route path="/assignments" element={
                <ProtectedRoute roles={['admin', 'commander']}>
                    <Assignments />
                </ProtectedRoute>
            } />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </AuthProvider>
    );
}

export default App;
