import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, RefreshCw, CheckCircle, XCircle, Brain, Clock, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ApiLog, Api } from '../../lib/types';
import LiveStatusIndicator from '../../components/dashboard/LiveStatusIndicator';

const PAGE_SIZE = 20;

export default function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [apis, setApis] = useState<Api[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [apiFilter, setApiFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) fetchApis(); }, [user]);
  useEffect(() => { if (user) fetchLogs(); }, [user, page, statusFilter, apiFilter]);

  const fetchApis = async () => {
    const { data } = await supabase.from('apis').select('id, name').eq('user_id', user!.id);
    if (data) setApis(data as Api[]);
  };

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from('api_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user!.id)
      .order('checked_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (apiFilter !== 'all') query = query.eq('api_id', apiFilter);

    const { data, count } = await query;
    if (data) setLogs(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  };

  const filtered = search.trim()
    ? logs.filter((l) =>
        l.error_message?.toLowerCase().includes(search.toLowerCase()) ||
        l.status?.toLowerCase().includes(search.toLowerCase()) ||
        String(l.status_code).includes(search)
      )
    : logs;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const apiMap = Object.fromEntries(apis.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs</h1>
          <p className="text-gray-500 text-sm mt-1">{total.toLocaleString()} total entries</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchLogs} className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all placeholder-gray-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm focus:outline-none focus:border-sky-500/50 transition-all"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <select
          value={apiFilter}
          onChange={(e) => { setApiFilter(e.target.value); setPage(0); }}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm focus:outline-none focus:border-sky-500/50 transition-all"
        >
          <option value="all">All APIs</option>
          {apis.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>


      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">API</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">Code</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">Latency</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">Details</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-600">No logs found</td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                              {log.status}
                            </span>
                            {log.is_fallback && (
                              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Brain className="w-3 h-3" />
                                AI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-gray-400 text-xs">{apiMap[log.api_id] || log.api_id.slice(0, 8)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`font-mono text-xs font-medium ${
                            log.status_code && log.status_code < 400 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {log.status_code ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`font-mono text-xs ${
                            log.latency_ms < 500 ? 'text-emerald-400' : log.latency_ms < 1000 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {log.latency_ms}ms
                          </span>
                        </td>
                        <td className="px-5 py-3 max-w-xs">
                          <span className="text-gray-500 text-xs truncate block" title={log.error_message || log.response_body}>
                            {log.error_message || (log.response_body ? log.response_body.slice(0, 60) : '—')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 text-gray-600 text-xs">
                            <Clock className="w-3 h-3" />
                            {new Date(log.checked_at).toLocaleString()}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-white/5 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-600">
              Page {page + 1} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      <div ref={logsEndRef} />
    </div>
  );
}
