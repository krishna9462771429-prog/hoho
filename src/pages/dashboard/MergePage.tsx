import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, Plus, Trash2, Play, X, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { Workflow, Api } from '../../lib/types';

export default function MergePage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', selectedApis: [] as string[], mergeStrategy: 'merge' });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ workflowId: string; data: unknown } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (user) { fetchWorkflows(); fetchApis(); } }, [user]);

  const fetchWorkflows = async () => {
    setLoading(true);
    const { data } = await supabase.from('workflows').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (data) setWorkflows(data);
    setLoading(false);
  };

  const fetchApis = async () => {
    const { data } = await supabase.from('apis').select('*').eq('user_id', user!.id).eq('is_active', true);
    if (data) setApis(data);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.selectedApis.length < 2) {
      toast('Name and at least 2 APIs required', 'error');
      return;
    }
    setSaving(true);
    const slug = `${form.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const { error } = await supabase.from('workflows').insert({
      user_id: user!.id,
      name: form.name.trim(),
      description: form.description,
      api_ids: form.selectedApis,
      merge_strategy: form.mergeStrategy,
      endpoint_slug: slug,
    });
    if (error) toast(error.message, 'error');
    else { toast('Workflow created', 'success'); setShowForm(false); fetchWorkflows(); }
    setSaving(false);
  };

  const runWorkflow = async (workflow: Workflow) => {
    setRunning(workflow.id);
    setResult(null);
    try {
      const selectedApis = apis.filter((a) => workflow.api_ids.includes(a.id));
      const responses = await Promise.allSettled(
        selectedApis.map(async (api) => {
          const start = Date.now();
          const res = await fetch(api.url, { method: api.method, signal: AbortSignal.timeout(api.timeout) });
          const latency = Date.now() - start;
          let body: unknown;
          try { body = await res.json(); } catch { body = await res.text(); }
          return { api: api.name, status: res.status, latency, data: body };
        })
      );
      const merged: Record<string, unknown> = {};
      responses.forEach((r, i) => {
        const apiName = selectedApis[i]?.name || `api_${i}`;
        if (r.status === 'fulfilled') merged[apiName] = r.value;
        else merged[apiName] = { error: r.reason?.message || 'Failed' };
      });
      setResult({ workflowId: workflow.id, data: merged });
      await supabase.from('workflows').update({ total_calls: workflow.total_calls + 1 }).eq('id', workflow.id);
      toast('Workflow executed successfully', 'success');
    } catch (err) {
      toast('Execution failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setRunning(null);
    }
  };

  const copyEndpoint = (slug: string) => {
    navigator.clipboard.writeText(`${import.meta.env.VITE_API_URL}/merge/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Endpoint URL copied', 'success');
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    await supabase.from('workflows').delete().eq('id', id);
    setWorkflows((p) => p.filter((w) => w.id !== id));
    toast('Workflow deleted', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Merge</h1>
          <p className="text-gray-500 text-sm mt-1">Combine multiple APIs into unified endpoints</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <GitMerge className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No workflows yet</h3>
          <p className="text-gray-600 text-sm">Create a workflow to merge multiple APIs into one endpoint</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf, i) => (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{wf.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${wf.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                      {wf.is_active ? 'active' : 'inactive'}
                    </span>
                  </div>
                  {wf.description && <p className="text-sm text-gray-500 mb-3">{wf.description}</p>}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {wf.api_ids.map((id) => {
                      const api = apis.find((a) => a.id === id);
                      return (
                        <span key={id} className="text-xs px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {api?.name || id.slice(0, 8)}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Strategy: <span className="text-gray-400">{wf.merge_strategy}</span></span>
                    <span>Calls: <span className="text-gray-400">{wf.total_calls}</span></span>
                    <button
                      onClick={() => copyEndpoint(wf.endpoint_slug)}
                      className="flex items-center gap-1 text-sky-500 hover:text-sky-300 transition-colors"
                    >
                      {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy endpoint
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => runWorkflow(wf)}
                    disabled={running === wf.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                  >
                    {running === wf.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </button>
                  <button onClick={() => deleteWorkflow(wf.id)} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Result panel */}
              {result?.workflowId === wf.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Merged Response</span>
                  </div>
                  <pre className="text-xs text-gray-300 overflow-auto max-h-48 font-mono">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* New Workflow Modal */}
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
              className="w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">New Workflow</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Workflow Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Auth + Payment Flow"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What does this workflow do?"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">
                    Select APIs * ({form.selectedApis.length} selected)
                  </label>
                  {apis.length === 0 ? (
                    <p className="text-gray-600 text-sm">No active APIs. Add some APIs first.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {apis.map((api) => (
                        <label key={api.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.selectedApis.includes(api.id)}
                            onChange={(e) => setForm({
                              ...form,
                              selectedApis: e.target.checked
                                ? [...form.selectedApis, api.id]
                                : form.selectedApis.filter((id) => id !== api.id),
                            })}
                            className="accent-sky-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{api.name}</p>
                            <p className="text-xs text-gray-600 truncate">{api.url}</p>
                          </div>
                          <span className="text-xs text-gray-600">{api.method}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Merge Strategy</label>
                  <select
                    value={form.mergeStrategy}
                    onChange={(e) => setForm({ ...form, mergeStrategy: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="merge">Merge (combine all)</option>
                    <option value="first_success">First Success</option>
                    <option value="all_required">All Required</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
