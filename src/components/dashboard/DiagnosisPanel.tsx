import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, AlertTriangle, CheckCircle, XCircle, Copy, RefreshCw,
  ChevronDown, ChevronUp, Zap, Clock, Shield, AlertCircle
} from 'lucide-react';

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
  raw_error: {
    status_code: number | null;
    error_message: string;
    latency_ms: number;
  };
  created_at: string;
  explanation?: string;
}

interface DiagnosisPanelProps {
  diagnosis: Diagnosis | null;
  loading: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: AlertCircle },
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
};

const ACTION_LABELS: Record<string, string> = {
  retry: 'Retry Request',
  skip: 'Skip & Continue',
  escalate: 'Escalate to Admin',
  investigate: 'Investigate Further',
  disable: 'Disable API',
  contact_support: 'Contact Support',
};

export default function DiagnosisPanel({ diagnosis, loading, onRefresh, compact = false }: DiagnosisPanelProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!diagnosis) return;
    navigator.clipboard.writeText(JSON.stringify(diagnosis, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-sky-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Analyzing failure...</p>
            <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-500"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
        <Brain className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No diagnosis available</p>
        {onRefresh && (
          <button onClick={onRefresh} className="mt-2 text-xs text-sky-400 hover:text-sky-300">
            Request Diagnosis
          </button>
        )}
      </div>
    );
  }

  const sevConfig = SEVERITY_CONFIG[diagnosis.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;
  const SevIcon = sevConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${sevConfig.border} ${sevConfig.bg}`}
    >
      {/* Header */}
      <div
        className={`p-4 ${compact ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
        onClick={compact ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${sevConfig.bg} ${sevConfig.border} border flex items-center justify-center shrink-0`}>
            <Brain className={`w-5 h-5 ${sevConfig.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${sevConfig.color} ${sevConfig.bg} border ${sevConfig.border}`}>
                {diagnosis.severity}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                diagnosis.recommended_action === 'retry' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                diagnosis.recommended_action === 'disable' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-gray-500/10 border-gray-500/20 text-gray-400'
              }`}>
                {ACTION_LABELS[diagnosis.recommended_action] || diagnosis.recommended_action}
              </span>
              {diagnosis.provider_used && (
                <span className="text-xs text-gray-600">{diagnosis.provider_used}</span>
              )}
            </div>
            <p className="text-sm text-white font-medium">{diagnosis.diagnosis}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-xs text-gray-500">Confidence</p>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${sevConfig.bg.replace('/10', '')}`}
                    style={{ width: `${diagnosis.confidence * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono ${sevConfig.color}`}>
                  {Math.round(diagnosis.confidence * 100)}%
                </span>
              </div>
            </div>
            {compact && (expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />)}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-4 space-y-4">
              {/* Category & Error */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-gray-500">Category</p>
                  <p className="text-gray-300 capitalize mt-0.5">{diagnosis.failure_category}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-gray-500">Status Code</p>
                  <p className="text-gray-300 mt-0.5 font-mono">{diagnosis.raw_error?.status_code || 'N/A'}</p>
                </div>
              </div>

              {/* Suggested Fix */}
              {diagnosis.suggested_fix && (
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Suggested Fix</span>
                  </div>
                  <p className="text-xs text-gray-300">{diagnosis.suggested_fix}</p>
                </div>
              )}

              {/* Explanation */}
              {diagnosis.explanation && (
                <div className="p-3 rounded-lg bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-400">Analysis</span>
                  </div>
                  <p className="text-xs text-gray-400">{diagnosis.explanation}</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] text-gray-600">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(diagnosis.created_at).toLocaleString()}
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
