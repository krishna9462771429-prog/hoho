import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Plus, Trash2, Power, RefreshCw, X, Activity, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { TickerService } from '../../lib/types';

const INTERVALS = [
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
];

export default function TickerPage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [services, setServices] = useState<TickerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', interval_seconds: 300 });
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState<string | null>(null);

  useEffect(() => { if (user) fetchServices(); }, [user]);

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase.from('ticker_services').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (data) setServices(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast('Name and URL are required', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ticker_services').insert({
      user_id: user!.id,
      name: form.name.trim(),
      url: form.url.trim(),
      interval_seconds: form.interval_seconds,
    });
    if (error) toast(error.message, 'error');
    else { toast('Keep-alive service added', 'success'); setShowForm(false); setForm({ name: '', url: '', interval_seconds: 300 }); fetchServices(); }
    setSaving(false);
  };

  const toggleActive = async (s: TickerService) => {
    await supabase.from('ticker_services').update({ is_active: !s.is_active }).eq('id', s.id);
    setServices((p) => p.map((x) => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
    toast(`Service ${s.is_active ? 'paused' : 'activated'}`, 'info');
  };

  const deleteService = async (id: string) => {
    if (!confirm('Delete this keep-alive service?')) return;
    await supabase.from('ticker_services').delete().eq('id', id);
    setServices((p) => p.filter((s) => s.id !== id));
    toast('Service deleted', 'success');
  };

  const pingNow = async (s: TickerService) => {
    setPinging(s.id);
    const start = Date.now();
    try {
      await fetch(s.url, { signal: AbortSignal.timeout(10000) });
      const latency = Date.now() - start;
      await supabase.from('ticker_services').update({
        last_pinged_at: new Date().toISOString(),
        last_status: 'success',
        ping_count: s.ping_count + 1,
      }).eq('id', s.id);
      toast(`Ping OK! (${latency}ms)`, 'success');
      fetchServices();
    } catch (err) {
      await supabase.from('ticker_services').update({
        last_pinged_at: new Date().toISOString(),
        last_status: 'error',
        ping_count: s.ping_count + 1,
      }).eq('id', s.id);
      toast('Ping failed: ' + (err instanceof Error ? err.message : 'Error'), 'error');
    } finally {
      setPinging(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Keep Alive</h1>
          <p className="text-gray-500 text-sm mt-1">Prevent Render & Vercel deployments from sleeping</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
        <Timer className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">How it works</p>
          <p className="text-xs text-gray-500 mt-1">
            APIMerge periodically sends GET requests to your deployment URLs at the configured interval.
            This prevents free-tier Render and Vercel deployments from spinning down due to inactivity.
            Configure the backend scheduler to run these pings automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <Timer className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No services yet</h3>
          <p className="text-gray-600 text-sm">Add your Render or Vercel deployment URL to keep it awake</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {services.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-2 ${
                    s.last_status === 'success' ? 'bg-emerald-400' :
                    s.last_status === 'error' ? 'bg-red-400' : 'bg-gray-600'
                  } ${s.is_active ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{s.name}</h3>
                      {!s.is_active && <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-500/10">paused</span>}
                    </div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-300 truncate block max-w-sm mt-0.5">
                      {s.url}
                    </a>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span>Interval: <span className="text-gray-400">{INTERVALS.find(x => x.value === s.interval_seconds)?.label || `${s.interval_seconds}s`}</span></span>
                      <span>Pings: <span className="text-gray-400">{s.ping_count}</span></span>
                      {s.last_pinged_at && (
                        <span>Last ping: <span className="text-gray-400">{new Date(s.last_pinged_at).toLocaleTimeString()}</span></span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => pingNow(s)}
                    disabled={pinging === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 text-xs border border-sky-500/20 hover:bg-sky-500/20 disabled:opacity-50 transition-all"
                  >
                    {pinging === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Ping
                  </button>
                  <button onClick={() => toggleActive(s)} className={`p-1.5 rounded-lg transition-all ${s.is_active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400' : 'bg-gray-500/10 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteService(s.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Add Keep-Alive Service</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Service Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="My Render Backend"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">URL *</label>
                  <input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://myapp.onrender.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Ping Interval</label>
                  <div className="grid grid-cols-5 gap-2">
                    {INTERVALS.map((interval) => (
                      <button
                        key={interval.value}
                        onClick={() => setForm({ ...form, interval_seconds: interval.value })}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          form.interval_seconds === interval.value
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-white/5 text-gray-500 border border-white/10 hover:text-gray-300'
                        }`}
                      >
                        {interval.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Service'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
