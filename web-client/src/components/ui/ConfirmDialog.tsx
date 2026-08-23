"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AlertTriangle, X } from "lucide-react";

gsap.registerPlugin(useGSAP);

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Body copy. Pass a node when the message needs its own markup. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive choices, e.g. abandoning an order. */
  tone?: "default" | "danger";
  /** Disables both buttons, e.g. while the confirmed action is in flight. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dark confirmation dialog for the purchase flow.
 *
 * The shared `Modal` is light-themed and reads as a foreign element against
 * the checkout pages, so this keeps the flow visually intact.
 *
 * Layout note: the icon sits inline with the title rather than in its own
 * left-hand column. A side column looked fine for one line of text but left a
 * dead gap down the left of anything taller — a list of ticket holders, say —
 * so the body now runs the full width of the panel.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, busy, onCancel]);

  // Entrance animation. Scoped to the dialog root so the selectors below can
  // never reach elements elsewhere on the page, and reverted automatically by
  // useGSAP when the dialog unmounts.
  useGSAP(
    () => {
      if (!isOpen) return;

      const mm = gsap.matchMedia();

      // Both motion states are declared, so exactly one branch always matches
      // and the panel is never left at its from-state opacity.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([backdropRef.current, panelRef.current], { autoAlpha: 1 });
        gsap.set(panelRef.current, { y: 0, scale: 1 });
        gsap.set(".cd-stagger", { autoAlpha: 1, y: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.fromTo(
          backdropRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.22 },
        )
          .fromTo(
            panelRef.current,
            { autoAlpha: 0, y: 14, scale: 0.97 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.32 },
            "-=0.1",
          )
          .fromTo(
            ".cd-stagger",
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.26, stagger: 0.06 },
            "-=0.16",
          );
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [isOpen] },
  );

  if (!isOpen) return null;

  const accent =
    tone === "danger"
      ? { tint: "bg-red-500/15", text: "text-red-400" }
      : { tint: "bg-amber-500/15", text: "text-amber-400" };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141110] shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Icon inline with the title — no left column, so the body below
              runs edge to edge instead of being indented past a blank gap. */}
          <div className="cd-stagger flex items-center gap-3 pr-8 mb-4">
            <div
              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${accent.tint}`}
            >
              <AlertTriangle className={`w-[18px] h-[18px] ${accent.text}`} />
            </div>
            <h2 className="text-lg font-bold text-white leading-tight">
              {title}
            </h2>
          </div>

          <div className="cd-stagger text-sm text-gray-400 leading-relaxed">
            {message}
          </div>

          <div className="cd-stagger flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                tone === "danger"
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-[#e62b1e] hover:bg-[#ff4436]"
              }`}
            >
              {busy ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
