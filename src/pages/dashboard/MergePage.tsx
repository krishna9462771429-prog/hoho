import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitMerge, Plus, Trash2, Play, X, Copy, CheckCircle, RefreshCw,
  ChevronDown, ChevronUp, AlertCircle, Clock, Zap, BarChart2,
  ArrowRight, Shield, Activity, Layers, Link2, RotateCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { Workflow, Api } from '../../lib/types';

// ─── Strategy metadata ───────────────────────────────────────────────────────

const STRATEGIES = [
  {
    value: 'merge',
    label: 'Merge',
    description: 'Combine all successful responses into one unified object',
    icon: Layers,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    value: 'first_success',
    label: 'First Success',
    description: 'Return immediately after the first successful response',
    icon: Zap,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    value: 'all_required',
    label: 'All Required',
    description: 'Fail the workflow if any single API fails',
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    value: 'majority_success',
    label: 'Majority Success',
    description: 'Succeed when more than half of the APIs respond successfully',
    icon: BarChart2,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
  },
  {
    value: 'fallback_chain',
    label: 'Fallback Chain',
    description: 'Try APIs sequentially; stop at the first success',
    icon: RotateCcw,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
];

const CONFLICT_RESOLUTIONS = [
  { value: 'average', label: 'Average numerics' },
  { value: 'first_wins', label: 'First API wins' },
  { value: 'last_wins', label: 'Last API wins' },
  { value: 'majority', label: 'Majority vote' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExecutionResult {
  workflowId: string;
  success: boolean;
  strategy: string;
  execution_time_ms: number;
  successful_apis: number;
  failed_apis: number;
  total_apis: number;
  data: unknown;
  errors: Array<{ api_name: string; error: string; status_code: number | null; latency_ms: number; retry_count: number }>;
  metadata: {
    latencies: Record<string, number>;
    status_codes: Record<string, number | null>;
    response_sizes: Record<string, number>;
    retry_counts: Record<string, number>;
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StrategyBadge({ value }: { value: string }) {
  const s = STRATEGIES.find((x) => x.value === value) || STRATEGIES[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${s.color} ${s.bg}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function MetadataBar({ result }: { result: ExecutionResult }) {
  const successRate = result.total_apis > 0
    ? Math.round((result.successful_apis / result.total_apis) * 100)
    : 0;
  const latencies = Object.values(result.metadata.latencies);
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  return (
    <div className="grid grid-cols-4 gap-3 text-xs mt-4 pt-4 border-t border-white/5">
      <div>
        <p className="text-gray-500 mb-1">Execution Time</p>
        <p className="text-sky-400 font-mono font-semibold">{result.execution_time_ms}ms</p>
      </div>
      <div>
        <p className="text-gray-500 mb-1">Success Rate</p>
        <p className={`font-semibold ${successRate === 100 ? 'text-emerald-400' : successRate > 50 ? 'text-amber-400' : 'text-red-400'}`}>
          {successRate}%
        </p>
      </div>
      <div>
        <p className="text-gray-500 mb-1">Avg Latency</p>
        <p className="text-gray-300 font-mono">{avgLatency}ms</p>
      </div>
      <div>
        <p className="text-gray-500 mb-1">APIs</p>
        <p className="text-gray-300">
          <span className="text-emerald-400">{result.successful_apis}</span>
          <span className="text-gray-600">/</span>
          {result.total_apis} ok
        </p>
      </div>
    </div>
  );
}

function LatencyBreakdown({ metadata }: { metadata: ExecutionResult['metadata'] }) {
  const entries = Object.entries(metadata.latencies);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="mt-3 space-y-1.5">
      {entries.map(([name, latency]) => {
        const sc = metadata.status_codes[name];
        const isOk = sc && sc < 400;
        const pct = Math.round((latency / max) * 100);
        return (
          <div key={name} className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-gray-400 w-28 truncate shrink-0">{name}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isOk ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-gray-500 font-mono w-14 text-right">{latency}ms</span>
            {sc && (
              <span className={`font-mono w-8 text-right ${isOk ? 'text-emerald-400' : 'text-red-400'}`}>{sc}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultPanel({ result }: { result: ExecutionResult }) {
  const [showData, setShowData] = useState(false);
  const [showLatency, setShowLatency] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyData = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={`mt-4 rounded-xl border overflow-hidden ${
        result.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs font-semibold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.success ? 'Execution successful' : 'Execution failed'}
            </span>
            <StrategyBadge value={result.strategy} />
          </div>
        </div>

        <MetadataBar result={result} />

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {result.errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-red-500/10 border border-red-500/15">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-red-300 font-medium">{err.api_name}</span>
                  <span className="text-gray-500 ml-2">{err.error}</span>
                </div>
                <span className="text-gray-600 font-mono shrink-0">{err.latency_ms}ms</span>
              </div>
            ))}
          </div>
        )}

        {/* Latency breakdown toggle */}
        <button
          onClick={() => setShowLatency(!showLatency)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mt-3 transition-colors"
        >
          <Activity className="w-3 h-3" />
          Latency breakdown
          {showLatency ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showLatency && <LatencyBreakdown metadata={result.metadata} />}

        {/* Response data toggle */}
        {result.data !== null && result.data !== undefined && (
          <>
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => setShowData(!showData)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Layers className="w-3 h-3" />
                Merged response
                {showData ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showData && (
                <button
                  onClick={copyData}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {showData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-2"
              >
                <pre className="text-xs text-gray-300 overflow-auto max-h-64 font-mono bg-black/30 rounded-lg p-3 border border-white/5">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </motion.div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MergePage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    selectedApis: [] as string[],
    mergeStrategy: 'merge',
    conflictResolution: 'average',
    normalize: true,
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ExecutionResult>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState(0);

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
    else {
      toast('Workflow created', 'success');
      setShowForm(false);
      setForm({ name: '', description: '', selectedApis: [], mergeStrategy: 'merge', conflictResolution: 'average', normalize: true });
      fetchWorkflows();
    }
    setSaving(false);
  };

  const runWorkflow = async (workflow: Workflow) => {
    setRunning(workflow.id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${apiUrl}/merge/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          api_ids: workflow.api_ids,
          strategy: workflow.merge_strategy,
          user_id: user?.id,
          workflow_id: workflow.id,
          normalize: true,
          conflict_resolution: 'average',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Execution failed');
      }

      const data = await res.json();
      setResults((prev) => ({ ...prev, [workflow.id]: { ...data, workflowId: workflow.id } }));

      if (data.success) {
        toast(`Workflow succeeded — ${data.successful_apis}/${data.total_apis} APIs ok (${data.execution_time_ms}ms)`, 'success');
      } else {
        toast(`Workflow failed — ${data.failed_apis} API(s) failed`, 'error');
      }
    } catch (err) {
      // Client-side fallback so the page remains usable without backend
      toast('Backend unavailable — execution requires the backend server', 'warning');
    } finally {
      setRunning(null);
    }
  };

  const copyEndpoint = (slug: string, wfId: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    navigator.clipboard.writeText(`${apiUrl}/merge/${slug}`);
    setCopied(wfId);
    setTimeout(() => setCopied(null), 2000);
    toast('Endpoint URL copied', 'success');
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    await supabase.from('workflows').delete().eq('id', id);
    setWorkflows((p) => p.filter((w) => w.id !== id));
    setResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
    toast('Workflow deleted', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Merge</h1>
          <p className="text-gray-500 text-sm mt-1">Orchestrate multiple APIs into unified endpoints</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Strategy overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {STRATEGIES.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.value} className={`rounded-xl border p-3 ${s.bg}`}>
              <Icon className={`w-4 h-4 ${s.color} mb-1.5`} />
              <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{s.description}</p>
            </div>
          );
        })}
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <GitMerge className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No workflows yet</h3>
          <p className="text-gray-600 text-sm mb-6">Create a workflow to merge multiple APIs into one endpoint</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Create Your First Workflow
          </button>
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
                  {/* Title row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white">{wf.name}</h3>
                    <StrategyBadge value={wf.merge_strategy} />
                    {!wf.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20">
                        inactive
                      </span>
                    )}
                  </div>

                  {wf.description && (
                    <p className="text-sm text-gray-500 mb-3">{wf.description}</p>
                  )}

                  {/* API chips */}
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

                  {/* Footer metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {wf.total_calls} calls
                    </span>
                    <button
                      onClick={() => copyEndpoint(wf.endpoint_slug, wf.id)}
                      className="flex items-center gap-1 text-sky-500 hover:text-sky-300 transition-colors"
                    >
                      {copied === wf.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                      {copied === wf.id ? 'Copied!' : 'Copy endpoint'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => runWorkflow(wf)}
                    disabled={running === wf.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
                  >
                    {running === wf.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {running === wf.id ? 'Running...' : 'Run'}
                  </button>
                  <button
                    onClick={() => deleteWorkflow(wf.id)}
                    className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rich result panel */}
              {results[wf.id] && <ResultPanel result={results[wf.id]} />}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-lg font-bold text-white">New Workflow</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Name + description */}
                <div className="grid grid-cols-1 gap-4">
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
                </div>

                {/* Strategy picker */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">Merge Strategy *</label>
                  <div className="grid grid-cols-1 gap-2">
                    {STRATEGIES.map((s, idx) => {
                      const Icon = s.icon;
                      const active = form.mergeStrategy === s.value;
                      return (
                        <button
                          key={s.value}
                          onClick={() => setForm({ ...form, mergeStrategy: s.value })}
                          className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                            active
                              ? `${s.bg} ${s.color}`
                              : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/[0.07]'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? s.color : ''}`} />
                          <div>
                            <p className={`text-sm font-medium ${active ? s.color : 'text-gray-300'}`}>{s.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* API selector */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">
                    Select APIs * ({form.selectedApis.length} selected, min 2)
                  </label>
                  {apis.length === 0 ? (
                    <p className="text-gray-600 text-sm">No active APIs. Add some APIs first.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {apis.map((api) => (
                        <label
                          key={api.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form.selectedApis.includes(api.id)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                selectedApis: e.target.checked
                                  ? [...form.selectedApis, api.id]
                                  : form.selectedApis.filter((id) => id !== api.id),
                              })
                            }
                            className="accent-sky-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{api.name}</p>
                            <p className="text-xs text-gray-600 truncate">{api.url}</p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            api.method === 'GET' ? 'text-emerald-400' :
                            api.method === 'POST' ? 'text-sky-400' : 'text-amber-400'
                          }`}>
                            {api.method}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conflict resolution + normalize */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Conflict Resolution</label>
                    <select
                      value={form.conflictResolution}
                      onChange={(e) => setForm({ ...form, conflictResolution: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50"
                    >
                      {CONFLICT_RESOLUTIONS.map((cr) => (
                        <option key={cr.value} value={cr.value}>{cr.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Schema Normalization</label>
                    <button
                      onClick={() => setForm({ ...form, normalize: !form.normalize })}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                        form.normalize
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-gray-500'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${form.normalize ? 'border-emerald-400 bg-emerald-400' : 'border-gray-600'}`}>
                        {form.normalize && <CheckCircle className="w-3 h-3 text-black" />}
                      </div>
                      {form.normalize ? 'Normalize fields' : 'Raw responses'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-6 pt-0">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || form.selectedApis.length < 2 || !form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
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
