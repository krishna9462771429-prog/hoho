import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Brain } from 'lucide-react';

interface LogEntry {
  id: string;
  api_id: string;
  api_name?: string;
  status: string;
  status_code: number | null;
  latency_ms: number;
  error_message?: string;
  is_fallback?: boolean;
  checked_at: string;
}

interface LiveLogFeedProps {
  logs: LogEntry[];
  maxVisible?: number;
}

export default function LiveLogFeed({ logs, maxVisible = 10 }: LiveLogFeedProps) {
  const visibleLogs = logs.slice(-maxVisible).reverse();

  return (
    <div className="space-y-2 font-mono text-xs">
      <AnimatePresence initial={false}>
        {visibleLogs.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className={`p-2.5 rounded-lg border ${
              log.status === 'success'
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-red-500/5 border-red-500/15'
            }`}
          >
            <div className="flex items-start gap-2">
              {log.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                    {log.api_name || log.api_id.slice(0, 8)}
                  </span>
                  <span className="text-gray-600">
                    {log.status_code ? `${log.status_code}` : 'ERR'}
                  </span>
                  <span className="text-gray-600">{log.latency_ms}ms</span>
                  {log.is_fallback && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Brain className="w-3 h-3" />
                      AI
                    </span>
                  )}
                </div>
                {log.error_message && (
                  <p className="text-gray-500 truncate">{log.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-1 text-gray-600 shrink-0">
                <Clock className="w-3 h-3" />
                {new Date(log.checked_at).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {visibleLogs.length === 0 && (
        <div className="text-center py-4 text-gray-600">
          Waiting for events...
        </div>
      )}
    </div>
  );
}
