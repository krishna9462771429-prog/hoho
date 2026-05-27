import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Workflow, Brain, Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useToastContext } from '../../contexts/ToastContext';

const EXAMPLES = [
  'Auth API + Payment API + Analytics API',
  'Weather API + Maps API for location-based services',
  'User profile + Notification + Email service',
];

const PRESETS = [
  {
    label: 'Format Generator',
    placeholder: 'Generate frontend integration format for weather API and payment API',
    type: 'format',
  },
  {
    label: 'Workflow Designer',
    placeholder: 'I want auth API + payment API + analytics API working together',
    type: 'workflow',
  },
  {
    label: 'Schema Builder',
    placeholder: 'Build a unified response schema for user profile and order history APIs',
    type: 'schema',
  },
];

interface GeneratedResult {
  type: string;
  content: string;
  prompt: string;
}

export default function WorkflowsPage() {
  const { toast } = useToastContext();
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const generate = async () => {
    if (!prompt.trim()) {
      toast('Please describe what you want to generate', 'error');
      return;
    }
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type: PRESETS[selectedPreset].type }),
      });
      if (!res.ok) throw new Error('AI generation failed');
      const data = await res.json();
      setResults((prev) => [{ type: PRESETS[selectedPreset].type, content: data.result || data.content || JSON.stringify(data, null, 2), prompt }, ...prev]);
      setExpandedIdx(0);
      toast('Generated successfully!', 'success');
    } catch {
      // Fallback: generate locally
      const fallback = generateFallback(PRESETS[selectedPreset].type, prompt);
      setResults((prev) => [{ type: PRESETS[selectedPreset].type, content: fallback, prompt }, ...prev]);
      setExpandedIdx(0);
      toast('Generated (local mode)', 'info');
    } finally {
      setLoading(false);
    }
  };

  const generateFallback = (type: string, userPrompt: string): string => {
    if (type === 'format') {
      return JSON.stringify({
        integration: {
          description: `Integration format for: ${userPrompt}`,
          request: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer {token}' },
            body: { data: '{}', timestamp: '${Date.now()}' },
          },
          response: {
            success: { status: 200, data: {}, message: 'OK' },
            error: { status: '4xx', message: 'string', code: 'string' },
          },
          example: `fetch('/api/unified', { method: 'POST', body: JSON.stringify({}) })`,
        },
      }, null, 2);
    }
    if (type === 'workflow') {
      return JSON.stringify({
        workflow: {
          name: 'Generated Workflow',
          description: userPrompt,
          steps: [
            { step: 1, name: 'Authentication', endpoint: '/auth/token', method: 'POST', depends_on: [] },
            { step: 2, name: 'Main Request', endpoint: '/api/main', method: 'GET', depends_on: [1] },
            { step: 3, name: 'Analytics Track', endpoint: '/analytics/event', method: 'POST', depends_on: [2] },
          ],
          merge_strategy: 'sequential',
          error_handling: 'retry_with_backoff',
          timeout_ms: 10000,
        },
      }, null, 2);
    }
    return JSON.stringify({
      schema: {
        description: userPrompt,
        type: 'object',
        properties: {
          id: { type: 'string' },
          data: { type: 'object' },
          metadata: { type: 'object', properties: { source: { type: 'string' }, timestamp: { type: 'string' } } },
        },
        required: ['id', 'data'],
      },
    }, null, 2);
  };

  const copyResult = (content: string) => {
    navigator.clipboard.writeText(content);
    toast('Copied to clipboard', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Workflows & Format Generator</h1>
        <p className="text-gray-500 text-sm mt-1">Describe your needs — AI generates schemas, workflows, and integrations</p>
      </div>

      {/* Preset Tabs */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p, i) => (
          <button
            key={p.type}
            onClick={() => { setSelectedPreset(i); setPrompt(''); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedPreset === i
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-white/5 text-gray-500 hover:text-gray-300 border border-white/10'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-white">{PRESETS[selectedPreset].label}</h3>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={PRESETS[selectedPreset].placeholder}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 transition-all resize-none placeholder-gray-600 mb-4"
        />

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-600">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-500 hover:text-sky-400 hover:border-sky-500/30 transition-all"
            >
              {ex}
            </button>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg shadow-sky-500/20"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </motion.div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400">Generated Results</h3>
          {results.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-white capitalize">{r.type} Generation</p>
                    <p className="text-xs text-gray-600 truncate max-w-xs">{r.prompt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyResult(r.content); }}
                    className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {expandedIdx === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>
              <AnimatePresence>
                {expandedIdx === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10"
                  >
                    <pre className="p-4 text-xs text-gray-300 font-mono overflow-auto max-h-96 bg-black/20">
                      {r.content}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
