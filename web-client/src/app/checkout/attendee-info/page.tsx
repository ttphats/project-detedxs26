"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  User,
  Mail,
  Phone,
  Ticket,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { StepIndicator, ConfirmDialog } from "@/components";
import {
  loadCheckoutState,
  saveAttendees,
  saveRepresentativeBuyer,
  clearCheckoutState,
  type AttendeeInfo,
  type ContactInfo,
  type CheckoutState,
} from "@/lib/checkout-store";

const DEFAULT_TICKET_COLOR = "#e62b1e";

function withAlpha(hex: string | null | undefined, alpha: number): string {
  const raw = (hex || DEFAULT_TICKET_COLOR).trim().replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(230, 43, 30, ${alpha})`;
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function AttendeeInfoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event");

  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [buyer, setBuyer] = useState<ContactInfo>({ name: "", email: "", phone: "" });
  const [buyerSameAsAttendee1, setBuyerSameAsAttendee1] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    const state = loadCheckoutState();
    if (!state || !state.tickets?.length) {
      router.replace("/");
      return;
    }
    setCheckoutState(state);

    if (state.attendees?.length === state.tickets.length) {
      setAttendees(state.attendees);
    } else {
      const initialAttendees: AttendeeInfo[] = state.tickets.map((ticket) => ({
        orderItemId: ticket.id,
        ticketTypeName: ticket.ticketTypeName,
        name: "",
        email: "",
        phone: "",
      }));
      setAttendees(initialAttendees);
    }

    if (state.representativeBuyer) {
      setBuyer(state.representativeBuyer);
      if (
        state.attendees?.[0] &&
        (state.representativeBuyer.name !== state.attendees[0].name ||
          state.representativeBuyer.email !== state.attendees[0].email ||
          state.representativeBuyer.phone !== state.attendees[0].phone)
      ) {
        setBuyerSameAsAttendee1(false);
      }
    }
  }, [router]);

  const attendee0Name = attendees[0]?.name ?? "";
  const attendee0Email = attendees[0]?.email ?? "";
  const attendee0Phone = attendees[0]?.phone ?? "";

  useEffect(() => {
    if (buyerSameAsAttendee1) {
      setBuyer({ name: attendee0Name, email: attendee0Email, phone: attendee0Phone });
    }
  }, [buyerSameAsAttendee1, attendee0Name, attendee0Email, attendee0Phone]);

  const updateAttendee = (index: number, field: keyof AttendeeInfo, value: string) => {
    setAttendees((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    const errorKey = `${index}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => { const next = { ...prev }; delete next[errorKey]; return next; });
    }
  };

  const updateBuyer = (field: keyof ContactInfo, value: string) => {
    if (buyerSameAsAttendee1) setBuyerSameAsAttendee1(false);
    setBuyer((prev) => ({ ...prev, [field]: value }));
    const errorKey = `buyer-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => { const next = { ...prev }; delete next[errorKey]; return next; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    attendees.forEach((attendee, index) => {
      if (!attendee.name.trim()) newErrors[`${index}-name`] = "Name is required";
      if (!attendee.email.trim()) newErrors[`${index}-email`] = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email.trim()))
        newErrors[`${index}-email`] = "Invalid email format";
      if (!attendee.phone.trim()) newErrors[`${index}-phone`] = "Phone is required";
    });
    if (!buyer.name.trim()) newErrors["buyer-name"] = "Name is required";
    if (!buyer.email.trim()) newErrors["buyer-email"] = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim()))
      newErrors["buyer-email"] = "Invalid email format";
    if (!buyer.phone.trim()) newErrors["buyer-phone"] = "Phone is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) {
      const firstError = document.querySelector("[data-has-error]");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowReviewModal(true);
  };

  const handleConfirmAndProceed = () => {
    setIsSubmitting(true);
    saveAttendees(attendees);
    saveRepresentativeBuyer(buyer);
    const paymentUrl = `/checkout?event=${eventId}`;
    router.push(paymentUrl);
  };

  const leaveForTicketSelection = async () => {
    setIsLeaving(true);
    clearCheckoutState();
    setShowLeaveConfirm(false);
    setIsLeaving(false);
    leavingRef.current = true;
    if (eventId) { router.push(`/events/${eventId}/tickets`); } else { router.back(); }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState({ attendeeInfoGuard: true }, "");
    const onPopState = () => {
      if (leavingRef.current) return;
      window.history.pushState({ attendeeInfoGuard: true }, "");
      setShowLeaveConfirm(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (!checkoutState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  const subtotal = Number(checkoutState.subtotal) || checkoutState.tickets.reduce((s, t) => s + Number(t.price), 0);
  const discountAmount = Number(checkoutState.discountAmount) || 0;
  const totalPrice = Math.max(0, subtotal - discountAmount);

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <StepIndicator currentStep={2} />

        <div className="mb-6 sm:mb-8 animate-fade-in-down">
          <button onClick={() => setShowLeaveConfirm(true)} className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group mb-4">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to ticket selection
          </button>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Attendee Information</h1>
          <p className="text-gray-400 mt-2">Fill in details for each ticket holder and confirm your representative contact.</p>
        </div>

        {/* Attendee Forms */}
        <div className="space-y-6 mb-8">
          {attendees.map((attendee, index) => {
            const ticket = checkoutState.tickets[index];
            const accent = ticket?.color || DEFAULT_TICKET_COLOR;
            return (
              <div key={attendee.orderItemId} id={`attendee-block-${index}`} className="glass-panel rounded-2xl overflow-hidden animate-fade-in relative" style={{ animationDelay: `${index * 0.08}s` }}>
                <div className="px-6 py-4 border-b" style={{ backgroundImage: `linear-gradient(to right, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.05)})`, borderBottomColor: withAlpha(accent, 0.3) }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: withAlpha(accent, 0.18) }}>
                        <User className="w-5 h-5" style={{ color: accent }} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">Attendee {index + 1}</p>
                        <p className="text-sm font-semibold" style={{ color: accent }}>{attendee.ticketTypeName}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: withAlpha(accent, 0.15), color: accent }}>
                      {Number(ticket?.price || 0).toLocaleString()} VND
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div data-has-error={errors[`${index}-name`] ? true : undefined}>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <User className="w-4 h-4 text-gray-500" />Full Name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={attendee.name} onChange={(e) => updateAttendee(index, "name", e.target.value)} className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${errors[`${index}-name`] ? "border-red-500/50" : "border-white/10"}`} placeholder="Nguyen Van A" />
                    {errors[`${index}-name`] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors[`${index}-name`]}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-has-error={errors[`${index}-email`] ? true : undefined}>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><Mail className="w-4 h-4 text-gray-500" />Email <span className="text-red-500">*</span></label>
                      <input type="email" value={attendee.email} onChange={(e) => updateAttendee(index, "email", e.target.value)} className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${errors[`${index}-email`] ? "border-red-500/50" : "border-white/10"}`} placeholder="email@example.com" />
                      {errors[`${index}-email`] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors[`${index}-email`]}</p>}
                    </div>
                    <div data-has-error={errors[`${index}-phone`] ? true : undefined}>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><Phone className="w-4 h-4 text-gray-500" />Phone Number <span className="text-red-500">*</span></label>
                      <input type="tel" value={attendee.phone} onChange={(e) => updateAttendee(index, "phone", e.target.value)} className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${errors[`${index}-phone`] ? "border-red-500/50" : "border-white/10"}`} placeholder="0901234567" />
                      {errors[`${index}-phone`] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors[`${index}-phone`]}</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Representative Buyer */}
        <div id="buyer-block" className="glass-panel rounded-2xl overflow-hidden animate-fade-in mb-8" style={{ animationDelay: `${attendees.length * 0.08}s` }}>
          <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-red-600/15 to-transparent">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-600/20">
                  <Users className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Representative Buyer</p>
                  <p className="text-sm text-gray-400">Invoices and confirmations sent to this contact</p>
                </div>
              </div>
              <button type="button" onClick={() => setBuyerSameAsAttendee1((v) => !v)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 ${buyerSameAsAttendee1 ? "bg-red-600/20 border-red-500/50 text-red-400" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}>
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${buyerSameAsAttendee1 ? "bg-red-500 border-red-500" : "bg-transparent border-gray-500"}`}>
                  {buyerSameAsAttendee1 && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
                Same as Attendee 1
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {buyerSameAsAttendee1 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 text-xs mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Auto-filled from Attendee 1. You can freely edit these details.
              </div>
            )}
            <div data-has-error={errors["buyer-name"] ? true : undefined}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><User className="w-4 h-4 text-gray-500" />Full Name <span className="text-red-500">*</span></label>
              <input type="text" value={buyer.name} onChange={(e) => updateBuyer("name", e.target.value)} className={`w-full px-4 py-3 border rounded-xl outline-none text-white placeholder-gray-500 transition-all ${errors["buyer-name"] ? "bg-white/5 border-red-500/50 focus:ring-2 focus:ring-red-500 focus:border-transparent" : "bg-white/5 border-white/10 focus:ring-2 focus:ring-red-500 focus:border-transparent"}`} placeholder="Nguyen Van A" />
              {errors["buyer-name"] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors["buyer-name"]}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div data-has-error={errors["buyer-email"] ? true : undefined}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><Mail className="w-4 h-4 text-gray-500" />Email <span className="text-red-500">*</span></label>
                <input type="email" value={buyer.email} onChange={(e) => updateBuyer("email", e.target.value)} className={`w-full px-4 py-3 border rounded-xl outline-none text-white placeholder-gray-500 transition-all ${errors["buyer-email"] ? "bg-white/5 border-red-500/50 focus:ring-2 focus:ring-red-500 focus:border-transparent" : "bg-white/5 border-white/10 focus:ring-2 focus:ring-red-500 focus:border-transparent"}`} placeholder="email@example.com" />
                {errors["buyer-email"] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors["buyer-email"]}</p>}
              </div>
              <div data-has-error={errors["buyer-phone"] ? true : undefined}>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2"><Phone className="w-4 h-4 text-gray-500" />Phone Number <span className="text-red-500">*</span></label>
                <input type="tel" value={buyer.phone} onChange={(e) => updateBuyer("phone", e.target.value)} className={`w-full px-4 py-3 border rounded-xl outline-none text-white placeholder-gray-500 transition-all ${errors["buyer-phone"] ? "bg-white/5 border-red-500/50 focus:ring-2 focus:ring-red-500 focus:border-transparent" : "bg-white/5 border-white/10 focus:ring-2 focus:ring-red-500 focus:border-transparent"}`} placeholder="0901234567" />
                {errors["buyer-phone"] && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors["buyer-phone"]}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary & Continue */}
        <div className="glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl" />
          <div className="relative">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-9 h-9 bg-red-600/20 rounded-xl flex items-center justify-center"><Ticket className="w-4 h-4 text-red-500" /></span>
              Order Summary
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-gray-400 text-sm">{attendees.length} ticket{attendees.length !== 1 ? "s" : ""}</span></div>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 text-sm">{checkoutState.eventName}</span>
              </div>
              <div className="text-right">
                {discountAmount > 0 && (
                  <div className="mb-1">
                    <p className="text-xs text-gray-500 line-through leading-none">{subtotal.toLocaleString()} VND</p>
                    <p className="text-[11px] font-semibold text-emerald-400 leading-none mt-1">-{discountAmount.toLocaleString()} VND{checkoutState.promoCode ? ` - ${checkoutState.promoCode}` : " discount"}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-2xl font-black text-red-500">{totalPrice.toLocaleString()} VND</p>
              </div>
            </div>
            <button onClick={handleContinue} disabled={isSubmitting} className="relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin relative" /><span className="relative">Processing...</span></>
              ) : (
                <><span className="relative">Review & Continue</span><ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-red-600/50 blur-xl rounded-full" />
          </div>
        </div>
      </div>

      {/* Information Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReviewModal(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-red-500/10 animate-fade-in">
            {/* Modal header */}
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/10 bg-black/90 backdrop-blur-md flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Are you sure the provided information is correct?</h2>
                <p className="text-sm text-gray-400 mt-1">Please review carefully. Each ticket will be emailed to its holder.</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Modal body */}
            <div className="p-6 space-y-6">
              {/* Ticket breakdown */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2"><Ticket className="w-3.5 h-3.5" />Tickets Selected</h3>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
                  {checkoutState.tickets.reduce((acc: { name: string; count: number; price: number; color?: string | null }[], t) => {
                    const existing = acc.find((x) => x.name === t.ticketTypeName);
                    if (existing) { existing.count++; } else { acc.push({ name: t.ticketTypeName, count: 1, price: t.price, color: t.color }); }
                    return acc;
                  }, []).map((line) => (
                    <div key={line.name} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color || DEFAULT_TICKET_COLOR }} />
                        <span className="text-white font-semibold text-sm">{line.name}</span>
                        <span className="text-gray-500 text-sm">x {line.count}</span>
                      </div>
                      <span className="text-white text-sm font-medium tabular-nums">{(line.price * line.count).toLocaleString()} VND</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-red-600/10">
                    <span className="text-gray-300 text-sm font-bold">Total</span>
                    <span className="text-red-400 font-black text-base tabular-nums">{totalPrice.toLocaleString()} VND</span>
                  </div>
                </div>
              </div>
              {/* Representative Buyer */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5" />Representative Buyer</h3>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-white font-semibold">{buyer.name}</p>
                  <p className="text-gray-400 text-sm mt-0.5">{buyer.email}<span className="mx-2 text-gray-600">-</span>{buyer.phone}</p>
                </div>
              </div>
              {/* Attendees */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2"><User className="w-3.5 h-3.5" />Ticket Holders ({attendees.length})</h3>
                <div className="space-y-2">
                  {attendees.map((a, idx) => {
                    const t = checkoutState.tickets[idx];
                    const accent = t?.color || DEFAULT_TICKET_COLOR;
                    return (
                      <div key={a.orderItemId} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Ticket {idx + 1}</span>
                          <span className="text-[11px] font-semibold" style={{ color: accent }}>{a.ticketTypeName}</span>
                        </div>
                        <p className="text-white font-semibold text-sm">{a.name}</p>
                        <p className="text-gray-400 text-xs mt-0.5 break-all">{a.email}<span className="mx-2 text-gray-600">-</span>{a.phone}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Modal footer */}
            <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-white/10 bg-black/90 backdrop-blur-md flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 py-3 px-6 rounded-xl font-bold text-gray-300 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />No, Edit Information
              </button>
              <button onClick={handleConfirmAndProceed} disabled={isSubmitting} className="flex-1 relative py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin relative" /><span className="relative">Processing...</span></>
                ) : (
                  <><span className="relative">Yes, Proceed to Payment</span><ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        tone="danger"
        busy={isLeaving}
        title="End this booking session?"
        message={
          <>
            <p>This cancels your current booking and releases the tickets back for others to buy.</p>
            <p className="mt-2 text-xs text-gray-500">The attendee details you entered will not be kept.</p>
          </>
        }
        confirmLabel="Yes, choose other tickets"
        cancelLabel="Stay on this page"
        onConfirm={leaveForTicketSelection}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}

export default function AttendeeInfoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /><p className="text-gray-400">Loading...</p></div></div>}>
      <AttendeeInfoContent />
    </Suspense>
  );
}
