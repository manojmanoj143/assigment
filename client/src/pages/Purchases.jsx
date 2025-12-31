import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Clock } from 'lucide-react';

const Purchases = () => {
    const { user } = useAuth();
    const [assets, setAssets] = useState([]);
    const [bases, setBases] = useState([]); // Needed if Admin
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        asset_id: '',
        base_id: user.base_id || '',
        quantity: 1
    });

    useEffect(() => {
        api.get('/assets').then(res => setAssets(res.data));
        if (user.role === 'admin') {
            api.get('/bases').then(res => setBases(res.data));
        }
    }, [user]);

    const [message, setMessage] = useState(null);

    // Auto-dismiss message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            await api.post('/purchases', {
                ...formData,
                user_id: user.id
            });
            setMessage({ type: 'success', text: 'Purchase recorded successfully' });
            setFormData(prev => ({ ...prev, quantity: 1 })); // Reset quantity
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Operation failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="heading-1">Procurement</h1>
                <p className="text-slate-400 text-sm mt-1">Acquire and register new assets into the system</p>
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

            <div className="card p-8 bg-white border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <Plus className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="heading-2 mb-0 text-slate-900">New Acquisition Record</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">Form ID: PR-2024-X</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {user.role === 'admin' && (
                            <div className="col-span-2 input-group">
                                <label className="label-text">Destination Base</label>
                                <select
                                    className="input-field"
                                    value={formData.base_id}
                                    onChange={e => setFormData({ ...formData, base_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Base...</option>
                                    {bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="input-group">
                            <label className="label-text">Asset Class</label>
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
                            <label className="label-text">Quantity Request</label>
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
                            className="btn btn-primary w-full md:w-auto min-w-[200px]"
                        >
                            {loading ? (
                                <>
                                    <Clock className="w-5 h-5 animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    <span>Confirm Purchase</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="p-4 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-center text-sm text-blue-600 font-medium">
                Authorized Personnel Only • All transactions are logged for audit
            </div>
        </div>
    );
};

export default Purchases;
