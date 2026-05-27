import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Toast as ToastType } from '../../hooks/useToast';

const icons = {
  success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  info: <Info className="w-5 h-5 text-sky-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
};

const colors = {
  success: 'border-emerald-500/30 bg-emerald-900/20',
  error: 'border-red-500/30 bg-red-900/20',
  info: 'border-sky-500/30 bg-sky-900/20',
  warning: 'border-amber-500/30 bg-amber-900/20',
};

interface Props {
  toasts: ToastType[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl ${colors[toast.type]} shadow-2xl`}
          >
            {icons[toast.type]}
            <p className="text-sm text-gray-200 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
