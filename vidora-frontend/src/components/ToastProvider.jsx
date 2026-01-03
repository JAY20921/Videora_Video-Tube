import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, { type = "info", duration = 3500 } = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      <div className="fixed right-5 top-5 z-50 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div
                className={`min-w-[220px] max-w-sm px-4 py-3 rounded-lg shadow-lg text-sm ${
                  toast.type === "error" ? "bg-red-600 text-white" : "bg-neutral-800 text-gray-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>{toast.message}</div>
                  <button onClick={() => remove(toast.id)} className="opacity-70 hover:opacity-100">✕</button>
                </div>
              </div>
            </motion.div>
          ))}
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
