"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Star,
  Ticket,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Zap,
  Monitor,
} from "lucide-react";
import { Button } from "@/components";
import SpotlightCard from "@/components/ui/SpotlightCard";
import AuroraBackground from "@/components/ui/AuroraBackground";
import SeatOverview from "@/components/ui/SeatOverview";

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
  seatMap: SeatRow[];
}

interface SeatType {
  id: string;
  row: string;
  number: number;
  seatNumber?: string;
  section?: string | null;
  status: "available" | "sold" | "locked" | "locked_by_me";
  ticketTypeId?: string | null;
  seatType?: string;
  level?: number;
  price: number;
}

interface SeatRow {
  row: string;
  seats: SeatType[];
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
          seatMap: ev.seatMap || [],
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

  // Motion variants
  const containerStagger = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };
  const cardItem = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 260, damping: 24 },
    },
  };

  return (
    <AuroraBackground className="min-h-screen bg-[#08080a] pt-20 sm:pt-24 pb-28 sm:pb-12">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header — editorial poster style, TEDx */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 sm:mb-12"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors mb-5 sm:mb-7 group py-2 -ml-1"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs sm:text-sm font-medium tracking-wide">
              Home
            </span>
          </Link>
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-[#e62b1e]/10 border border-[#e62b1e]/30 text-[#e62b1e] text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 bg-[#e62b1e] rounded-full animate-pulse" />
              Get Tickets
            </span>
            <h1 className="text-[32px] leading-[0.95] sm:text-6xl md:text-7xl font-black text-white tracking-tight uppercase">
              Choose Your{" "}
              <span className="text-[#e62b1e] italic">Experience</span>
            </h1>
            <p className="text-gray-500 text-sm sm:text-base max-w-md leading-relaxed">
              Pick a ticket class &amp; quantity. Seats assigned automatically —
              no seat map needed.
            </p>
          </div>
        </motion.header>

        {/* Tier cards — mobile: horizontal scroll snap, desktop: 3-col grid */}
        <motion.section
          variants={containerStagger}
          initial="hidden"
          animate="show"
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 mb-6 sm:mb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Ticket classes"
        >
          {event.ticketTypes.map((tt) => {
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
              <motion.div
                key={tt.id}
                variants={cardItem}
                className="relative snap-center shrink-0 w-[80vw] sm:w-auto sm:shrink"
              >
                {/* Badge */}
                <AnimatePresence>
                  {isTopTier && !isSoldOut && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-3 left-5 z-20 px-3 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-orange-500/30 whitespace-nowrap"
                    >
                      Popular
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {isValueTier && !isTopTier && !isSoldOut && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-3 left-5 z-20 px-3 py-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg shadow-emerald-500/30 whitespace-nowrap"
                    >
                      Best Value
                    </motion.div>
                  )}
                </AnimatePresence>

                <SpotlightCard
                  glowColor={tt.color}
                  className="rounded-2xl border h-full transition-all duration-200"
                >
                  <button
                    onClick={() => !isSoldOut && handleSelectType(tt.id)}
                    disabled={isSoldOut}
                    className="block w-full h-full text-left relative active:scale-[0.98] transition-transform"
                    style={{
                      borderColor: isSelected
                        ? tt.color
                        : "rgba(255,255,255,0.08)",
                      background: isSelected
                        ? `linear-gradient(160deg, ${tt.color}18 0%, rgba(8,8,10,0.9) 65%)`
                        : "linear-gradient(160deg, rgba(14,14,16,0.9) 0%, rgba(5,5,7,0.9) 100%)",
                      boxShadow: isSelected
                        ? `0 16px 48px -16px ${tt.color}70, 0 0 0 1px ${tt.color}30`
                        : "0 8px 32px -12px rgba(0,0,0,0.6)",
                    }}
                  >
                    {/* Top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5"
                      style={{
                        background: `linear-gradient(90deg, ${tt.color}, ${tt.color}00)`,
                      }}
                    />
                    {isSelected && (
                      <motion.div
                        layoutId="selected-check"
                        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: tt.color }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      >
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </motion.div>
                    )}

                    <div className="p-4 sm:p-6">
                      {/* Icon + name */}
                      <div className="flex items-center gap-2.5 sm:gap-3 mb-4">
                        <div
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${tt.color}, ${tt.color}bb)`,
                          }}
                        >
                          {isVIP ? (
                            <Star className="w-5 h-5 text-white" fill="white" />
                          ) : (
                            <Ticket className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3
                            className="font-black text-base sm:text-xl uppercase tracking-tight truncate"
                            style={{ color: tt.color }}
                          >
                            {tt.name}
                          </h3>
                          {tt.subtitle && (
                            <p className="text-gray-600 text-[10px] sm:text-xs truncate">
                              {tt.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-black text-white">
                            {Math.round(Number(tt.price)).toLocaleString(
                              "vi-VN",
                            )}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            VND
                          </span>
                        </div>
                        <p className="text-gray-600 text-[10px] sm:text-xs mt-0.5">
                          per ticket · fees included
                        </p>
                      </div>

                      {/* Benefits */}
                      {tt.benefits && tt.benefits.length > 0 && (
                        <ul className="space-y-2 mb-4">
                          {tt.benefits.slice(0, 4).map((b, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs sm:text-sm text-gray-400"
                            >
                              <span
                                className="shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${tt.color}20` }}
                              >
                                <Check
                                  className="w-2 h-2"
                                  style={{ color: tt.color }}
                                  strokeWidth={4}
                                />
                              </span>
                              <span className="leading-snug">{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Availability */}
                      {avail && (
                        <div className="pt-3 border-t border-white/5">
                          {isSoldOut ? (
                            <span className="text-red-400/80 font-bold text-xs uppercase tracking-wider">
                              Sold Out
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-1.5">
                                <span
                                  className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                                    avail.available > 10
                                      ? "text-green-400/90"
                                      : avail.available > 3
                                        ? "text-amber-400/90"
                                        : "text-red-400/90"
                                  }`}
                                >
                                  {avail.available <= 5
                                    ? `Only ${avail.available} left`
                                    : `${avail.available} available`}
                                </span>
                                <span className="text-gray-700 text-[10px]">
                                  {soldPct}% sold
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${soldPct}%` }}
                                  transition={{
                                    duration: 0.8,
                                    ease: "easeOut",
                                  }}
                                  className="h-full rounded-full"
                                  style={{
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
                </SpotlightCard>
              </motion.div>
            );
          })}
        </motion.section>

        {/* Mobile scroll hint */}
        <p className="sm:hidden text-center text-gray-700 text-[10px] -mt-3 mb-6">
          ← Swipe to see all tiers →
        </p>

        {/* Seat map — read-only overview, highlights the selected tier zone */}
        {event.seatMap && event.seatMap.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 sm:mb-10"
            aria-label="Venue seat map"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent p-4 sm:p-6 md:p-8 relative overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span className="w-1 h-4 bg-[#e62b1e] rounded-full" />
                  Venue Overview
                </h2>
                {selectedType && (
                  <motion.span
                    key={selectedType.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `${selectedType.color}1a`,
                      color: selectedType.color,
                    }}
                  >
                    {selectedType.name} zone highlighted
                  </motion.span>
                )}
              </div>

              {/* Stage */}
              <div className="mb-6 sm:mb-8 relative">
                <div className="absolute inset-0 bg-[#e62b1e]/20 blur-2xl rounded-full transform scale-y-50" />
                <div className="relative bg-gradient-to-r from-[#e62b1e] via-red-600 to-[#e62b1e] text-white py-2.5 sm:py-4 px-4 sm:px-8 rounded-lg text-center flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 border border-[#e62b1e]/40">
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="font-black uppercase tracking-widest text-xs sm:text-base">
                    Stage
                  </span>
                </div>
              </div>

              {/* Venue overview — read-only, uses same Seat component as
                  the legacy seat page (compact mode: no number, no click) */}
              <SeatOverview
                rows={event.seatMap}
                tiers={event.ticketTypes.map((tt) => ({
                  id: tt.id,
                  name: tt.name,
                  level: tt.level,
                  color: tt.color,
                }))}
                highlightedTierId={selectedTypeId}
              />

              {/* Note */}
              <p className="text-center text-gray-600 text-[10px] sm:text-xs mt-4 flex items-center justify-center gap-1.5">
                <Zap className="w-3 h-3" />
                Seats are assigned automatically based on your selected class —
                no need to pick individual seats.
              </p>
            </div>
          </motion.section>
        )}

        {/* Quantity selector — always visible when a tier is selected */}
        <AnimatePresence>
          {selectedType && (
            <motion.section
              key="quantity"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden mb-6 sm:mb-8"
              aria-label="Quantity"
            >
              <div
                className="rounded-2xl border p-4 sm:p-6"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background:
                    "linear-gradient(160deg, rgba(14,14,16,0.6), rgba(5,5,7,0.6))",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span
                      className="w-1 h-4 rounded-full"
                      style={{ backgroundColor: selectedType.color }}
                    />
                    Quantity
                  </h3>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      backgroundColor: `${selectedType.color}1a`,
                      color: selectedType.color,
                    }}
                  >
                    {selectedType.name}
                  </span>
                </div>

                {/* Stepper + quick chips in one row on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                  {/* Stepper */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-12 h-12 sm:w-11 sm:h-11 rounded-xl bg-white/5 active:bg-white/15 text-white flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center w-12">
                      <div
                        className="text-3xl sm:text-4xl font-black text-white leading-none"
                        style={{
                          textShadow: `0 0 24px ${selectedType.color}50`,
                        }}
                      >
                        {quantity}
                      </div>
                      <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-1">
                        {quantity === 1 ? "ticket" : "tickets"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={maxAllowed > 0 && quantity >= maxAllowed}
                      className="w-12 h-12 sm:w-11 sm:h-11 rounded-xl bg-white/5 active:bg-white/15 text-white flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick chips */}
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const capped =
                        maxAllowed > 0 ? Math.min(n, maxAllowed) : n;
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
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-90 ${
                            active
                              ? "text-white"
                              : "bg-white/5 text-gray-500 active:bg-white/10"
                          } disabled:opacity-20 disabled:cursor-not-allowed`}
                          style={
                            active
                              ? {
                                  backgroundColor: selectedType.color,
                                  boxShadow: `0 4px 14px -4px ${selectedType.color}80`,
                                }
                              : undefined
                          }
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info row */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4 text-sm">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-gray-600 text-[10px] uppercase tracking-wider">
                      Unit price
                    </p>
                    <p className="text-white font-bold text-sm">
                      {unitPrice.toLocaleString("vi-VN")} VND
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-gray-600 text-[10px] uppercase tracking-wider">
                      Availability
                    </p>
                    <p
                      className={`font-bold text-sm ${
                        !selectedAvail || selectedAvail.available > 10
                          ? "text-green-400/90"
                          : selectedAvail.available > 3
                            ? "text-amber-400/90"
                            : "text-red-400/90"
                      }`}
                    >
                      {selectedAvail ? `${selectedAvail.available} left` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Promo code — inline, compact */}
        <AnimatePresence>
          {selectedType && (
            <motion.section
              key="promo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 sm:mb-8"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Promo code"
                  className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 transition-colors uppercase placeholder:text-gray-700 placeholder:normal-case"
                  disabled={isValidatingPromo}
                />
                <button
                  onClick={handleApplyPromoCode}
                  disabled={!promoCode.trim() || isValidatingPromo}
                  className="px-5 py-3 bg-white/8 active:bg-white/15 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-30 active:scale-95"
                >
                  {isValidatingPromo ? "..." : "Apply"}
                </button>
              </div>
              {promoError && (
                <p className="text-red-400/90 text-xs mt-2">{promoError}</p>
              )}
              {discountInfo && (
                <div className="flex justify-between items-center mt-2 text-green-400/90 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {discountInfo.name}
                  </span>
                  <span className="font-bold">
                    −{discountInfo.amount.toLocaleString()} VND
                  </span>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Desktop sticky order summary sidebar */}
        <AnimatePresence>
          {selectedType && (
            <motion.aside
              key="summary"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block"
            >
              <div className="sticky top-24">
                <div
                  className="rounded-2xl p-6 border relative overflow-hidden"
                  style={{
                    borderColor: `${selectedType.color}30`,
                    background: `linear-gradient(160deg, ${selectedType.color}10 0%, rgba(8,8,10,0.8) 70%)`,
                  }}
                >
                  <div
                    className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                    style={{ backgroundColor: `${selectedType.color}25` }}
                  />

                  <h3 className="relative text-base font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <span
                      className="w-1 h-4 rounded-full"
                      style={{ backgroundColor: selectedType.color }}
                    />
                    Order Summary
                  </h3>

                  <div className="relative space-y-3 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">
                        {selectedType.name} × {quantity}
                      </span>
                      <span className="text-white font-semibold">
                        {rawTotal.toLocaleString("vi-VN")} VND
                      </span>
                    </div>
                    {discountInfo && (
                      <div className="flex justify-between items-center text-green-400/90 text-sm">
                        <span>Discount</span>
                        <span className="font-semibold">
                          −{discountInfo.amount.toLocaleString()} VND
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className="relative flex justify-between items-end p-4 rounded-xl mb-5"
                    style={{
                      background: `linear-gradient(90deg, ${selectedType.color}20, transparent)`,
                    }}
                  >
                    <span className="text-sm font-bold text-white uppercase tracking-wide">
                      Total
                    </span>
                    <div className="text-right">
                      <span
                        className="text-2xl font-black"
                        style={{ color: selectedType.color }}
                      >
                        {total.toLocaleString("vi-VN")}
                      </span>
                      <span className="text-xs font-bold text-gray-500 ml-1">
                        VND
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut || quantity < 1}
                    className={`relative w-full py-4 px-6 rounded-xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 overflow-hidden group ${
                      isCheckingOut
                        ? "bg-gray-800 cursor-not-allowed opacity-60"
                        : "active:scale-[0.98]"
                    }`}
                    style={
                      !isCheckingOut
                        ? {
                            background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}dd)`,
                            boxShadow: `0 12px 36px -10px ${selectedType.color}80`,
                          }
                        : undefined
                    }
                  >
                    {!isCheckingOut && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
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

                  <div className="relative flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-700 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Secure payment
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Auto seat assignment
                    </span>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile sticky bottom bar — compact, thumb-reachable */}
        <AnimatePresence>
          {selectedType && (
            <motion.div
              key="mobile-bar"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{
                type: "spring" as const,
                stiffness: 300,
                damping: 30,
              }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
            >
              <div
                className="mx-3 mb-3 rounded-2xl px-4 py-3 border shadow-2xl backdrop-blur-xl"
                style={{
                  borderColor: `${selectedType.color}30`,
                  background: "rgba(8,8,10,0.92)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-600 text-[10px] uppercase tracking-wider truncate">
                      {selectedType.name} × {quantity}
                      {discountInfo &&
                        ` · −${discountInfo.amount.toLocaleString()}`}
                    </p>
                    <p
                      className="text-lg font-black leading-tight"
                      style={{ color: selectedType.color }}
                    >
                      {total.toLocaleString("vi-VN")}{" "}
                      <span className="text-xs text-gray-500">VND</span>
                    </p>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={isCheckingOut || quantity < 1}
                    className="shrink-0 px-5 py-3 rounded-xl font-black text-white uppercase tracking-wider text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}dd)`,
                      boxShadow: `0 8px 24px -8px ${selectedType.color}90`,
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuroraBackground>
  );
}
