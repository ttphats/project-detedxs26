"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Star,
  Ticket,
  Loader2,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components";

// Generate or get session ID for locking (same key as seat flow so locks interop)
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = sessionStorage.getItem("seat_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem("seat_session_id", sessionId);
  }
  return sessionId;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string | null;
  subtitle: string | null;
  benefits: string[];
  color: string;
  level: number;
  icon?: string | null;
}

interface TicketAvailability {
  ticketTypeId: string;
  name: string;
  level: number;
  color: string;
  price: number;
  maxQuantity: number | null;
  totalSeats: number;
  sold: number;
  reserved: number;
  locked: number;
  available: number;
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string | null;
  date: string;
  time: string;
  venue: string;
  ticketTypes: TicketType[];
}

const MAX_QUANTITY = 10;

export default function TicketClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [availability, setAvailability] = useState<TicketAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected ticket type + quantity
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Promo
  const [promoCode, setPromoCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<{
    name: string;
    amount: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

  // Fetch event + availability
  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/events/${id}/ticket-availability`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setAvailability(data.data || []);
      }
    } catch (err) {
      console.error("[AVAIL] Failed:", err);
    }
  }, [apiUrl, id]);

  useEffect(() => {
    if (!sessionId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${apiUrl}/events/${id}?sessionId=${sessionId}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) {
          setError("Failed to load event data.");
          return;
        }
        const ev = data.data;
        setEvent({
          id: ev.id,
          name: ev.name,
          slug: ev.slug,
          tagline: ev.tagline,
          description: ev.description,
          date: ev.date,
          time: ev.time,
          venue: ev.venue,
          ticketTypes: ev.ticketTypes || [],
        });
        await fetchAvailability();
      } catch (err) {
        console.error(err);
        setError("An error occurred while loading data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, apiUrl, fetchAvailability]);

  // Poll availability every 10s to keep "X vé còn lại" fresh
  useEffect(() => {
    if (!id || loading) return;
    const interval = setInterval(fetchAvailability, 10000);
    return () => clearInterval(interval);
  }, [id, loading, fetchAvailability]);

  const selectedType =
    event?.ticketTypes.find((t) => t.id === selectedTypeId) || null;
  const selectedAvail =
    availability.find((a) => a.ticketTypeId === selectedTypeId) || null;
  const maxAllowed = Math.min(MAX_QUANTITY, selectedAvail?.available ?? 0);
  const unitPrice = selectedType ? Number(selectedType.price) : 0;
  const rawTotal = unitPrice * quantity;
  const total = Math.max(0, rawTotal - (discountInfo?.amount || 0));

  const handleSelectType = (typeId: string) => {
    if (selectedTypeId === typeId) return;
    setSelectedTypeId(typeId);
    setQuantity(1);
    setDiscountInfo(null);
    setPromoCode("");
    setPromoError(null);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (maxAllowed > 0 && next > maxAllowed) return maxAllowed;
      if (next > MAX_QUANTITY) return MAX_QUANTITY;
      return next;
    });
    setDiscountInfo(null);
    setPromoCode("");
    setPromoError(null);
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim() || !selectedTypeId) return;
    if (quantity < 1) {
      setPromoError("Please select a quantity first");
      return;
    }
    setIsValidatingPromo(true);
    setPromoError(null);
    try {
      // The promotions check endpoint expects seatIds; for the ticket-class flow
      // we don't know seatIds yet, so we approximate by sending a synthetic payload.
      // The backend calculateBestDiscount only needs { id, price, ticketTypeId }.
      // We build pseudo-ticket items to evaluate the discount.
      const res = await fetch(`${apiUrl}/promotions/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          seatIds: Array.from(
            { length: quantity },
            (_, i) => `pseudo_${selectedTypeId}_${i}`,
          ),
          promoCode: promoCode.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) {
        setPromoError(data.error || "Invalid promo code");
        setDiscountInfo(null);
      } else if (data.data?.discount) {
        setDiscountInfo({
          name: data.data.discount.name,
          amount: data.data.discount.discountAmount,
        });
        setPromoError(null);
      } else {
        setPromoError("Promo code not applicable");
        setDiscountInfo(null);
      }
    } catch {
      setPromoError("Failed to validate promo code");
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedTypeId || !id || !sessionId) return;
    if (quantity < 1) {
      toast.error("Please select at least 1 ticket");
      return;
    }
    if (selectedAvail && quantity > selectedAvail.available) {
      toast.error(`Chỉ còn ${selectedAvail.available} vé loại này`);
      return;
    }
    setIsCheckingOut(true);
    try {
      const res = await fetch(`${apiUrl}/orders/create-pending-by-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          ticketTypeId: selectedTypeId,
          quantity,
          sessionId,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[CHECKOUT] Server error:", res.status, errText);
        throw new Error("Failed to create order. Please try again.");
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create order");
      }
      if (!data.data?.orderNumber || !data.data?.accessToken) {
        throw new Error("Invalid server response");
      }
      sessionStorage.setItem("navigating_to_checkout", "true");
      const checkoutUrl = `/checkout?event=${id}&order=${data.data.orderNumber}&token=${data.data.accessToken}`;
      window.location.replace(checkoutUrl);
    } catch (err: unknown) {
      console.error("[CHECKOUT] error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to proceed to checkout. Please try again.";
      toast.error(message);
      setIsCheckingOut(false);
      // Refresh availability in case seats ran out
      fetchAvailability();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {error || "Event not found"}
          </h1>
          <Link href="/">
            <Button>Return to homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Derive a "tier rank" for badge logic: highest level = VIP/Most popular
  const sortedByLevelDesc = [...(event.ticketTypes || [])].sort(
    (a, b) => b.level - a.level,
  );
  const topTierId = sortedByLevelDesc[0]?.id;
  const valueTierId = sortedByLevelDesc[sortedByLevelDesc.length - 1]?.id;

  return (
    <div className="min-h-screen bg-black pt-24 pb-24 sm:pb-12">
      {/* Ambient background — TEDx red glow + grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 right-0 w-[600px] h-[600px] bg-red-600/15 rounded-full blur-[120px]"
          style={{ animationDuration: "6s" }}
        />
        <div
          className="absolute bottom-0 -left-32 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 sm:mb-12 animate-fade-in-down">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium tracking-wide">
              Back to homepage
            </span>
          </Link>
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Tickets
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white ted-logo-text leading-tight">
              Choose Your <span className="text-red-600">Experience</span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl">
              Select a ticket class and quantity. Seat numbers are assigned
              automatically — no need to pick a seat.
            </p>
          </div>
        </div>

        {/* Pricing tiers — 3 columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-10 sm:mb-12">
          {event.ticketTypes.map((tt, idx) => {
            const avail = availability.find((a) => a.ticketTypeId === tt.id);
            const isSoldOut = avail ? avail.available <= 0 : false;
            const isSelected = selectedTypeId === tt.id;
            const isVIP = tt.name.toUpperCase().includes("VIP");
            const isTopTier = tt.id === topTierId;
            const isValueTier = tt.id === valueTierId;
            const soldPct =
              avail && avail.totalSeats > 0
                ? Math.round(
                    ((avail.sold + avail.reserved) / avail.totalSeats) * 100,
                  )
                : 0;
            return (
              <div
                key={tt.id}
                className={`relative animate-fade-in-up`}
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                {/* Badge ribbon */}
                {isTopTier && !isSoldOut && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black uppercase tracking-wider rounded-full shadow-lg shadow-orange-500/40 whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                {isValueTier && !isTopTier && !isSoldOut && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-black uppercase tracking-wider rounded-full shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                    Best Value
                  </div>
                )}

                <button
                  onClick={() => !isSoldOut && handleSelectType(tt.id)}
                  disabled={isSoldOut}
                  className={`w-full h-full text-left relative overflow-hidden rounded-3xl border transition-all duration-300 group ${
                    isSelected
                      ? "scale-[1.02] shadow-2xl"
                      : "hover:scale-[1.01] shadow-xl"
                  } ${isSoldOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  style={{
                    borderColor: isSelected
                      ? tt.color
                      : "rgba(255,255,255,0.08)",
                    background: isSelected
                      ? `linear-gradient(160deg, ${tt.color}1f 0%, rgba(0,0,0,0.6) 60%)`
                      : "linear-gradient(160deg, rgba(26,26,26,0.8) 0%, rgba(0,0,0,0.8) 100%)",
                    boxShadow: isSelected
                      ? `0 20px 60px -20px ${tt.color}80, 0 0 0 1px ${tt.color}40`
                      : "0 10px 40px -10px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                      background: `linear-gradient(90deg, ${tt.color}, ${tt.color}00)`,
                    }}
                  />

                  {/* Selected check */}
                  {isSelected && (
                    <div
                      className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: tt.color }}
                    >
                      <Check className="w-5 h-5 text-white" strokeWidth={3} />
                    </div>
                  )}

                  <div className="p-6 sm:p-7">
                    {/* Tier icon + name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${tt.color}, ${tt.color}bb)`,
                          boxShadow: `0 8px 24px -8px ${tt.color}80`,
                        }}
                      >
                        {isVIP ? (
                          <Star className="w-6 h-6 text-white" fill="white" />
                        ) : (
                          <Ticket className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3
                          className="font-black text-xl sm:text-2xl uppercase tracking-tight truncate"
                          style={{ color: tt.color }}
                        >
                          {tt.name}
                        </h3>
                        {tt.subtitle && (
                          <p className="text-gray-500 text-xs truncate">
                            {tt.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-3xl sm:text-4xl font-black text-white"
                          style={{ textShadow: `0 0 30px ${tt.color}40` }}
                        >
                          {Math.round(Number(tt.price)).toLocaleString("vi-VN")}
                        </span>
                        <span className="text-sm font-bold text-gray-400">
                          VND
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        per ticket · all fees included
                      </p>
                    </div>

                    {/* Benefits */}
                    {tt.benefits && tt.benefits.length > 0 && (
                      <ul className="space-y-2.5 mb-6">
                        {tt.benefits.slice(0, 5).map((b, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 text-sm text-gray-300"
                          >
                            <span
                              className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: `${tt.color}25` }}
                            >
                              <Check
                                className="w-2.5 h-2.5"
                                style={{ color: tt.color }}
                                strokeWidth={4}
                              />
                            </span>
                            <span className="leading-snug">{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Availability bar */}
                    {avail && (
                      <div className="pt-4 border-t border-white/5">
                        {isSoldOut ? (
                          <div className="flex items-center justify-between">
                            <span className="text-red-400 font-bold text-sm uppercase tracking-wider">
                              Sold Out
                            </span>
                            <span className="text-gray-600 text-xs">
                              {avail.sold + avail.reserved}/{avail.totalSeats}{" "}
                              sold
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider ${
                                  avail.available > 10
                                    ? "text-green-400"
                                    : avail.available > 3
                                      ? "text-amber-400"
                                      : "text-red-400"
                                }`}
                              >
                                {avail.available <= 5
                                  ? `Only ${avail.available} left`
                                  : `${avail.available} available`}
                              </span>
                              <span className="text-gray-600 text-xs">
                                {soldPct}% sold
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${soldPct}%`,
                                  background: `linear-gradient(90deg, ${tt.color}, ${tt.color}80)`,
                                }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Quantity + Summary — two-column on desktop, stacked on mobile */}
        {selectedType && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in-up">
            {/* Quantity selector — left, wider */}
            <div className="lg:col-span-3">
              <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 h-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                    <Ticket
                      className="w-5 h-5"
                      style={{ color: selectedType.color }}
                    />
                    Quantity
                  </h3>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `${selectedType.color}20`,
                      color: selectedType.color,
                    }}
                  >
                    {selectedType.name}
                  </span>
                </div>

                {/* Big stepper */}
                <div className="flex items-center justify-center gap-6 sm:gap-8 py-6 mb-6 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <div className="text-center">
                    <div
                      className="text-5xl sm:text-6xl font-black text-white leading-none"
                      style={{ textShadow: `0 0 40px ${selectedType.color}60` }}
                    >
                      {quantity}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mt-2">
                      {quantity === 1 ? "ticket" : "tickets"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={maxAllowed > 0 && quantity >= maxAllowed}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 hover:bg-white/15 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Quick-select chips */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const capped = maxAllowed > 0 ? Math.min(n, maxAllowed) : n;
                    const active = quantity === capped;
                    return (
                      <button
                        key={n}
                        onClick={() => {
                          setQuantity(capped);
                          setDiscountInfo(null);
                          setPromoCode("");
                          setPromoError(null);
                        }}
                        disabled={maxAllowed > 0 && n > maxAllowed}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                          active
                            ? "text-white scale-110"
                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        } disabled:opacity-20 disabled:cursor-not-allowed`}
                        style={
                          active
                            ? {
                                backgroundColor: selectedType.color,
                                boxShadow: `0 4px 16px -4px ${selectedType.color}80`,
                              }
                            : undefined
                        }
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>

                {/* Info row */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white/5 px-4 py-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">
                      Unit price
                    </p>
                    <p className="text-white font-bold">
                      {unitPrice.toLocaleString("vi-VN")} VND
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">
                      Availability
                    </p>
                    <p
                      className={`font-bold ${
                        !selectedAvail || selectedAvail.available > 10
                          ? "text-green-400"
                          : selectedAvail.available > 3
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {selectedAvail ? `${selectedAvail.available} left` : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 text-xs mt-4 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  Max {MAX_QUANTITY} tickets per order · seats assigned
                  automatically.
                </p>
              </div>
            </div>

            {/* Order Summary — sticky sidebar on desktop */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24">
                <div
                  className="rounded-3xl p-6 sm:p-7 border relative overflow-hidden"
                  style={{
                    borderColor: `${selectedType.color}40`,
                    background: `linear-gradient(160deg, ${selectedType.color}12 0%, rgba(0,0,0,0.7) 70%)`,
                    boxShadow: `0 20px 60px -20px ${selectedType.color}50`,
                  }}
                >
                  {/* glow accent */}
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                    style={{ backgroundColor: `${selectedType.color}30` }}
                  />

                  <h3 className="relative text-lg font-black text-white uppercase tracking-tight mb-5 flex items-center gap-2">
                    <span
                      className="w-1 h-5 rounded-full"
                      style={{ backgroundColor: selectedType.color }}
                    />
                    Order Summary
                  </h3>

                  {/* Line items */}
                  <div className="relative space-y-3 mb-5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        {selectedType.name} × {quantity}
                      </span>
                      <span className="text-white font-semibold">
                        {rawTotal.toLocaleString("vi-VN")} VND
                      </span>
                    </div>

                    {/* Promo code */}
                    <div className="pt-3 border-t border-white/5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) =>
                            setPromoCode(e.target.value.toUpperCase())
                          }
                          placeholder="Promo code"
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors uppercase placeholder:text-gray-600"
                          disabled={isValidatingPromo}
                        />
                        <button
                          onClick={handleApplyPromoCode}
                          disabled={!promoCode.trim() || isValidatingPromo}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                        >
                          {isValidatingPromo ? "..." : "Apply"}
                        </button>
                      </div>
                      {promoError && (
                        <p className="text-red-400 text-xs mt-1.5">
                          {promoError}
                        </p>
                      )}
                    </div>

                    {discountInfo && (
                      <div className="flex justify-between items-center text-green-400 text-sm">
                        <span className="flex flex-col">
                          <span>Discount</span>
                          <span className="text-xs opacity-70">
                            ({discountInfo.name})
                          </span>
                        </span>
                        <span className="font-semibold">
                          −{discountInfo.amount.toLocaleString()} VND
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div
                    className="relative flex justify-between items-end p-4 rounded-2xl mb-5"
                    style={{
                      background: `linear-gradient(90deg, ${selectedType.color}25, transparent)`,
                    }}
                  >
                    <span className="text-base font-bold text-white uppercase tracking-wide">
                      Total
                    </span>
                    <div className="text-right">
                      <span
                        className="text-3xl font-black"
                        style={{ color: selectedType.color }}
                      >
                        {total.toLocaleString("vi-VN")}
                      </span>
                      <span className="text-sm font-bold text-gray-400 ml-1">
                        VND
                      </span>
                    </div>
                  </div>

                  {/* Checkout button */}
                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut || quantity < 1}
                    className={`relative w-full py-4 px-6 rounded-2xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-300 overflow-hidden group ${
                      isCheckingOut
                        ? "bg-gray-700 cursor-not-allowed opacity-60"
                        : "hover-lift active:scale-[0.98]"
                    }`}
                    style={
                      !isCheckingOut
                        ? {
                            background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}dd)`,
                            boxShadow: `0 12px 40px -8px ${selectedType.color}90`,
                          }
                        : undefined
                    }
                  >
                    {!isCheckingOut && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                    {isCheckingOut ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="relative">Processing...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative">Proceed to Checkout</span>
                        <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Trust badges */}
                  <div className="relative flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" /> Secure payment
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" /> Instant confirmation
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile sticky bottom bar — appears when a tier is selected */}
        {selectedType && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 animate-fade-in-up">
            <div
              className="mx-3 mb-3 rounded-2xl p-4 border shadow-2xl backdrop-blur-xl"
              style={{
                borderColor: `${selectedType.color}40`,
                background: "rgba(10,10,10,0.85)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs uppercase tracking-wider truncate">
                    {selectedType.name} × {quantity}
                    {discountInfo &&
                      ` · −${discountInfo.amount.toLocaleString()}`}
                  </p>
                  <p
                    className="text-xl font-black"
                    style={{ color: selectedType.color }}
                  >
                    {total.toLocaleString("vi-VN")} VND
                  </p>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut || quantity < 1}
                  className="shrink-0 px-5 py-3 rounded-xl font-black text-white uppercase tracking-wider text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}dd)`,
                  }}
                >
                  {isCheckingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Checkout
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
