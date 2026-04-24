"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { sheetVariants } from "@/lib/motion";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Focus the search bar" },
  { keys: ["j", "↓"], label: "Move to next result" },
  { keys: ["k", "↑"], label: "Move to previous result" },
  { keys: ["↵"], label: "Open focused result in a new tab" },
  { keys: ["Esc"], label: "Clear focus" },
  { keys: ["?"], label: "Toggle this help" },
];

export function ShortcutHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-help-title"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shortcut-modal w-full"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 id="shortcut-help-title" className="text-[15px] font-semibold text-slate-900 tracking-tight">
                  Keyboard shortcuts
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Navigate ThreadSeeker without leaving the keyboard.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 -mr-1 -mt-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-px w-full bg-indigo-100/80 mb-4" aria-hidden />
            <div className="space-y-3">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-slate-700">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="min-w-[24px] h-[22px] px-2 inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white text-slate-700 text-[11px] font-mono shadow-sm"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
