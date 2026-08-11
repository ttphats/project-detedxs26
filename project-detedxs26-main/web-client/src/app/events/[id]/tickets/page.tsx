"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Star,
  Ticket,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button, StepIndicator, PendingOrderModal } from "@/components";
import {
  saveCheckoutState,
  type CheckoutState,
  type SelectedSeat,
} from "@/lib/checkout-store";

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

const MAX_QTY_PER_TYPE = 10;
const MAX_TOTAL = 20;

function formatPrice(n: number) {
  return Math.round(n).toLocaleString("vi-VN");
}

function cardAccent(level: number, color: string) {
  const c = color || "#dc2626";
  if (level >= 4) {
    return `linear-gradient(135deg, rgba(220,38,38,0.18), rgba(0,0,0,0) 60%), ${c}`;
  }
  return c;
}

export default function TicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
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

  // Pending order modal state — avoid creating a duplicate order if one is already in flight
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [showPendingOrderModal, setShowPendingOrderModal] = useState(false);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${apiUrl}/events/${id}/tickets`);
        const data = await res.json();

        if (!data.success || !data.data) {
          setError(data.error || "Failed to load event data.");
          return;
        }

        const ev = data.data as EventData;
        if (!ev.ticketTypes || ev.ticketTypes.length === 0) {
          setError("No ticket types available for this event.");
          return;
        }
        setEvent(ev);

        // Check for an already-pending order before letting the user start a new one
        try {
          const pendingRes = await fetch(
            `${apiUrl}/orders/check-pending?eventId=${id}&sessionId=${sessionId}`,
          );
          const pendingData = await pendingRes.json();
          if (pendingData.success && pendingData.data) {
            setPendingOrder(pendingData.data);
            setShowPendingOrderModal(true);
          }
        } catch (err) {
          console.error("[PENDING ORDER] Failed to check:", err);
        }
      } catch (err) {
        console.error(err);
        setError("An error occurred while loading data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, apiUrl]);

  const cartItems = useMemo(() => {
    if (!event) return [];
    return event.ticketTypes
      .filter((tt) => (cart[tt.id] || 0) > 0)
      .map((tt) => {
        const qty = cart[tt.id] || 0;
        return { ...tt, qty, lineTotal: Number(tt.price) * qty };
      });
  }, [event, cart]);

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const rawTotal = cartItems.reduce((s, i) => s + i.lineTotal, 0);
  const total = Math.max(0, rawTotal - (discountInfo?.amount || 0));

  const getMaxFor = (typeId: string) => {
    const current = cart[typeId] || 0;
    const others = cartCount - current;
    const roomTotal = Math.max(0, MAX_TOTAL - others);
    return Math.min(MAX_QTY_PER_TYPE, roomTotal);
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

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim() || cartItems.length === 0) return;
    setIsValidatingPromo(true);
    setPromoError(null);
    try {
      const seatIds: string[] = [];
      for (const item of cartItems) {
        for (let i = 0; i < item.qty; i++) seatIds.push(`pseudo_${item.id}_${i}`);
      }
      const res = await fetch(`${apiUrl}/promotions/validate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, seatIds, promoCode: promoCode.trim() }),
      });
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
    if (!id || !sessionId || !event) return;
    if (cartItems.length === 0) {
      toast.error("Please select at least 1 ticket");
      return;
    }
    setIsCheckingOut(true);
    try {
      // 1) Create the pending order — backend auto-assigns real seats server-side
      const createRes = await fetch(`${apiUrl}/orders/create-pending-by-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          sessionId,
          promoCode: promoCode.trim() || undefined,
          items: cartItems.map((i) => ({ ticketTypeId: i.id, quantity: i.qty })),
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        throw new Error(createData.error || "Failed to create order. Please try again.");
      }
      const { orderNumber, accessToken } = createData.data;
      if (!orderNumber || !accessToken) {
        throw new Error("Invalid server response: missing order token");
      }

      // 2) Fetch the order back to get the REAL assigned seats (needed so
      // attendee-info can save each attendee against a real seatId later)
      const orderRes = await fetch(
        `${apiUrl}/orders/${orderNumber}?token=${encodeURIComponent(accessToken)}`,
      );
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error("Order created but failed to load its details.");
      }

      const seats = (orderData.data.seats || []) as Array<{
        seatId: string;
        seatNumber: string;
        seatType: string;
        price: number;
        ticketTypeId: string;
        ticketTypeName: string;
      }>;

      const selectedSeats: SelectedSeat[] = seats.map((s) => ({
        id: s.seatId,
        row: "",
        number: 0,
        seatNumber: s.seatNumber,
        seatType: s.ticketTypeName || s.seatType,
        price: s.price,
        ticketTypeId: s.ticketTypeId,
      }));

      const checkoutStateData: CheckoutState = {
        eventId: id,
        eventName: event.name,
        eventDate: event.date,
        orderNumber,
        accessToken,
        selectedSeats,
        attendees: [],
      };
      saveCheckoutState(checkoutStateData);

      sessionStorage.setItem("navigating_to_checkout", "true");
      const attendeeUrl = `/checkout/attendee-info?event=${id}&order=${orderNumber}&token=${accessToken}`;
      router.push(attendeeUrl);
    } catch (err: unknown) {
      console.error("[TICKETS] checkout error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to proceed to checkout. Please try again.",
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
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
    <div className="min-h-screen bg-black pt-24 pb-12">
      {/* Pending Order Modal */}
      {showPendingOrderModal && pendingOrder && (
        <PendingOrderModal
          order={pendingOrder}
          eventId={id}
          onClose={() => {
            setShowPendingOrderModal(false);
            setPendingOrder(null);
          }}
          onContinue={() => {
            setShowPendingOrderModal(false);
            setPendingOrder(null);
          }}
        />
      )}

      {/* Background effects — matches the rest of the site's dark theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-20 right-20 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "5s" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <StepIndicator currentStep={1} />

        {/* Header */}
        <div className="mb-6 sm:mb-10 animate-fade-in-down">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-4 sm:mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm sm:text-base">Back to homepage</span>
          </Link>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white ted-logo-text mb-1 sm:mb-2">
            {event.name}
          </h1>
          <p className="text-gray-400 text-sm sm:text-lg">
            {event.venue}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Ticket type cards */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            {event.ticketTypes.map((tt, idx) => {
              const qty = cart[tt.id] || 0;
              const isVIP = tt.name.toUpperCase().includes("VIP");
              const maxAllowed = getMaxFor(tt.id);
              const accent = tt.color || "#dc2626";

              return (
                <div
                  key={tt.id}
                  className="glass-panel rounded-2xl p-5 sm:p-6 animate-fade-in"
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: cardAccent(tt.level, accent) }}
                        >
                          {isVIP ? (
                            <Star className="w-5 h-5 text-white" />
                          ) : (
                            <Ticket className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                            {tt.name}
                          </h2>
                          {tt.subtitle && (
                            <p className="text-xs text-gray-400">{tt.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <p
                        className="text-xl font-black mb-3"
                        style={{ color: accent }}
                      >
                        {formatPrice(Number(tt.price))}{" "}
                        <span className="text-xs text-gray-500 font-semibold">VND</span>
                      </p>
                      {tt.benefits && tt.benefits.length > 0 && (
                        <ul className="space-y-1.5">
                          {tt.benefits.slice(0, 4).map((b, i) => (
                            <li
                              key={i}
                              className="text-xs sm:text-sm text-gray-400"
                            >
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Quantity stepper */}
                    <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-3 shrink-0">
                      <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => bumpQty(tt.id, -1)}
                          disabled={qty <= 0}
                          aria-label={`Decrease ${tt.name}`}
                          className="w-10 h-10 flex items-center justify-center text-white/85 hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className="w-12 h-10 flex items-center justify-center text-white text-base font-semibold tabular-nums border-x border-white/10">
                          {qty}
                        </div>
                        <button
                          type="button"
                          onClick={() => bumpQty(tt.id, 1)}
                          disabled={qty >= maxAllowed}
                          aria-label={`Increase ${tt.name}`}
                          className="w-10 h-10 flex items-center justify-center text-white/85 hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 glass-panel rounded-2xl p-5 sm:p-6 animate-fade-in">
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 rounded-full" />
                Order Summary
                {cartCount > 0 && (
                  <span className="ml-auto text-xs font-bold text-red-500 bg-red-600/10 px-2 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </h3>

              {cartItems.length === 0 ? (
                <p className="text-gray-500 text-sm py-6 text-center">
                  Use + / − on a ticket to add it to your order
                </p>
              ) : (
                <div className="mb-4 space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 pb-3 border-b border-white/10"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">
                          {item.name}{" "}
                          <span className="text-red-500 font-semibold">
                            (x{item.qty})
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatPrice(Number(item.price))} VND each
                        </p>
                      </div>
                      <p className="text-sm font-bold text-white tabular-nums shrink-0">
                        {formatPrice(item.lineTotal)}
                      </p>
                    </div>
                  ))}
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
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-red-500/50 transition-colors uppercase placeholder:text-gray-600 placeholder:normal-case"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      disabled={!promoCode.trim() || isValidatingPromo}
                      className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-30"
                    >
                      {isValidatingPromo ? "..." : "Apply"}
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-red-400 text-[11px] mt-1.5">{promoError}</p>
                  )}
                  {discountInfo && (
                    <div className="flex justify-between items-center mt-2 text-green-400 text-xs">
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {discountInfo.name}
                      </span>
                      <span className="font-bold">−{formatPrice(discountInfo.amount)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between py-4 border-t border-white/10">
                <h4 className="text-base font-black text-white">Total</h4>
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

              <Button
                fullWidth
                size="lg"
                onClick={handleCheckout}
                disabled={isCheckingOut || cartCount < 1}
                loading={isCheckingOut}
              >
                {isCheckingOut ? "Processing..." : "Continue"}
              </Button>

              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Secure
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Auto seat assign
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
