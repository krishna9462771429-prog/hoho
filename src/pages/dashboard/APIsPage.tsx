import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Activity, Trash2, CreditCard as Edit3, Power, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle, X, Brain, Stethoscope } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { Api } from '../../lib/types';
import DiagnosisPanel from '../../components/dashboard/DiagnosisPanel';
import LiveStatusIndicator from '../../components/dashboard/LiveStatusIndicator';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

interface ApiFormData {
  name: string;
  url: string;
  method: string;
  timeout: number;
  retries: number;
  interval_seconds: number;
  expected_status: number;
  headers: string;
}

interface Diagnosis {
  id: string;
  api_id: string;
  diagnosis: string;
  severity: string;
  confidence: number;
  suggested_fix: string;
  recommended_action: string;
  provider_used: string;
  failure_category: string;
  raw_error: { status_code: number | null; error_message: string; latency_ms: number };
  created_at: string;
  explanation?: string;
}

const DEFAULT_FORM: ApiFormData = {
  name: '',
  url: '',
  method: 'GET',
  timeout: 5000,
  retries: 3,
  interval_seconds: 60,
  expected_status: 200,
  headers: '{}',
};

export default function APIsPage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApi, setEditingApi] = useState<Api | null>(null);
  const [form, setForm] = useState<ApiFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState<string | null>(null);

  // Real-time + Diagnosis state
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState<Map<string, { status: string; latency: number; updated: boolean }>>(new Map());

  useEffect(() => { if (user) fetchApis(); }, [user]);

  const fetchApis = async () => {
    setLoading(true);
    const { data } = await supabase.from('apis').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (data) setApis(data);
    setLoading(false);
  };

  const openAddForm = () => {
    setEditingApi(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEditForm = (api: Api) => {
    setEditingApi(api);
    setForm({
      name: api.name,
      url: api.url,
      method: api.method,
      timeout: api.timeout,
      retries: api.retries,
      interval_seconds: api.interval_seconds,
      expected_status: api.expected_status,
      headers: JSON.stringify(api.headers, null, 2),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast('Name and URL are required', 'error');
      return;
    }
    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(form.headers || '{}');
    } catch {
      toast('Invalid JSON in headers', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      method: form.method,
      timeout: form.timeout,
      retries: form.retries,
      interval_seconds: form.interval_seconds,
      expected_status: form.expected_status,
      headers: parsedHeaders,
      user_id: user!.id,
    };
    try {
      if (editingApi) {
        const { error } = await supabase.from('apis').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingApi.id);
        if (error) throw error;
        toast('API updated', 'success');
      } else {
        const { error } = await supabase.from('apis').insert(payload);
        if (error) throw error;
        toast('API added', 'success');
      }
      setShowForm(false);
      fetchApis();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (api: Api) => {
    const { error } = await supabase.from('apis').update({ is_active: !api.is_active }).eq('id', api.id);
    if (!error) {
      setApis((prev) => prev.map((a) => a.id === api.id ? { ...a, is_active: !a.is_active } : a));
      toast(`API ${api.is_active ? 'disabled' : 'enabled'}`, 'info');
    }
  };

  const deleteApi = async (api: Api) => {
    if (!confirm(`Delete "${api.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('apis').delete().eq('id', api.id);
    if (!error) {
      setApis((prev) => prev.filter((a) => a.id !== api.id));
      toast('API deleted', 'success');
    }
  };

  const pingApi = async (api: Api) => {
    setPinging(api.id);
    const start = Date.now();
    try {
      const res = await fetch(api.url, { method: api.method, signal: AbortSignal.timeout(api.timeout) });
      const latency = Date.now() - start;
      const status = res.status === api.expected_status ? 'success' : 'error';
      await supabase.from('api_logs').insert({
        api_id: api.id,
        user_id: user!.id,
        status,
        status_code: res.status,
        latency_ms: latency,
        error_message: status === 'error' ? `Expected ${api.expected_status}, got ${res.status}` : '',
      });
      await supabase.from('apis').update({
        last_status: status,
        last_latency_ms: latency,
        last_checked_at: new Date().toISOString(),
        total_checks: api.total_checks + 1,
        failed_checks: status === 'error' ? api.failed_checks + 1 : api.failed_checks,
      }).eq('id', api.id);
      toast(`Ping: ${status === 'success' ? 'OK' : 'FAILED'} (${latency}ms)`, status === 'success' ? 'success' : 'error');
      fetchApis();
    } catch (err) {
      const latency = Date.now() - start;
      await supabase.from('api_logs').insert({
        api_id: api.id,
        user_id: user!.id,
        status: 'error',
        latency_ms: latency,
        error_message: err instanceof Error ? err.message : 'Network error',
      });
      toast('Ping failed: ' + (err instanceof Error ? err.message : 'Network error'), 'error');
    } finally {
      setPinging(null);
    }
  };

  const diagnoseFailure = async (api: Api) => {
    setSelectedApiId(api.id);
    setDiagnosisLoading(true);
    setDiagnosis(null);
    try {
      toast('Diagnosis feature requires backend service', 'info');
      setDiagnosisLoading(false);
    } catch (err) {
      toast('Diagnosis failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    }
  };

  const closeDiagnosis = () => {
    setSelectedApiId(null);
    setDiagnosis(null);
  };

  const statusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-400" />;
    if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">APIs</h1>
          <p className="text-gray-500 text-sm mt-1">{apis.length} endpoints registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchApis} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            Add API
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : apis.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-white/10 p-16 text-center"
        >
          <Activity className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No APIs yet</h3>
          <p className="text-gray-600 text-sm mb-6">Add your first endpoint to start monitoring</p>
          <button onClick={openAddForm} className="px-6 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors">
            <Plus className="w-4 h-4 inline mr-2" />
            Add Your First API
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {apis.map((api, i) => {
            const liveUpdate = liveUpdates.get(api.id);
            const displayStatus = liveUpdate?.status || api.last_status;
            const displayLatency = liveUpdate?.latency || api.last_latency_ms;
            const hasUpdate = liveUpdate?.updated;

            return (
              <motion.div
                key={api.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-2xl border bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-all ${
                  hasUpdate ? 'border-sky-500/30 ring-1 ring-sky-500/20' : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-1 shrink-0 transition-transform ${hasUpdate ? 'scale-125' : ''}`}>
                      {statusIcon(displayStatus)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{api.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          api.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400' :
                          api.method === 'POST' ? 'bg-sky-500/10 text-sky-400' :
                          api.method === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {api.method}
                        </span>
                        {!api.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20">disabled</span>
                        )}
                      </div>
                      <a href={api.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-300 truncate block max-w-md transition-colors flex items-center gap-1 mt-0.5">
                        {api.url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                        <span>Uptime: <span className="text-emerald-400">{api.uptime_percent}%</span></span>
                        <span className={hasUpdate ? 'text-sky-400 font-medium' : ''}>
                          Latency: <span className="text-sky-400">{displayLatency}ms</span>
                        </span>
                        <span>Checks: <span className="text-gray-400">{api.total_checks}</span></span>
                        <span>Failures: <span className="text-red-400">{api.failed_checks}</span></span>
                        {api.last_checked_at && (
                          <span>Last: {new Date(api.last_checked_at).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {api.last_status === 'error' && (
                      <button
                        onClick={() => diagnoseFailure(api)}
                        title="Diagnose failure with AI"
                        className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all"
                      >
                        <Stethoscope className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => pingApi(api)}
                      disabled={pinging === api.id}
                      title="Ping now"
                      className="p-2 rounded-lg bg-white/5 hover:bg-sky-500/10 hover:text-sky-400 text-gray-500 transition-all disabled:opacity-50"
                    >
                      {pinging === api.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </button>
                    <button onClick={() => toggleActive(api)} title={api.is_active ? 'Disable' : 'Enable'} className={`p-2 rounded-lg transition-all ${api.is_active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400' : 'bg-gray-500/10 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEditForm(api)} title="Edit" className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/10 hover:text-amber-400 text-gray-500 transition-all">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteApi(api)} title="Delete" className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-gray-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Diagnosis Modal */}
      <AnimatePresence>
        {selectedApiId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeDiagnosis}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">AI Failure Diagnosis</h2>
                </div>
                <button onClick={closeDiagnosis} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <DiagnosisPanel diagnosis={diagnosis} loading={diagnosisLoading} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">{editingApi ? 'Edit API' : 'Add New API'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Payment API"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all placeholder-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">URL *</label>
                  <input
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://api.example.com/v1/health"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all placeholder-gray-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Method</label>
                    <select
                      value={form.method}
                      onChange={(e) => setForm({ ...form, method: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all"
                    >
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Expected Status</label>
                    <input
                      type="number"
                      value={form.expected_status}
                      onChange={(e) => setForm({ ...form, expected_status: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Timeout (ms)</label>
                    <input
                      type="number"
                      value={form.timeout}
                      onChange={(e) => setForm({ ...form, timeout: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Retries</label>
                    <input
                      type="number"
                      value={form.retries}
                      onChange={(e) => setForm({ ...form, retries: Number(e.target.value) })}
                      min={0} max={10}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Interval (s)</label>
                    <input
                      type="number"
                      value={form.interval_seconds}
                      onChange={(e) => setForm({ ...form, interval_seconds: Number(e.target.value) })}
                      min={10}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Headers (JSON)</label>
                  <textarea
                    value={form.headers}
                    onChange={(e) => setForm({ ...form, headers: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-sky-500/50 transition-all resize-none placeholder-gray-700"
                    placeholder='{"Authorization": "Bearer token"}'
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Saving...' : (editingApi ? 'Save Changes' : 'Add API')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
