import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // For demo purposes, we can use the API or just mock it here if API fails.
            // Using API:
            const res = await api.post('/login', { username, password });
            login(res.data.user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div className="h-screen flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-8 relative overflow-hidden group border-blue-100 shadow-blue-900/5">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700"></div>

                <div className="text-center mb-8 relative z-10">
                    <h2 className="heading-1 mb-2 text-blue-900">MIL-LOG</h2>
                    <p className="text-slate-500 text-sm tracking-wide uppercase font-semibold">Tactical Asset Command</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center justify-center gap-2 animate-pulse font-medium">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div className="input-group">
                        <label className="label-text text-slate-600">Ident Code</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="label-text text-slate-600">Access Key</label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary w-full group">
                        <span>Authenticate</span>
                        <div className="w-0 h-[2px] bg-white/40 transition-all duration-300 group-hover:w-full"></div>
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">Authorized Personnel Credentials</p>
                    <div className="grid grid-cols-1 gap-2 text-xs font-mono text-left max-w-[240px] mx-auto">
                        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => { setUsername('admin'); setPassword('admin123') }}>
                            <span className="text-slate-700 font-medium">admin</span>
                            <span className="text-slate-500 group-hover:text-blue-600">admin123</span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => { setUsername('commander_alpha'); setPassword('pass123') }}>
                            <span className="text-slate-700 font-medium">commander_alpha</span>
                            <span className="text-slate-500 group-hover:text-blue-600">pass123</span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => { setUsername('logistics_bravo'); setPassword('pass123') }}>
                            <span className="text-slate-700 font-medium">logistics_bravo</span>
                            <span className="text-slate-500 group-hover:text-blue-600">pass123</span>
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2">Click credentials to auto-fill</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
