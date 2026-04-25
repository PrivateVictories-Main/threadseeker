"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { modalBackdrop, modalSurface } from "@/lib/motion";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘K", "Ctrl+K"], label: "Open the command palette" },
  { keys: ["/"], label: "Focus the search bar" },
  { keys: ["j", "↓"], label: "Move to next result" },
  { keys: ["k", "↑"], label: "Move to previous result" },
  { keys: ["↵"], label: "Open focused result in a new tab" },
  { keys: ["Esc"], label: "Clear focus" },
  { keys: ["?"], label: "Toggle this help" },
];

// Custom-event contract for opening the modal from anywhere in the app
// without prop-threading. Kept here so callers can import the event name
// without reaching into the component's internals.
export const SHORTCUT_HELP_EVENT = "threadseeker:open-shortcut-help";

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
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUT_HELP_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUT_HELP_EVENT, onOpenEvent);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        // Backdrop is now motion.div (was a plain <div>) so AnimatePresence
        // tracks it as its direct motion child. Without this, the backdrop's
        // exit was instantaneous (no fade) because AnimatePresence only
        // animates motion children — the inner motion.div would still play
        // its exit, but the backdrop would already be gone, producing a
        // momentary "naked" modal as it scaled out. Backdrop fade is short
        // (0.18s ease-out) so it leads the modal out by a beat.
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/40 backdrop-blur-md p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-help-title"
          variants={modalBackdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong shortcut-modal w-full"
            variants={modalSurface}
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
                className="p-3 sm:p-1.5 -mr-2 -mt-2 sm:-mr-1 sm:-mt-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-colors inline-flex items-center justify-center"
                aria-label="Close keyboard shortcuts"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="h-px w-full bg-indigo-100/80 mb-4" aria-hidden />
            <dl className="flex flex-col gap-2.5">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-6"
                >
                  <dt className="text-[13px] text-slate-700 leading-snug">{s.label}</dt>
                  <dd className="flex items-center gap-1.5">
                    {s.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <span
                            className="text-[10.5px] text-slate-400 font-medium"
                            aria-hidden
                          >
                            or
                          </span>
                        )}
                        <kbd className="min-w-[26px] h-[24px] px-2 inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white text-slate-700 text-[11px] font-mono shadow-sm tracking-wide">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating ghost-glass help button docked bottom-right. Provides a visible
// affordance for the `?` shortcut on mouse-only users / first-time
// visitors who'd otherwise never discover keyboard nav. Dispatches the
// shared open event instead of owning its own open state so the modal
// remains the single source of truth.
//
// Hidden on the hero/landing page — there are no result cards to navigate
// across yet, so the floating affordance is visual clutter. Fades in once
// the user has searched (mode === "results"). The keyboard `?` shortcut
// itself stays globally available either way.
export function ShortcutHelpButton({ visible = true }: { visible?: boolean } = {}) {
  const openHelp = () => {
    window.dispatchEvent(new CustomEvent(SHORTCUT_HELP_EVENT));
  };
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={openHelp}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="fixed bottom-4 right-4 z-30 w-11 h-11 sm:w-9 sm:h-9 rounded-full glass-strong flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:shadow-md transition-all focus-visible:ring-2 focus-visible:ring-indigo-400"
          initial={{ opacity: 0, y: 8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        >
          <HelpCircle className="w-4 h-4" aria-hidden />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
