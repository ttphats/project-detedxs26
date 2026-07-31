"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  ShieldCheck,
  Zap,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components";

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
  /** Optional custom card image; null/undefined → CSS gradient default */
  imageUrl?: string | null;
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

interface CartLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
  available: number;
  color: string;
}

const MAX_QTY_PER_TYPE = 10;
const MAX_TOTAL = 20;

function cardStyle(level: number, color: string): React.CSSProperties {
  const c = color || "#e62b1e";
  if (level >= 3) {
    return {
      background: `linear-gradient(135deg, #1a0505 0%, #3d0a0a 40%, ${c}55 100%)`,
      boxShadow: `0 8px 32px -8px ${c}60, inset 0 1px 0 rgba(255,255,255,0.08)`,
    };
  }
  if (level === 2) {
    return {
      background: `linear-gradient(135deg, #120808 0%, #2a0c0c 45%, ${c}40 100%)`,
      boxShadow: `0 8px 28px -10px ${c}50, inset 0 1px 0 rgba(255,255,255,0.06)`,
    };
  }
  return {
    background: `linear-gradient(135deg, #0c0c0e 0%, #1a0a0a 50%, ${c}30 100%)`,
    boxShadow: `0 6px 24px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)`,
  };
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString("vi-VN");
}

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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<{
    name: string;
    amount: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [sessionId, setSessionId] = useState("");
  /** Mobile cart bottom-sheet open state */
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Close mobile sheet when cart becomes empty
  useEffect(() => {
    if (Object.keys(cart).length === 0) setCartOpen(false);
  }, [cart]);

  // Lock body scroll while mobile cart sheet is open
  useEffect(() => {
    if (!cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cartOpen]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

  /**
   * Availability for ticket-class page:
   * derive from event payload seatMap only.
   * Do NOT call /ticket-availability (missing on older/prod APIs → Network 404).
   */
  const deriveAvailabilityFromSeatMap = useCallback(
    (
      ticketTypes: TicketType[],
      seatMap:
        | Array<{
            seats?: Array<{ status?: string; ticketTypeId?: string | null }>;
          }>
        | undefined,
    ): TicketAvailability[] => {
      if (!ticketTypes.length) return [];
      const counts = new Map<
        string,
        { total: number; available: number; sold: number; locked: number }
      >();
      for (const tt of ticketTypes) {
        counts.set(tt.id, { total: 0, available: 0, sold: 0, locked: 0 });
      }
      for (const row of seatMap || []) {
        for (const seat of row.seats || []) {
          const tid = seat.ticketTypeId;
          if (!tid || !counts.has(tid)) continue;
          const c = counts.get(tid)!;
          c.total += 1;
          const st = (seat.status || "").toLowerCase();
          if (st === "available" || st === "locked_by_me") c.available += 1;
          else if (st === "sold" || st === "reserved") c.sold += 1;
          else if (st === "locked") c.locked += 1;
        }
      }
      return ticketTypes.map((tt) => {
        const c = counts.get(tt.id) || {
          total: 0,
          available: 99,
          sold: 0,
          locked: 0,
        };
        // No seats mapped to this type → treat as open so cart still works
        const available = c.total > 0 ? c.available : 99;
        return {
          ticketTypeId: tt.id,
          name: tt.name,
          level: tt.level,
          color: tt.color,
          price: Number(tt.price),
          maxQuantity: null,
          totalSeats: c.total,
          sold: c.sold,
          reserved: 0,
          locked: c.locked,
          available,
        };
      });
    },
    [],
  );

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
        if (!data.success || !data.data) {
          setError(
            data.error ||
              "Failed to load event data. Server or database may be unavailable.",
          );
          return;
        }
        const ev = data.data;
        const ticketTypes = (ev.ticketTypes || []).map(
          (
            tt: TicketType & {
              imageUrl?: string | null;
              image_url?: string | null;
            },
          ) => {
            const rawImg =
              (typeof tt.imageUrl === "string" && tt.imageUrl.trim()) ||
              (typeof tt.image_url === "string" && tt.image_url.trim()) ||
              null;
            return {
              ...tt,
              imageUrl: rawImg,
            };
          },
        );
        setEvent({
          id: ev.id,
          name: ev.name,
          slug: ev.slug,
          tagline: ev.tagline,
          description: ev.description,
          date: ev.date,
          time: ev.time,
          venue: ev.venue,
          ticketTypes,
        });
        setAvailability(deriveAvailabilityFromSeatMap(ticketTypes, ev.seatMap));
      } catch (err) {
        console.error(err);
        setError("An error occurred while loading data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, apiUrl, deriveAvailabilityFromSeatMap]);

  const cartItems = useMemo(() => {
    if (!event) return [];
    return event.ticketTypes
      .filter((tt) => (cart[tt.id] || 0) > 0)
      .map((tt) => {
        const qty = cart[tt.id] || 0;
        const avail = availability.find((a) => a.ticketTypeId === tt.id);
        return {
          ...tt,
          qty,
          lineTotal: Number(tt.price) * qty,
          available: avail?.available ?? 0,
        };
      });
  }, [event, cart, availability]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const rawTotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
  const total = Math.max(0, rawTotal - (discountInfo?.amount || 0));

  const getMaxFor = (typeId: string) => {
    const avail = availability.find((a) => a.ticketTypeId === typeId);
    // Unknown availability (endpoint missing) → allow up to per-type max
    const available = avail?.available ?? MAX_QTY_PER_TYPE;
    const current = cart[typeId] || 0;
    const others = cartCount - current;
    const roomTotal = Math.max(0, MAX_TOTAL - others);
    return Math.min(MAX_QTY_PER_TYPE, available, roomTotal);
  };

  const setQty = (typeId: string, qty: number) => {
    const max = getMaxFor(typeId);
    const next = Math.max(0, Math.min(qty, max));
    setCart((prev) => {
      if (next === 0) {
        const { [typeId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [typeId]: next };
    });
    setDiscountInfo(null);
    setPromoError(null);
  };

  const bumpQty = (typeId: string, delta: number) => {
    setQty(typeId, (cart[typeId] || 0) + delta);
  };

  const removeFromCart = (typeId: string) => {
    setCart((prev) => {
      const { [typeId]: _, ...rest } = prev;
      return rest;
    });
    setDiscountInfo(null);
    setPromoError(null);
  };

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim() || cartItems.length === 0) return;
    setIsValidatingPromo(true);
    setPromoError(null);
    try {
      const seatIds: string[] = [];
      for (const item of cartItems) {
        for (let i = 0; i < item.qty; i++) {
          seatIds.push(`pseudo_${item.id}_${i}`);
        }
      }
      const res = await fetch(`${apiUrl}/promotions/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          seatIds,
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
    if (!id || !sessionId) return;
    if (cartItems.length === 0) {
      toast.error("Please add at least 1 ticket");
      return;
    }
    for (const item of cartItems) {
      if (item.qty > item.available) {
        toast.error(`Chỉ còn ${item.available} vé ${item.name}`);
        return;
      }
    }
    setIsCheckingOut(true);
    try {
      const res = await fetch(`${apiUrl}/orders/create-pending-by-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          sessionId,
          promoCode: promoCode.trim() || undefined,
          items: cartItems.map((i) => ({
            ticketTypeId: i.id,
            quantity: i.qty,
          })),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[CHECKOUT] Server error:", res.status, errText);
        throw new Error("Failed to create order. Please try again.");
      }
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error || "Failed to create order");
      if (!data.data?.orderNumber || !data.data?.accessToken) {
        throw new Error("Invalid server response");
      }
      sessionStorage.setItem("navigating_to_checkout", "true");
      window.location.replace(
        `/checkout?event=${id}&order=${data.data.orderNumber}&token=${data.data.accessToken}`,
      );
    } catch (err: unknown) {
      console.error("[CHECKOUT] error:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to proceed to checkout. Please try again.",
      );
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#e62b1e] animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
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

  const dateLabel = [event.date, event.time].filter(Boolean).join(" · ");

  return (
    // pb accounts for MobileBottomNav (~4.25rem) + cart sticky bar (~5rem)
    <div className="min-h-screen bg-[#08080a] pt-20 sm:pt-24 pb-44 lg:pb-16">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(230,43,30,0.12), transparent 60%), radial-gradient(ellipse 60% 40% at 90% 80%, rgba(230,43,30,0.06), transparent 50%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 sm:mb-10"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors mb-4 sm:mb-6 group py-2 -ml-1"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs sm:text-sm font-medium tracking-wide">
              Home
            </span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <span className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-[#e62b1e]/10 border border-[#e62b1e]/30 text-[#e62b1e] text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-3">
                <span className="w-1.5 h-1.5 bg-[#e62b1e] rounded-full animate-pulse" />
                Get Tickets
              </span>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight uppercase leading-[0.95]">
                Tickets
              </h1>
              <p className="text-gray-500 text-sm sm:text-base mt-2 max-w-md">
                {event.name}
                {event.venue ? ` · ${event.venue}` : ""}
              </p>
            </div>
            {dateLabel && (
              <p className="text-gray-600 text-xs sm:text-sm font-medium tracking-wide uppercase">
                {dateLabel}
              </p>
            )}
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Ticket cards */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {event.ticketTypes.map((tt, idx) => {
                const qty = cart[tt.id] || 0;
                const avail = availability.find(
                  (a) => a.ticketTypeId === tt.id,
                );
                const isSoldOut = avail ? avail.available <= 0 : false;
                const maxAllowed = getMaxFor(tt.id);
                const accent = tt.color || "#e62b1e";

                return (
                  <motion.div
                    key={tt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4 }}
                    className={`flex flex-col ${isSoldOut ? "opacity-50" : ""}`}
                  >
                    {/* Physical ticket card — custom image OR CSS gradient default */}
                    <div
                      className="relative overflow-hidden rounded-xl p-5 sm:p-6 min-h-[148px] sm:min-h-[168px] select-none"
                      style={
                        tt.imageUrl
                          ? {
                              backgroundColor: "#0a0a0c",
                              boxShadow:
                                "0 8px 28px -10px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
                            }
                          : cardStyle(tt.level, accent)
                      }
                    >
                      {tt.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tt.imageUrl}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 z-0 w-full h-full object-cover"
                            onError={(e) => {
                              // If remote image fails, hide broken layer (card keeps dark base)
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div
                            aria-hidden
                            className="absolute inset-0 z-[1] bg-gradient-to-br from-black/60 via-black/35 to-black/20 pointer-events-none"
                          />
                        </>
                      ) : (
                        <div
                          aria-hidden
                          className="absolute right-6 top-1/2 -translate-y-1/2 text-[72px] sm:text-[88px] font-black leading-none opacity-[0.07] pointer-events-none z-0"
                          style={{ color: accent }}
                        >
                          x
                        </div>
                      )}
                      <div
                        aria-hidden
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex flex-col gap-[2px] opacity-50"
                      >
                        {Array.from({ length: 18 }).map((_, i) => (
                          <div
                            key={i}
                            className="bg-white/80"
                            style={{
                              width: i % 3 === 0 ? 22 : i % 2 === 0 ? 16 : 20,
                              height: 1.5,
                            }}
                          />
                        ))}
                      </div>
                      <div className="relative z-[2] mb-4">
                        <Image
                          src="/logo.png"
                          alt="TEDx"
                          width={72}
                          height={24}
                          className="h-5 w-auto object-contain opacity-90 drop-shadow"
                        />
                      </div>
                      <h2 className="relative z-[2] text-2xl sm:text-[28px] font-black text-white leading-none tracking-tight mb-1.5 pr-10 drop-shadow">
                        {tt.name}
                      </h2>
                      <p
                        className="relative z-[2] text-lg sm:text-xl font-bold mb-3 drop-shadow"
                        style={{ color: tt.imageUrl ? "#fff" : accent }}
                      >
                        {formatPrice(Number(tt.price))}{" "}
                        <span className="text-xs text-white/50 font-semibold">
                          VND
                        </span>
                      </p>
                      {(tt.subtitle || dateLabel) && (
                        <p className="relative z-[2] text-[11px] sm:text-xs text-white/70 pr-8 drop-shadow">
                          {tt.subtitle || dateLabel}
                        </p>
                      )}
                      {isSoldOut && (
                        <div className="absolute top-3 left-0 z-[2] bg-[#e62b1e] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rotate-[-8deg] shadow-lg">
                          Sold Out
                        </div>
                      )}
                    </div>

                    {/* Benefits + stepper */}
                    <div className="pt-4 pb-1 flex-1 flex flex-col">
                      {tt.benefits && tt.benefits.length > 0 && (
                        <ul className="space-y-2 mb-5">
                          {tt.benefits.slice(0, 4).map((b, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-400"
                            >
                              <Check
                                className="w-3.5 h-3.5 mt-0.5 shrink-0"
                                style={{ color: accent }}
                                strokeWidth={3}
                              />
                              <span className="leading-snug">{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {avail && !isSoldOut && (
                        <p
                          className={`text-[11px] font-medium mb-3 ${
                            avail.available > 10
                              ? "text-emerald-400/70"
                              : avail.available > 3
                                ? "text-amber-400/75"
                                : "text-red-400/80"
                          }`}
                        >
                          {avail.available <= 5
                            ? `Only ${avail.available} left`
                            : `${avail.available} available`}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-center">
                        <div className="inline-flex items-center rounded-xl border border-white/[0.1] bg-white/[0.03] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => bumpQty(tt.id, -1)}
                            disabled={qty <= 0 || isSoldOut}
                            aria-label={`Decrease ${tt.name}`}
                            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-white/85 active:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minus className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                          <div className="w-12 sm:w-14 h-10 sm:h-11 flex items-center justify-center border-x border-white/[0.1] text-white text-base sm:text-lg font-semibold tabular-nums">
                            {qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => bumpQty(tt.id, 1)}
                            disabled={isSoldOut || qty >= maxAllowed}
                            aria-label={`Increase ${tt.name}`}
                            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-white/85 active:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            <Plus className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Cart sidebar — desktop only */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <CartPanel
                cartItems={cartItems}
                cartCount={cartCount}
                rawTotal={rawTotal}
                total={total}
                discountInfo={discountInfo}
                promoCode={promoCode}
                setPromoCode={setPromoCode}
                promoError={promoError}
                isValidatingPromo={isValidatingPromo}
                onApplyPromo={handleApplyPromoCode}
                onRemove={removeFromCart}
                onCheckout={handleCheckout}
                isCheckingOut={isCheckingOut}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile sticky cart dock (above bottom nav) ── */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="lg:hidden fixed left-0 right-0 z-[60] pointer-events-none"
            style={{
              bottom: "calc(4.25rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="pointer-events-auto mx-3 mb-1.5 rounded-2xl border border-white/[0.08] bg-[#111113]/96 backdrop-blur-2xl overflow-hidden shadow-[0_8px_32px_-8px_rgba(0,0,0,0.75)]">
              <div className="flex items-stretch">
                {/* Left: open cart details */}
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="min-w-0 flex-1 flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.03] transition-colors"
                  aria-label="View cart details"
                >
                  <div className="relative shrink-0 w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-white/80" />
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e62b1e] text-[10px] font-bold text-white flex items-center justify-center tabular-nums leading-none">
                      {cartCount}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-500 font-medium leading-none mb-1">
                      {cartCount} ticket{cartCount > 1 ? "s" : ""}
                      <span className="text-gray-700 mx-1.5">·</span>
                      <span className="text-gray-400">View cart</span>
                    </p>
                    <p className="text-[17px] font-semibold text-white leading-none tabular-nums tracking-tight">
                      {formatPrice(total)}
                      <span className="ml-1 text-[11px] font-medium text-gray-500">
                        VND
                      </span>
                    </p>
                    {discountInfo && (
                      <p className="text-[10px] text-emerald-400/90 mt-1 font-medium">
                        −{formatPrice(discountInfo.amount)} discount
                      </p>
                    )}
                  </div>

                  <ChevronUp className="w-4 h-4 text-gray-600 shrink-0" />
                </button>

                {/* Divider */}
                <div className="w-px self-stretch bg-white/[0.06] my-2.5" />

                {/* Right: primary CTA */}
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="shrink-0 self-center mx-2.5 h-11 px-4 rounded-xl text-[13px] font-semibold text-white bg-[#e62b1e] active:bg-[#c41e12] active:scale-[0.98] transition-all disabled:opacity-45 min-w-[6.75rem] flex items-center justify-center gap-2"
                >
                  {isCheckingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Checkout"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile cart bottom sheet */}
      <AnimatePresence>
        {cartOpen && cartCount > 0 && (
          <motion.div
            className="lg:hidden fixed inset-0 z-[70] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close cart"
              className="absolute inset-0 bg-black/70"
              onClick={() => setCartOpen(false)}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Your cart"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
              className="relative z-10 flex flex-col max-h-[min(86dvh,620px)] rounded-t-[1.35rem] border-t border-x border-white/[0.08] bg-[#111113] shadow-2xl"
              style={{
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
              }}
            >
              {/* Handle + header */}
              <div className="shrink-0 px-4 pt-2.5 pb-3 border-b border-white/[0.06]">
                <div className="flex justify-center mb-3">
                  <span className="w-9 h-1 rounded-full bg-white/15" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white tracking-tight">
                      Your cart
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {cartCount} ticket{cartCount > 1 ? "s" : ""} selected
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/[0.06] flex items-center justify-center text-gray-400 active:bg-white/10 active:text-white"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lines */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-1 min-h-0">
                <AnimatePresence initial={false}>
                  {cartItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="py-3.5 border-b border-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                            {formatPrice(Number(item.price))} VND each
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-white tabular-nums">
                            {formatPrice(item.lineTotal)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-[11px] text-gray-500 active:text-[#e62b1e] mt-1 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Quiet qty control */}
                      <div className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => bumpQty(item.id, -1)}
                          aria-label={`Decrease ${item.name}`}
                          className="w-9 h-9 flex items-center justify-center text-white/80 active:bg-white/[0.06]"
                        >
                          <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="w-10 h-9 flex items-center justify-center text-sm font-semibold text-white tabular-nums border-x border-white/[0.08]">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => bumpQty(item.id, 1)}
                          disabled={item.qty >= getMaxFor(item.id)}
                          aria-label={`Increase ${item.name}`}
                          className="w-9 h-9 flex items-center justify-center text-white/80 active:bg-white/[0.06] disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Promo */}
                <div className="pt-4 pb-2">
                  <p className="text-[11px] text-gray-500 font-medium mb-2">
                    Promo code
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) =>
                        setPromoCode(e.target.value.toUpperCase())
                      }
                      placeholder="Enter code"
                      disabled={isValidatingPromo}
                      className="flex-1 min-w-0 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 transition-colors uppercase placeholder:text-gray-600 placeholder:normal-case"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      disabled={!promoCode.trim() || isValidatingPromo}
                      className="px-4 py-2.5 bg-white/[0.06] border border-white/[0.08] active:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-30 min-w-[4.5rem]"
                    >
                      {isValidatingPromo ? "..." : "Apply"}
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-red-400/90 text-xs mt-2">{promoError}</p>
                  )}
                  {discountInfo && (
                    <div className="flex justify-between items-center mt-2.5 text-emerald-400/90 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        {discountInfo.name}
                      </span>
                      <span className="font-medium tabular-nums">
                        −{formatPrice(discountInfo.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 px-4 pt-3 pb-2 border-t border-white/[0.06] space-y-3 bg-[#111113]">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-gray-500 font-medium">
                      Total
                    </p>
                    {discountInfo && (
                      <p className="text-[11px] text-gray-600 line-through tabular-nums mt-0.5">
                        {formatPrice(rawTotal)} VND
                      </p>
                    )}
                  </div>
                  <p className="text-[22px] font-semibold text-white tabular-nums leading-none tracking-tight">
                    {formatPrice(total)}
                    <span className="ml-1 text-xs font-medium text-gray-500">
                      VND
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || cartCount < 1}
                  className="w-full min-h-[3rem] rounded-xl font-semibold text-white text-[15px] flex items-center justify-center gap-2 bg-[#e62b1e] active:bg-[#c41e12] active:scale-[0.99] disabled:opacity-40 transition-all"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Continue to checkout"
                  )}
                </button>
                <p className="text-center text-[10px] text-gray-600 pb-0.5 flex items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Secure payment
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Auto seat assign
                  </span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartPanel({
  cartItems,
  cartCount,
  rawTotal,
  total,
  discountInfo,
  promoCode,
  setPromoCode,
  promoError,
  isValidatingPromo,
  onApplyPromo,
  onRemove,
  onCheckout,
  isCheckingOut,
}: {
  cartItems: CartLine[];
  cartCount: number;
  rawTotal: number;
  total: number;
  discountInfo: { name: string; amount: number } | null;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoError: string | null;
  isValidatingPromo: boolean;
  onApplyPromo: () => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-transparent p-5 sm:p-6">
      <h3 className="text-xl font-black text-white tracking-tight mb-5 flex items-center gap-2">
        <span className="w-1 h-5 bg-[#e62b1e] rounded-full" />
        Cart
        {cartCount > 0 && (
          <span className="ml-auto text-xs font-bold text-[#e62b1e] bg-[#e62b1e]/10 px-2 py-0.5 rounded-full">
            {cartCount}
          </span>
        )}
      </h3>

      {cartItems.length === 0 ? (
        <div className="py-10 text-center">
          <ShoppingCart className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Your cart is empty</p>
          <p className="text-gray-700 text-xs mt-1">
            Use + / − on a ticket to add
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <AnimatePresence initial={false}>
            {cartItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start justify-between gap-3 py-3.5 border-b border-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-tight">
                    {item.name}{" "}
                    <span className="text-[#e62b1e] font-semibold">
                      (x{item.qty})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-gray-400">
                      {formatPrice(Number(item.price))}
                    </span>
                    <span className="mx-2 text-gray-700">·</span>
                    <span>
                      {item.available > 0
                        ? `${item.available} available`
                        : "Sold out"}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {formatPrice(item.lineTotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-[11px] text-gray-600 hover:text-[#e62b1e] transition-colors mt-0.5 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Promo code"
              disabled={isValidatingPromo}
              className="flex-1 min-w-0 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#e62b1e]/50 transition-colors uppercase placeholder:text-gray-700 placeholder:normal-case"
            />
            <button
              type="button"
              onClick={onApplyPromo}
              disabled={!promoCode.trim() || isValidatingPromo}
              className="px-3.5 py-2.5 bg-white/8 hover:bg-white/12 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-30 active:scale-95"
            >
              {isValidatingPromo ? "..." : "Apply"}
            </button>
          </div>
          {promoError && (
            <p className="text-red-400/90 text-[11px] mt-1.5">{promoError}</p>
          )}
          {discountInfo && (
            <div className="flex justify-between items-center mt-2 text-green-400/90 text-xs">
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                {discountInfo.name}
              </span>
              <span className="font-bold">
                −{formatPrice(discountInfo.amount)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between py-4 border-t border-white/[0.08]">
        <h4 className="text-lg font-black text-white">Total</h4>
        <div className="text-right">
          {discountInfo && (
            <p className="text-xs text-gray-600 line-through tabular-nums">
              {formatPrice(rawTotal)}
            </p>
          )}
          <p className="text-xl font-black text-white tabular-nums">
            {formatPrice(total)}{" "}
            <span className="text-xs text-gray-500 font-bold">VND</span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={isCheckingOut || cartCount < 1}
        className="relative w-full py-3.5 px-6 rounded-xl font-black text-white uppercase tracking-[0.15em] text-sm flex items-center justify-center gap-2 bg-[#e62b1e] hover:bg-[#c41e12] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e62b1e] shadow-lg shadow-[#e62b1e]/25 overflow-hidden group"
      >
        {!isCheckingOut && cartCount > 0 && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        )}
        {isCheckingOut ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          "Buy Now"
        )}
      </button>

      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-700 uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Secure
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" /> Auto seat assign
        </span>
      </div>
    </div>
  );
}
