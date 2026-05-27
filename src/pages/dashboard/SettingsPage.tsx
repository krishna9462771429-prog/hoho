import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Bell, Brain, Webhook, Mail, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { UserSettings } from '../../lib/types';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle();
    if (data) setSettings(data);
    setLoading(false);
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
