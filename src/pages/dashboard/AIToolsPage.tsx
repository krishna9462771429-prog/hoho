import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, Copy, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { Api } from '../../lib/types';

interface FallbackTest {
  apiName: string;
  failureReason: string;
  provider: string;
  response: string;
  latency: number;
}

export default function AIToolsPage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [failureDesc, setFailureDesc] = useState('');
  const [apiContext, setApiContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FallbackTest | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'groq' | 'gemini'>('groq');

  const generateFallback = async () => {
    if (!failureDesc.trim()) {
      toast('Please describe the API failure', 'error');
      return;
    }
    setLoading(true);
    setResult(null);
    const start = Date.now();
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/ai/fallback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failure_reason: failureDesc, api_context: apiContext, provider: selectedProvider }),
      });
      if (!res.ok) throw new Error('Backend unavailable');
      const data = await res.json();
      const latency = Date.now() - start;
      setResult({ apiName: apiContext || 'Unknown API', failureReason: failureDesc, provider: data.provider || selectedProvider, response: JSON.stringify(data.response, null, 2), latency });
      toast('AI fallback generated', 'success');
    } catch {
      // Demo fallback
      const latency = Date.now() - start;
      const mockResponse = {
        status: 'fallback',
        provider: selectedProvider,
        generated_at: new Date().toISOString(),
        message: `AI-generated fallback response for: ${failureDesc}`,
        data: { fallback: true, reason: failureDesc, retry_after: 30 },
        explanation: `The API failed due to: ${failureDesc}. An intelligent fallback was generated to maintain service continuity.`,
      };
      setResult({ apiName: apiContext || 'Test API', failureReason: failureDesc, provider: selectedProvider, response: JSON.stringify(mockResponse, null, 2), latency });
      if (user) {
        await supabase.from('ai_fallbacks').insert({
          user_id: user.id,
          provider: selectedProvider,
          failure_reason: failureDesc,
          response: mockResponse,
          latency_ms: latency,
        });
      }
      toast('AI fallback generated (demo mode)', 'info');
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (result) {
      navigator.clipboard.writeText(result.response);
      toast('Copied to clipboard', 'success');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Tools</h1>
        <p className="text-gray-500 text-sm mt-1">Test AI fallback generation and explain API failures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fallback Generator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Brain className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-white">AI Fallback Tester</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">API / Service Name</label>
              <input
                value={apiContext}
                onChange={(e) => setApiContext(e.target.value)}
                placeholder="e.g., Stripe Payment API"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Failure Description *</label>
              <textarea
                value={failureDesc}
                onChange={(e) => setFailureDesc(e.target.value)}
                placeholder="503 Service Unavailable - database connection timeout"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">AI Provider</label>
              <div className="flex gap-2">
                {(['groq', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedProvider(p)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                      selectedProvider === p
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-white/5 text-gray-500 border border-white/10 hover:text-gray-300'
                    }`}
                  >
                    {p === 'groq' ? 'Groq LLaMA' : 'Google Gemini'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateFallback}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-lg shadow-sky-500/20"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Generate Fallback'}
            </button>
          </div>
        </motion.div>

        {/* Result */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Generated Response</h3>
            </div>
            {result && (
              <button onClick={copyResponse} className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>

          {!result ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <AlertCircle className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-gray-600 text-sm">Generate a fallback response to see the result</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                  {result.provider}
                </span>
                <span className="text-gray-600">{result.latency}ms</span>
                <span className="text-gray-600 truncate">{result.apiName}</span>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                <pre className="p-4 text-xs text-gray-300 font-mono overflow-auto max-h-64">
                  {result.response}
                </pre>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* How AI Fallbacks Work */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <h3 className="font-semibold text-white mb-4">How AI Fallbacks Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Failure Detection',
              desc: 'APIMerge detects API failures via monitoring. When retries exceed the limit, fallback is triggered.',
              color: 'text-red-400',
            },
            {
              step: '02',
              title: 'AI Generation',
              desc: 'Groq LLaMA-3.1 generates a contextually intelligent response. If Groq fails, Gemini takes over.',
              color: 'text-sky-400',
            },
            {
              step: '03',
              title: 'Response Delivery',
              desc: 'The AI response is cached, returned to the client, and logged with the failure explanation.',
              color: 'text-emerald-400',
            },
          ].map((item) => (
            <div key={item.step} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className={`text-2xl font-black ${item.color} mb-2 opacity-50`}>{item.step}</div>
              <h4 className="font-semibold text-white text-sm mb-1">{item.title}</h4>
              <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
