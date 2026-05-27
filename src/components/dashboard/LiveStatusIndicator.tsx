import React from 'react';
import { motion } from 'framer-motion';

interface LiveStatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting';
  label?: string;
}

export default function LiveStatusIndicator({ status, label }: LiveStatusIndicatorProps) {
  const config = {
    connected: { dot: 'bg-emerald-400', glow: 'bg-emerald-400/30', text: 'text-emerald-400', label: 'Live' },
    disconnected: { dot: 'bg-red-400', glow: 'bg-red-400/30', text: 'text-red-400', label: 'Offline' },
    connecting: { dot: 'bg-amber-400', glow: 'bg-amber-400/30', text: 'text-amber-400', label: 'Connecting...' },
  }[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        {status === 'connected' && (
          <motion.div
            className={`absolute inset-0 rounded-full ${config.glow}`}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div className={`w-2 h-2 rounded-full ${config.dot} relative z-10`} />
      </div>
      <span className={`text-xs font-medium ${config.text}`}>
        {label || config.label}
      </span>
    </div>
  );
}
