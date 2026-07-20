import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { setGlobalToast } from "../api/client";

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: {
    bg: "bg-emerald-600/90 backdrop-blur-lg border-emerald-500/30",
    icon: CheckCircle2,
  },
  error: {
    bg: "bg-red-600/90 backdrop-blur-lg border-red-500/30",
    icon: XCircle,
  },
  warning: {
    bg: "bg-amber-600/90 backdrop-blur-lg border-amber-500/30",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-sky-600/90 backdrop-blur-lg border-sky-500/30",
    icon: Info,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, { type = "info", duration = 3500 } = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // Wire up the global toast function so the API client can show toasts
  useEffect(() => {
    setGlobalToast(push);
    return () => setGlobalToast(null);
  }, [push]);

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <div className="fixed right-5 top-5 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            const Icon = style.icon;

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="pointer-events-auto"
              >
                <div
                  className={`min-w-[260px] max-w-sm px-4 py-3.5 rounded-2xl shadow-2xl text-sm text-white border ${style.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={18} className="shrink-0 mt-0.5 opacity-90" />
                    <div className="flex-1 font-medium leading-snug">{toast.message}</div>
                    <button
                      onClick={() => remove(toast.id)}
                      className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.push;
}
