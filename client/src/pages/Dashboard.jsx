import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Package, Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={onClick}
        className={`card p-6 ${onClick ? 'cursor-pointer hover:border-green-500/50 hover:shadow-green-900/20' : ''}`}
    >
        <div className="flex justify-between items-start">
            <div>
                <p className="label-text mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400 ring-1 ring-${color}-500/20`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </motion.div>
);

const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bases, setBases] = useState([]);
    const [filterBase, setFilterBase] = useState(user.role === 'admin' ? '' : user.base_id);
    const [filterType, setFilterType] = useState('');
    const [showMovementModal, setShowMovementModal] = useState(false);

    useEffect(() => {
        if (user.role === 'admin') {
            api.get('/bases').then(res => setBases(res.data));
        }
    }, [user]);

    useEffect(() => {
        fetchDashboard();
    }, [filterBase, filterType]);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const res = await api.get('/dashboard', {
                params: { base_id: filterBase, type: filterType }
            });
            setStats(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-green-500 animate-spin"></div>
            <p className="text-slate-400 font-mono text-sm animate-pulse">ESTABLISHING UPLINK...</p>
        </div>
    );

    // Calculate Net Movement for Display
    const netCheck = stats?.movements ? (stats.movements.purchased + stats.movements.transfer_in - stats.movements.transfer_out) : 0;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="heading-1">Command Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">Tactical Inventory & Logistics Analytics</p>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    {user.role === 'admin' && (
                        <select
                            className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-sm min-w-[150px] shadow-sm"
                            value={filterBase}
                            onChange={e => setFilterBase(e.target.value)}
                        >
                            <option value="">Global View</option>
                            {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                    <select
                        className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 text-sm min-w-[150px] shadow-sm"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="">All Asset Types</option>
                        <option value="Weapon">Weapons</option>
                        <option value="Vehicle">Vehicles</option>
                        <option value="Ammo">Ammunition</option>
                    </select>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Opening Balance"
                    value={stats?.opening_balance || 0}
                    icon={Package}
                    color="blue"
                />
                <StatCard
                    title="Net Movement"
                    value={(netCheck > 0 ? "+" : "") + netCheck}
                    icon={Activity}
                    color={netCheck >= 0 ? "green" : "red"}
                    onClick={() => setShowMovementModal(true)}
                />
                <StatCard
                    title="Expended"
                    value={stats?.movements?.expended || 0}
                    icon={TrendingDown}
                    color="orange"
                />
                <StatCard
                    title="Closing Balance"
                    value={stats?.closing_balance || 0}
                    icon={Package}
                    color="violet"
                />
            </div>

            {/* Modal for Net Movement Details */}
            <AnimatePresence>
                {showMovementModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowMovementModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white border border-slate-200 rounded-2xl p-1 max-w-lg w-full shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-white rounded-xl p-8">
                                <button
                                    onClick={() => setShowMovementModal(false)}
                                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <h2 className="heading-2 mb-6 text-2xl text-slate-900">Net Movement Details</h2>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-slate-600 font-medium">Purchases</span>
                                        </div>
                                        <span className="text-green-600 font-mono font-bold">+{stats?.movements?.purchased || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="text-slate-600 font-medium">Transfers In</span>
                                        </div>
                                        <span className="text-blue-600 font-mono font-bold">+{stats?.movements?.transfer_in || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <span className="text-slate-600 font-medium">Transfers Out</span>
                                        </div>
                                        <span className="text-red-600 font-mono font-bold">-{stats?.movements?.transfer_out || 0}</span>
                                    </div>

                                    <div className="h-4"></div>

                                    <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm ring-1 ring-blue-50">
                                        <span className="text-slate-900 font-bold">Net Change</span>
                                        <span className={`font-mono font-bold text-lg ${netCheck >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {netCheck > 0 ? "+" : ""}{netCheck}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Inventory Chart */}
            <div className="card p-6 border-slate-200">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="heading-2 mb-0 text-slate-900">Inventory Levels</h3>
                    <div className="px-3 py-1 rounded bg-blue-50 border border-blue-100 text-xs text-blue-700 font-mono font-semibold">
                        LIVE DATA
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.inventory || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis
                                dataKey="name"
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <YAxis
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e2e8f0',
                                    color: '#0f172a',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                                cursor={{ fill: '#f1f5f9' }}
                            />
                            <Bar
                                dataKey="current_balance"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
