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
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shortcut-modal w-full"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Keyboard shortcuts</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {SHORTCUTS.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-slate-700">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-0.5 rounded border border-indigo-200 bg-white text-slate-700 text-[11px] font-mono shadow-sm"
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
