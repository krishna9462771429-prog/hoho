import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  color?: 'sky' | 'emerald' | 'amber' | 'red' | 'teal';
  delay?: number;
}

const colorMap = {
  sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
};

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'sky', delay = 0 }: Props) {
  const colors = colorMap[color];
  const [textColor, bgColor, borderColor] = colors.split(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bgColor} ${borderColor}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {trend.value}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold mb-1 ${textColor}`}>{value}</div>
      <div className="text-sm font-medium text-gray-400">{title}</div>
      {subtitle && <div className="text-xs text-gray-600 mt-1">{subtitle}</div>}
    </motion.div>
  );
}
