import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Users, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

const Assignments = () => {
    const { user } = useAuth();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('ASSIGN'); // ASSIGN or EXPEND
    const [message, setMessage] = useState(null);

    // Auto-dismiss message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Form State
    const [formData, setFormData] = useState({
        asset_id: '',
        base_id: user.base_id || '',
        quantity: 1
    });

    useEffect(() => {
        api.get('/assets').then(res => setAssets(res.data));
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            await api.post('/assignments', {
                ...formData,
                type: mode,
                user_id: user.id
            });
            setMessage({ type: 'success', text: `${mode === 'ASSIGN' ? 'Assignment' : 'Expenditure'} recorded successfully` });
            setFormData(prev => ({ ...prev, quantity: 1 }));
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Operation failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="heading-1">Field Operations</h1>
                <p className="text-slate-400 text-sm mt-1">Personnel Assignment & Expenditure Logs</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium text-sm">{message.text}</span>
                </div>
            )}

            {/* Toggle */}
            <div className="flex bg-white p-1.5 rounded-xl w-fit border border-slate-200 mx-auto md:mx-0 shadow-sm">
                <button
                    onClick={() => setMode('ASSIGN')}
                    className={clsx(
                        "px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm",
                        mode === 'ASSIGN'
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                >
                    <Users className="w-4 h-4" />
                    Assign to Personnel
                </button>
                <div className="w-px bg-slate-200 my-1 mx-1"></div>
                <button
                    onClick={() => setMode('EXPEND')}
                    className={clsx(
                        "px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm",
                        mode === 'EXPEND'
                            ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                            : "text-slate-500 hover:text-red-600 hover:bg-red-50"
                    )}
                >
                    <TrendingDown className="w-4 h-4" />
                    Record Expenditure
                </button>
            </div>

            <div className={`card p-8 border-t-4 bg-white shadow-sm ${mode === 'ASSIGN' ? 'border-t-blue-600' : 'border-t-red-600'}`}>
                <div className="mb-6 pb-6 border-b border-slate-100">
                    <h2 className="heading-2 mb-0 text-slate-900">
                        {mode === 'ASSIGN' ? 'Assignment Detail' : 'Expenditure Report'}
                    </h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">
                        {mode === 'ASSIGN' ? 'Checking out asset to personnel' : 'Permanently removing asset from inventory'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Operation Base: <span className="text-slate-900 font-mono font-bold ml-2">{user.base_id ? "BASE-SEC-" + user.base_id : "ADMIN-OVERRIDE"}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="label-text">Select Asset</label>
                            <select
                                className="input-field"
                                value={formData.asset_id}
                                onChange={e => setFormData({ ...formData, asset_id: e.target.value })}
                                required
                            >
                                <option value="">Select Asset...</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="label-text">Deployment Count</label>
                            <input
                                type="number"
                                min="1"
                                className="input-field"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "btn w-full md:w-auto min-w-[200px]",
                                mode === 'ASSIGN'
                                    ? "btn-primary"
                                    : "btn-danger"
                            )}
                        >
                            {loading ? (
                                <span>Processing...</span>
                            ) : (
                                <>
                                    {mode === 'ASSIGN' ? <Users className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    <span>{mode === 'ASSIGN' ? 'Confirm Assignment' : 'Confirm Expenditure'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Assignments;
