import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Zap, Shield, GitMerge, Brain, Activity, BarChart3, Timer,
  ChevronRight, Check, ArrowRight, Globe, AlertCircle, RefreshCw,
  Cpu, Network, TrendingUp, Lock
} from 'lucide-react';

const FEATURES = [
  {
    icon: Activity,
    title: 'API Health Monitoring',
    description: 'Real-time uptime tracking, latency measurement, and failure detection across all your endpoints.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Brain,
    title: 'AI-Powered Fallbacks',
    description: 'When APIs fail, Groq & Gemini generate intelligent fallback responses to keep your app running.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
  {
    icon: GitMerge,
    title: 'API Orchestration',
    description: 'Merge multiple APIs into one unified endpoint. Define workflows and call them with a single request.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: Cpu,
    title: 'AI Format Generator',
    description: 'Describe your needs in plain English. AI generates JSON schemas, integration formats, and workflows.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    icon: Timer,
    title: 'Keep-Alive Ticker',
    description: 'Prevent Render & Vercel deployments from sleeping with automated ping intervals.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Heatmaps',
    description: 'Deep insights into uptime trends, failure patterns, latency charts, and AI usage statistics.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
  },
];

const PRICING = [
  {
    name: 'Starter',
    price: 0,
    features: ['5 API endpoints', '1,000 checks/month', 'Basic monitoring', 'Email alerts', '7-day log retention'],
    cta: 'Get Started Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 29,
    features: ['50 API endpoints', '100,000 checks/month', 'AI fallbacks', 'Discord + Email alerts', '90-day retention', 'API merge workflows', 'Keep-alive ticker'],
    cta: 'Start Pro Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 99,
    features: ['Unlimited APIs', 'Unlimited checks', 'Priority AI models', 'Custom webhooks', '1-year retention', 'SLA guarantee', 'Dedicated support'],
    cta: 'Contact Sales',
    highlight: false,
  },
];

const STATS = [
  { value: '99.9%', label: 'Platform Uptime' },
  { value: '< 50ms', label: 'Detection Latency' },
  { value: '10M+', label: 'API Checks Monthly' },
  { value: '3s', label: 'Avg AI Fallback Time' },
];

function GlowOrb({ className }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`} />
  );
}

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.6]);

  return (
    <div className="min-h-screen bg-[#060810] text-white overflow-x-hidden">
      <AnimatedGrid />
      <GlowOrb className="w-[600px] h-[600px] bg-sky-500 -top-40 -left-40" />
      <GlowOrb className="w-[500px] h-[500px] bg-emerald-500 top-1/3 -right-40" />
      <GlowOrb className="w-[400px] h-[400px] bg-amber-500 bottom-1/4 left-1/4" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#060810]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
              <Network className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
              APIMerge
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 hover:opacity-90 transition-opacity text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 px-6">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-medium mb-8"
          >
            <Zap className="w-4 h-4" />
            AI-Powered API Reliability Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6"
          >
            One Platform for
            <br />
            <span className="bg-gradient-to-r from-sky-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              All Your APIs
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Monitor uptime, merge endpoints, get AI fallbacks when APIs fail, and orchestrate
            complex workflows — all from one beautiful dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/signup"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 font-semibold hover:opacity-90 transition-all shadow-lg shadow-sky-500/25 text-white"
            >
              Start for Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-medium text-gray-300"
            >
              <Activity className="w-4 h-4" />
              View Dashboard Demo
            </Link>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#060810] to-transparent z-10 pointer-events-none bottom-0 h-1/3 top-auto" />
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm p-4 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <div className="flex-1 mx-4 h-6 rounded-md bg-white/5 flex items-center px-3">
                  <span className="text-xs text-gray-500">app.apimerge.io/dashboard</span>
                </div>
              </div>
              <DashboardPreview />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-20 px-6 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-6"
            >
              <Shield className="w-4 h-4" />
              Enterprise-Grade Features
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Everything You Need
            </motion.h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              From simple health checks to complex AI-powered orchestration — APIMerge handles it all.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className={`p-6 rounded-2xl border backdrop-blur-sm hover:scale-[1.02] transition-transform cursor-default ${feature.bg}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white/5 ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Fallback Explainer */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-medium mb-6">
                <Brain className="w-4 h-4" />
                AI Fallback System
              </div>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                APIs Fail.<br />
                <span className="text-sky-400">We Don't.</span>
              </h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                When your APIs go down, APIMerge automatically generates intelligent fallback
                responses using Groq LLaMA and Google Gemini. Your users never see an error page.
              </p>
              <ul className="space-y-3">
                {['Instant AI response generation', 'Contextual failure explanations', 'Groq primary → Gemini fallback', 'Full fallback audit trail', 'Custom fallback templates'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 font-mono text-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-xs font-semibold">API FAILURE DETECTED</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-600 shrink-0">→</span>
                    <span className="text-amber-400">Endpoint: https://api.payments.io/v1/charge</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-gray-600 shrink-0">→</span>
                    <span className="text-red-400">Status: 503 Service Unavailable</span>
                  </div>
                  <div className="border-t border-white/10 my-3" />
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                    <span className="text-sky-400">Invoking Groq LLaMA-3.1...</span>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-emerald-400 font-semibold mb-2">AI Fallback Response:</div>
                    <pre className="text-gray-300 whitespace-pre-wrap">
{`{
  "status": "fallback",
  "provider": "groq",
  "data": {
    "transaction_id": "fb_8x9k2",
    "message": "Payment queued for retry",
    "retry_after": 30
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-gray-400">Start free. Scale as you grow.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlight
                    ? 'border-sky-500/50 bg-gradient-to-br from-sky-500/10 to-emerald-500/10 shadow-lg shadow-sky-500/10'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 text-xs font-bold text-white">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">${plan.price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`w-full text-center py-3 rounded-xl font-semibold transition-all text-sm ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-sky-500 to-emerald-500 text-white hover:opacity-90 shadow-lg shadow-sky-500/25'
                      : 'border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-emerald-500/5 to-teal-500/10 p-16"
        >
          <Lock className="w-12 h-12 text-sky-400 mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-4">Ready to Bulletproof Your APIs?</h2>
          <p className="text-gray-400 mb-8 text-lg">
            Join teams that trust APIMerge for zero-downtime API reliability.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 font-semibold hover:opacity-90 transition-all shadow-lg shadow-sky-500/25 text-white"
          >
            Get Started Free
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
              <Network className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-gray-300">APIMerge</span>
          </div>
          <p className="text-sm text-gray-600">© 2025 APIMerge. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid grid-cols-4 gap-3 text-xs">
      {[
        { label: 'Active APIs', value: '24', change: '+3', color: 'text-emerald-400' },
        { label: 'Avg Uptime', value: '99.7%', change: '+0.1%', color: 'text-sky-400' },
        { label: 'AI Fallbacks', value: '12', change: '-2', color: 'text-amber-400' },
        { label: 'Avg Latency', value: '142ms', change: '-8ms', color: 'text-teal-400' },
      ].map((kpi) => (
        <div key={kpi.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-gray-500 mb-1">{kpi.label}</div>
          <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
          <div className="text-gray-600 text-[10px]">{kpi.change} today</div>
        </div>
      ))}
      <div className="col-span-4 bg-white/5 rounded-xl p-3 border border-white/5">
        <div className="text-gray-500 mb-3">API Status Overview</div>
        <div className="space-y-2">
          {[
            { name: 'payments.api.io/v1', status: 'healthy', latency: '89ms' },
            { name: 'auth.service.com', status: 'healthy', latency: '34ms' },
            { name: 'analytics.io/events', status: 'degraded', latency: '890ms' },
            { name: 'maps.api.com/geo', status: 'down', latency: 'timeout' },
          ].map((api) => (
            <div key={api.name} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                api.status === 'healthy' ? 'bg-emerald-400' :
                api.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className="text-gray-400 flex-1 truncate">{api.name}</span>
              <span className={`font-mono ${
                api.status === 'healthy' ? 'text-emerald-400' :
                api.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
              }`}>{api.latency}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
