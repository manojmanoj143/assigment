import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, ShoppingCart, ArrowRightLeft, Users, LogOut, Shield } from 'lucide-react';
import clsx from 'clsx';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null; // Should be handled by router protection really

    const navItems = [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'commander', 'logistics'] },
        { label: 'Purchases', path: '/purchases', icon: ShoppingCart, roles: ['admin', 'logistics'] },
        { label: 'Transfers', path: '/transfers', icon: ArrowRightLeft, roles: ['admin', 'logistics'] },
        { label: 'Assignments', path: '/assignments', icon: Users, roles: ['admin', 'commander'] },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
                <div className="p-8 flex items-center gap-4 border-b border-slate-100">
                    <div className=" relative">
                        <Shield className="w-8 h-8 text-blue-600 relative z-10" />
                        <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full"></div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-wider text-slate-800">MIL-LOG</h1>
                        <p className="text-[10px] text-blue-600 uppercase tracking-widest font-semibold">System Online</p>
                    </div>
                </div>

                <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                    <div className="mb-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navigation</div>
                    {navItems.filter(item => item.roles.includes(user.role)).map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => clsx(
                                "nav-item",
                                isActive ? "nav-item-active" : "nav-item-inactive"
                            )}
                        >
                            <item.icon className={clsx("w-5 h-5", ({ isActive }) => isActive ? "text-blue-600" : "text-slate-400")} />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-blue-500/20">
                            {user.username[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-800 truncate">{user.username}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <p className="text-xs text-slate-500 capitalize truncate font-medium">{user.role}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="btn btn-secondary w-full text-sm py-2.5 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Terminate Session</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-4 font-mono">v1.2.0 • SECURE</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-50">
                <div className="p-8 max-w-7xl mx-auto min-h-full">
                    <div className="page-container">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
