import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[min(92vw,380px)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`card pointer-events-auto flex animate-fade-up items-start gap-3 px-4 py-3 text-sm shadow-lift ${
              toast.type === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-teal-200/70 bg-white text-ink"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle size={18} className="mt-0.5 flex-none text-red-600" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 flex-none text-civic" />
            )}
            <span className="flex-1 leading-5">{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-md p-1 transition hover:bg-black/5"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
