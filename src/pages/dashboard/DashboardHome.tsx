import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Zap, Brain, TrendingUp, AlertTriangle, Clock,
  CheckCircle, XCircle, ArrowRight, RefreshCw, Radio, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import StatCard from '../../components/ui/StatCard';
import LiveStatusIndicator from '../../components/dashboard/LiveStatusIndicator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Api, ApiLog } from '../../lib/types';

const EMPTY_CHART = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  uptime: 0, failures: 0, latency: 0,
}));

export default function DashboardHome() {
  const { user } = useAuth();
  const [apis, setApis] = useState<Api[]>([]);
  const [recentLogs, setRecentLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(EMPTY_CHART);


  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [apisRes, logsRes] = await Promise.all([
      supabase.from('apis').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('api_logs').select('*').eq('user_id', user!.id)
        .order('checked_at', { ascending: false }).limit(50),
    ]);
    if (apisRes.data) setApis(apisRes.data);
    if (logsRes.data) {
      setRecentLogs(logsRes.data.slice(0, 10));
      buildChartData(logsRes.data);
    }
    setLoading(false);
  };

  const buildChartData = (logs: ApiLog[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayName = days[d.getDay()];
      const dayLogs = logs.filter((l) => {
        const ld = new Date(l.checked_at);
        return ld.toDateString() === d.toDateString();
      });
      const total = dayLogs.length;
      const failed = dayLogs.filter((l) => l.status === 'error').length;
      const avgLatency = total > 0 ? Math.round(dayLogs.reduce((s, l) => s + l.latency_ms, 0) / total) : 0;
      return {
        day: dayName,
        uptime: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
        failures: failed,
        latency: avgLatency,
      };
    });
    setChartData(data);
  };

  const getTotalApis = useCallback(() => apis.length, [apis]);
  const getActiveApis = useCallback(() => apis.filter((a) => a.is_active).length, [apis]);
  const getAvgUptime = useCallback(() =>
    apis.length > 0 ? (apis.reduce((s, a) => s + a.uptime_percent, 0) / apis.length).toFixed(1) : '100.0',
    [apis]
  );

  const todayLogs = recentLogs.filter((l) => new Date(l.checked_at).toDateString() === new Date().toDateString());
  const failedToday = todayLogs.filter((l) => l.status === 'error').length;
  const fallbacksToday = todayLogs.filter((l) => l.is_fallback).length;
  const avgLatency = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.latency_ms, 0) / recentLogs.length) : 0;

  const eventIcon = (type: string) => {
    switch (type) {
      case 'failure': return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'recovery': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'diagnosis': return <Brain className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your API health and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active APIs" value={getActiveApis()} subtitle={`${getTotalApis()} registered`} icon={Activity} color="sky" delay={0} trend={{ value: `${getTotalApis()} total`, positive: true }} />
        <StatCard title="Avg Uptime" value={`${getAvgUptime()}%`} subtitle="Last 30 days" icon={TrendingUp} color="emerald" delay={0.05} trend={{ value: 'stable', positive: true }} />
        <StatCard title="Failures Today" value={failedToday} subtitle="API errors" icon={AlertTriangle} color="red" delay={0.1} trend={{ value: failedToday > 0 ? 'needs attention' : 'all clear', positive: failedToday === 0 }} />
        <StatCard title="AI Fallbacks" value={fallbacksToday} subtitle="Saved today" icon={Brain} color="amber" delay={0.15} trend={{ value: `${avgLatency}ms avg`, positive: avgLatency < 500 }} />
      </div>


      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-6">Uptime (7 days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb' }} />
              <Area type="monotone" dataKey="uptime" stroke="#22d3ee" strokeWidth={2} fill="url(#uptimeGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-6">Avg Latency (ms)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e5e7eb' }} />
              <Bar dataKey="latency" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Quick status + recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300">API Status</h3>
            <Link to="/dashboard/apis" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {apis.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No APIs registered yet</p>
              <Link to="/dashboard/apis" className="text-sky-400 text-sm hover:underline mt-2 inline-block">Add your first API →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {apis.slice(0, 6).map((api) => {
                const live = liveApiStatus.get(api.id);
                const status = live?.status || api.last_status;
                const latency = live?.latency || api.last_latency_ms;
                const hasUpdate = !!live;

                return (
                  <motion.div
                    key={api.id}
                    initial={hasUpdate ? { scale: 1.02 } : {}}
                    animate={{ scale: 1 }}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${hasUpdate ? 'bg-sky-500/5' : ''}`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      status === 'success' ? 'bg-emerald-400' :
                      status === 'error' ? 'bg-red-400' :
                      status === 'degraded' ? 'bg-amber-400' : 'bg-gray-600'
                    } ${hasUpdate ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{api.name}</p>
                      <p className="text-xs text-gray-600 truncate">{api.url}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-mono ${hasUpdate ? 'text-sky-400' : 'text-gray-400'}`}>{latency}ms</p>
                      <p className="text-xs text-gray-600">{api.uptime_percent}% up</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-300">Recent Activity</h3>
            <Link to="/dashboard/logs" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {(liveLogs.length > 0 ? liveLogs : recentLogs).slice(0, 8).map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 py-1.5"
                >
                  {log.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">
                      {log.status === 'success' ? 'Check passed' : `Failed: ${log.error_message || 'Unknown error'}`}
                    </p>
                    <p className="text-xs text-gray-600">{new Date(log.checked_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.is_fallback && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">AI</span>
                    )}
                    <span className="text-xs font-mono text-gray-500">{log.latency_ms}ms</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
