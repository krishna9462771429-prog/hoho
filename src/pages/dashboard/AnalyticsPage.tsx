import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, TrendingUp, RefreshCw, Brain, Activity, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ApiLog, AIFallback } from '../../lib/types';

const COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [fallbacks, setFallbacks] = useState<AIFallback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [logsRes, fallbacksRes] = await Promise.all([
      supabase.from('api_logs').select('*').eq('user_id', user!.id)
        .gte('checked_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('checked_at', { ascending: true }),
      supabase.from('ai_fallbacks').select('*').eq('user_id', user!.id)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (fallbacksRes.data) setFallbacks(fallbacksRes.data);
    setLoading(false);
  };

  const buildDailyData = () => {
    const days: Record<string, { date: string; success: number; error: number; latency: number; count: number }> = {};
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });
    last30.forEach((d) => { days[d] = { date: d, success: 0, error: 0, latency: 0, count: 0 }; });
    logs.forEach((log) => {
      const d = log.checked_at.split('T')[0];
      if (days[d]) {
        days[d].count++;
        if (log.status === 'success') days[d].success++;
        else days[d].error++;
        days[d].latency += log.latency_ms;
      }
    });
    return last30.map((d) => ({
      date: d.slice(5),
      success: days[d].success,
      errors: days[d].error,
      latency: days[d].count > 0 ? Math.round(days[d].latency / days[d].count) : 0,
    }));
  };

  const buildHeatmap = () => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    logs.filter((l) => l.status === 'error').forEach((log) => {
      const h = new Date(log.checked_at).getHours();
      hours[h]++;
    });
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, failures: hours[h] }));
  };

  const providerPie = () => {
    const counts: Record<string, number> = {};
    fallbacks.forEach((f) => { counts[f.provider] = (counts[f.provider] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const dailyData = buildDailyData();
  const heatmapData = buildHeatmap();
  const pieData = providerPie();

  const totalSuccess = logs.filter((l) => l.status === 'success').length;
  const totalErrors = logs.filter((l) => l.status === 'error').length;
  const totalFallbacks = fallbacks.length;
  const avgLatency = logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / logs.length) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Last 30 days overview</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: (totalSuccess + totalErrors).toLocaleString(), icon: Activity, color: 'text-sky-400' },
          { label: 'Successful', value: totalSuccess.toLocaleString(), icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Errors', value: totalErrors.toLocaleString(), icon: Zap, color: 'text-red-400' },
          { label: 'AI Fallbacks', value: totalFallbacks.toLocaleString(), icon: Brain, color: 'text-amber-400' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <card.icon className={`w-5 h-5 ${card.color} mb-3`} />
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Request Volume + Latency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-5">Request Volume (30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="sucGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb', fontSize: 12 }} />
              <Area type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} fill="url(#sucGrad)" name="Success" />
              <Area type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} fill="url(#errGrad)" name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-5">Avg Latency Trend (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb', fontSize: 12 }} />
              <Line type="monotone" dataKey="latency" stroke="#22d3ee" strokeWidth={2} dot={false} name="Latency (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Heatmap + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-5">Failure Heatmap (by hour)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={heatmapData}>
              <XAxis dataKey="hour" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb', fontSize: 12 }} />
              <Bar dataKey="failures" fill="#ef4444" radius={[3, 3, 0, 0]} name="Failures" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-5">AI Provider Usage</h3>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <Brain className="w-8 h-8 mb-2" />
              <span className="text-sm">No AI fallbacks yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb' }} />
                <Legend formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Avg Latency Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-gray-500 text-sm">Overall Average Latency</p>
          <p className="text-3xl font-bold text-sky-400 mt-1">{avgLatency}ms</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-sm">Success Rate</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">
            {logs.length > 0 ? ((totalSuccess / logs.length) * 100).toFixed(1) : '100.0'}%
          </p>
        </div>
        <BarChart3 className="w-16 h-16 text-gray-800" />
      </motion.div>
    </div>
  );
}
