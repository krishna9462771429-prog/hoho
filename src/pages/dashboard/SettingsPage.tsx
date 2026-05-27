import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Bell, Brain, Webhook, Mail, Shield, Key, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { UserSettings, BYOKCredentials } from '../../lib/types';
import apiClient from '../../services/apiClient';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToastContext();
  const [settings, setSettings] = useState<Partial<UserSettings>>({
    default_timeout: 5000,
    default_retries: 3,
    ai_provider: 'groq',
    alert_email_enabled: true,
    alert_discord_enabled: false,
    discord_webhook_url: '',
    notification_email: '',
  });
  const [byok, setByok] = useState<BYOKCredentials>({
    groq_key_masked: null,
    gemini_key_masked: null,
    groq_source: 'platform',
    gemini_source: 'platform',
    use_personal_ai_keys: false,
    has_groq_key: false,
    has_gemini_key: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [byokSaving, setByokSaving] = useState(false);

  // BYOK field states
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [validatingGroq, setValidatingGroq] = useState(false);
  const [validatingGemini, setValidatingGemini] = useState(false);
  const [groqValid, setGroqValid] = useState<boolean | null>(null);
  const [geminiValid, setGeminiValid] = useState<boolean | null>(null);

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle();
    if (data) setSettings(data);
    await fetchByokCredentials();
    setLoading(false);
  };

  const fetchByokCredentials = async () => {
    try {
      const resp = await apiClient.get('/ai/byok/credentials');
      setByok(resp.data);
    } catch {
      // Silently fail - BYOK may not be configured
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from('user_settings').select('id').eq('user_id', user!.id).maybeSingle();
    const payload = { ...settings, user_id: user!.id, updated_at: new Date().toISOString() };
    let error;
    if (existing) {
      ({ error } = await supabase.from('user_settings').update(payload).eq('user_id', user!.id));
    } else {
      ({ error } = await supabase.from('user_settings').insert(payload));
    }
    if (error) toast(error.message, 'error');
    else toast('Settings saved', 'success');
    setSaving(false);
  };

  const handleByokToggle = async (enabled: boolean) => {
    setByokSaving(true);
    try {
      const resp = await apiClient.post('/ai/byok/update', {
        use_personal_ai_keys: enabled,
      });
      setByok(resp.data);
      toast(enabled ? 'Personal AI keys enabled' : 'Using platform keys', 'success');
    } catch (err) {
      toast('Failed to update BYOK settings', 'error');
    }
    setByokSaving(false);
  };

  const validateKey = async (provider: 'groq' | 'gemini', key: string) => {
    if (!key.trim()) return;
    if (provider === 'groq') {
      setValidatingGroq(true);
      setGroqValid(null);
    } else {
      setValidatingGemini(true);
      setGeminiValid(null);
    }

    try {
      const resp = await apiClient.post('/ai/byok/validate', { provider, api_key: key });
      if (provider === 'groq') {
        setGroqValid(resp.data.valid);
        if (resp.data.valid) toast('Groq API key is valid', 'success');
        else toast(resp.data.error || 'Invalid Groq key', 'error');
      } else {
        setGeminiValid(resp.data.valid);
        if (resp.data.valid) toast('Gemini API key is valid', 'success');
        else toast(resp.data.error || 'Invalid Gemini key', 'error');
      }
    } catch {
      if (provider === 'groq') setGroqValid(false);
      else setGeminiValid(false);
      toast('Validation failed', 'error');
    }

    if (provider === 'groq') setValidatingGroq(false);
    else setValidatingGemini(false);
  };

  const saveApiKey = async (provider: 'groq' | 'gemini', key: string) => {
    if (!key.trim()) return;
    setByokSaving(true);
    try {
      const payload = {
        use_personal_ai_keys: true,
        ...(provider === 'groq' ? { groq_api_key: key } : { gemini_api_key: key }),
      };
      const resp = await apiClient.post('/ai/byok/update', payload);
      setByok(resp.data);
      toast(`${provider === 'groq' ? 'Groq' : 'Gemini'} key saved`, 'success');
      if (provider === 'groq') setGroqKey('');
      else setGeminiKey('');
    } catch {
      toast('Failed to save API key', 'error');
    }
    setByokSaving(false);
  };

  const deleteApiKey = async (provider: 'groq' | 'gemini') => {
    setByokSaving(true);
    try {
      const resp = await apiClient.delete(`/ai/byok/key/${provider}`);
      setByok(resp.data);
      toast(`${provider === 'groq' ? 'Groq' : 'Gemini'} key removed`, 'success');
    } catch {
      toast('Failed to delete API key', 'error');
    }
    setByokSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure monitoring, AI, and alert preferences</p>
      </div>

      {/* Monitoring Defaults */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-white">Monitoring Defaults</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Default Timeout (ms)</label>
            <input
              type="number"
              value={settings.default_timeout}
              onChange={(e) => setSettings({ ...settings, default_timeout: Number(e.target.value) })}
              min={1000} max={60000}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Default Retries</label>
            <input
              type="number"
              value={settings.default_retries}
              onChange={(e) => setSettings({ ...settings, default_retries: Number(e.target.value) })}
              min={0} max={10}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>
      </motion.div>

      {/* BYOK - Bring Your Own Key */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Key className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">Personal AI Keys (BYOK)</h3>
          <span className="ml-auto text-xs text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full">Optional</span>
        </div>

        <div className="flex items-center justify-between py-2 mb-4">
          <div>
            <p className="text-sm font-medium text-white">Use Personal API Keys</p>
            <p className="text-xs text-gray-500">Override platform keys with your own Groq/Gemini keys</p>
          </div>
          <button
            onClick={() => handleByokToggle(!byok.use_personal_ai_keys)}
            disabled={byokSaving}
            className={`relative w-12 h-6 rounded-full transition-colors ${byok.use_personal_ai_keys ? 'bg-amber-500' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${byok.use_personal_ai_keys ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {byok.use_personal_ai_keys && (
          <div className="space-y-4 pt-2 border-t border-white/5">
            {/* Groq Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400">Groq API Key</label>
                {byok.groq_key_masked && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">{byok.groq_key_masked}</span>
                    <span className={`text-xs ${byok.groq_source === 'user' ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {byok.groq_source === 'user' ? '(personal)' : '(platform)'}
                    </span>
                    {byok.has_groq_key && byok.groq_source === 'user' && (
                      <button
                        onClick={() => deleteApiKey('groq')}
                        disabled={byokSaving}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => { setGroqKey(e.target.value); setGroqValid(null); }}
                    placeholder="gsk_..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => validateKey('groq', groqKey)}
                  disabled={!groqKey.trim() || validatingGroq}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
                >
                  {validatingGroq ? <Loader2 className="w-4 h-4 animate-spin" /> : groqValid === true ? <Check className="w-4 h-4 text-emerald-400" /> : groqValid === false ? <X className="w-4 h-4 text-red-400" /> : 'Test'}
                </button>
                <button
                  onClick={() => saveApiKey('groq', groqKey)}
                  disabled={!groqKey.trim() || byokSaving}
                  className="px-3 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Gemini Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400">Gemini API Key</label>
                {byok.gemini_key_masked && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">{byok.gemini_key_masked}</span>
                    <span className={`text-xs ${byok.gemini_source === 'user' ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {byok.gemini_source === 'user' ? '(personal)' : '(platform)'}
                    </span>
                    {byok.has_gemini_key && byok.gemini_source === 'user' && (
                      <button
                        onClick={() => deleteApiKey('gemini')}
                        disabled={byokSaving}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => { setGeminiKey(e.target.value); setGeminiValid(null); }}
                    placeholder="AIza..."
                    className="w-full px-3 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/50 placeholder-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => validateKey('gemini', geminiKey)}
                  disabled={!geminiKey.trim() || validatingGemini}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors"
                >
                  {validatingGemini ? <Loader2 className="w-4 h-4 animate-spin" /> : geminiValid === true ? <Check className="w-4 h-4 text-emerald-400" /> : geminiValid === false ? <X className="w-4 h-4 text-red-400" /> : 'Test'}
                </button>
                <button
                  onClick={() => saveApiKey('gemini', geminiKey)}
                  disabled={!geminiKey.trim() || byokSaving}
                  className="px-3 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Your keys are stored encrypted and never exposed in full. When enabled, your personal keys take priority over platform keys.
            </p>
          </div>
        )}
      </motion.div>

      {/* AI Provider */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Brain className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">AI Provider Preferences</h3>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-2 block">Primary AI Provider</label>
          <div className="flex gap-2">
            {[
              { value: 'groq', label: 'Groq LLaMA (Primary)' },
              { value: 'gemini', label: 'Google Gemini' },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setSettings({ ...settings, ai_provider: p.value })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  settings.ai_provider === p.value
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10 hover:text-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">If primary fails, APIMerge automatically falls back to the other provider.</p>
        </div>
      </motion.div>

      {/* Alert Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Alert Notifications</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-white">Email Alerts</p>
              <p className="text-xs text-gray-500">Get notified when APIs go down</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, alert_email_enabled: !settings.alert_email_enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.alert_email_enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.alert_email_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          {settings.alert_email_enabled && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Notification Email</label>
              <input
                type="email"
                value={settings.notification_email}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                placeholder="alerts@example.com"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
              />
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <div>
              <p className="text-sm font-medium text-white">Discord Webhook</p>
              <p className="text-xs text-gray-500">Send alerts to Discord channel</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, alert_discord_enabled: !settings.alert_discord_enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.alert_discord_enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.alert_discord_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          {settings.alert_discord_enabled && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Discord Webhook URL</label>
              <input
                value={settings.discord_webhook_url}
                onChange={(e) => setSettings({ ...settings, discord_webhook_url: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-sky-500/50 placeholder-gray-700"
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-teal-400" />
          <h3 className="font-semibold text-white">Account</h3>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-xs text-gray-500">Signed in as</p>
          <p className="text-sm text-white mt-0.5">{user?.email}</p>
        </div>
      </motion.div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-medium hover:opacity-90 disabled:opacity-50 shadow-lg shadow-sky-500/20"
      >
        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
