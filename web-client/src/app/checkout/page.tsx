"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StepIndicator, ConfirmDialog } from "@/components";
import { toast } from "sonner";
import { formatVNDate } from "@/lib/date-utils";
import {
  loadCheckoutState,
  findMissingCheckoutInfo,
  type AttendeeInfo,
} from "@/lib/checkout-store";
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  CreditCard,
  Ticket,
  QrCode,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// Type definitions for event data
interface Seat {
  id: string;
  seatNumber: string;
  row: string;
  number: number;
  section: string;
  status: string;
  ticketTypeId: string;
  seatType: string;
  price: number;
}

interface SeatRow {
  row: string;
  seats: Seat[];
}

interface EventData {
  id: string;
  name: string;
  venue: string;
  eventDate?: string;
  date?: string; // API /api/events/[id] returns 'date' instead of 'eventDate'
  seatMap: SeatRow[];
}

// Bank account info for transfer
const bankInfo = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || "Asia Commercial Bank - ACB",
  bankCode: process.env.NEXT_PUBLIC_BANK_CODE || "acb",
  bankLogo: process.env.NEXT_PUBLIC_BANK_LOGO || "/acb-logo.png",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER || "85085588",
  accountHolder:
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER || "CONG TY TNHH TICKETHUB VN",
};

// Countdown timer duration in seconds (15 minutes)
const COUNTDOWN_DURATION = 15 * 60;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventId = searchParams.get("event");
  const seatIds = searchParams.get("seats")?.split(",") || [];
  const orderNumber = searchParams.get("order"); // Order number from create-pending
  const accessToken = searchParams.get("token"); // Access token from create-pending

  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_DURATION);
  const [isExpired, setIsExpired] = useState(false);
  const [orderCode, setOrderCode] = useState("TKH000000");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);

  /**
   * What still has to be filled in before payment can be claimed.
   *
   * Checked against the order's own item count rather than the attendee rows
   * alone, so an order that never reached the holder-details step cannot slip
   * through with an empty list.
   */
  const expectedAttendees: number | undefined = Array.isArray(orderData?.items)
    ? orderData.items.length
    : undefined;
  const missingInfo = findMissingCheckoutInfo(
    formData,
    attendees,
    expectedAttendees,
  );
  const canConfirmPayment = missingInfo.length === 0 && !isExpired;

  // Debug URL params
  console.log("[CHECKOUT] URL params:", {
    eventId,
    orderNumber,
    accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null,
    seatIds: seatIds.length,
  });

  // Load order (+ event) in one path so checkout never flashes "Order Not Found"
  // after ticket-class create-pending-by-type (order has seats; no seatMap needed).
  useEffect(() => {
    let cancelled = false;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

    const applyEventFromOrder = (od: {
      eventId?: string;
      eventName?: string;
      event?: {
        id?: string;
        name?: string;
        venue?: string;
        eventDate?: string;
      };
    }) => {
      if (od?.event?.id || od?.eventName) {
        setEvent({
          id: od.event?.id || od.eventId || eventId || "",
          name: od.event?.name || od.eventName || "Event",
          venue: od.event?.venue || "",
          eventDate: od.event?.eventDate,
          date: od.event?.eventDate,
          seatMap: [],
        });
        return true;
      }
      return false;
    };

    const load = async () => {
      setLoading(true);
      setOrderError(null);

      // Legacy seat flow: no pending order yet — load event only
      if (!orderNumber || !accessToken) {
        console.log("[CHECKOUT] No order number - using legacy flow");
        if (eventId) {
          try {
            const res = await fetch(`${apiUrl}/events/${eventId}`);
            const data = await res.json();
            if (!cancelled && data.success && data.data) {
              setEvent(data.data);
            }
          } catch (err) {
            console.error("Error fetching event:", err);
          }
        }
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        console.log("[CHECKOUT] Fetching order:", orderNumber);
        const res = await fetch(
          `${apiUrl}/orders/${orderNumber}?token=${encodeURIComponent(accessToken)}`,
        );
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || "Unable to load order details");
        }

        if (cancelled) return;

        // Navigation Guard: if order is no longer PENDING, redirect away
        if (data.data.status !== "PENDING") {
          console.log("[CHECKOUT] Order is not PENDING, redirecting...");
          router.replace(
            `/order-waiting?order=${orderNumber}&token=${accessToken}`,
          );
          return;
        }

        setOrderData(data.data);
        setOrderCode(data.data.orderNumber);

        // Attendee details were collected on the previous step. Pull them in
        // so they can be confirmed here and sent with the payment, and use
        // the first attendee as the default billing contact.
        const checkoutState = loadCheckoutState();
        if (checkoutState?.attendees?.length) {
          setAttendees(checkoutState.attendees);
          const first = checkoutState.attendees[0];
          setFormData((prev) =>
            prev.name || prev.email || prev.phone
              ? prev
              : { name: first.name, email: first.email, phone: first.phone },
          );
        }
        setTimeLeft(
          typeof data.data.timeRemaining === "number"
            ? data.data.timeRemaining
            : COUNTDOWN_DURATION,
        );

        if (data.data.customerName) {
          setFormData({
            name: data.data.customerName || "",
            email: data.data.customerEmail || "",
            phone: data.data.customerPhone || "",
          });
        }

        if ((data.data.timeRemaining ?? 1) <= 0) {
          setIsExpired(true);
        }

        // Set event immediately from order payload (ticket-class has no seatMap)
        if (!applyEventFromOrder(data.data) && eventId) {
          try {
            const er = await fetch(`${apiUrl}/events/${eventId}`);
            const ed = await er.json();
            if (!cancelled && ed.success && ed.data) {
              setEvent({
                id: ed.data.id,
                name: ed.data.name,
                venue: ed.data.venue,
                eventDate: ed.data.date || ed.data.eventDate,
                date: ed.data.date || ed.data.eventDate,
                seatMap: [],
              });
            }
          } catch (err) {
            console.error("Error fetching event fallback:", err);
          }
        }

        console.log("[CHECKOUT] Order loaded:", {
          orderNumber: data.data.orderNumber,
          status: data.data.status,
          seats: data.data.seats?.length ?? data.data.items?.length ?? 0,
          timeRemaining: data.data.timeRemaining,
        });
      } catch (err) {
        console.error("Error fetching order:", err);
        if (!cancelled) {
          setOrderError(
            err instanceof Error ? err.message : "Error loading order details",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, accessToken, eventId, router]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Seat-map flow: keep seat list (legacy + /seats page).
  // Ticket-class flow: use inventory ticketLines (type × qty) — no seat numbers in UI.
  const selectedSeats: Seat[] = (() => {
    if (orderData?.seats?.length) {
      return orderData.seats.map((s: any) => ({
        id: s.seatId || s.id,
        seatNumber: s.seatNumber,
        row: s.row || String(s.seatNumber || "").replace(/[0-9]/g, "") || "?",
        number:
          parseInt(String(s.seatNumber || "").replace(/\D/g, ""), 10) || 0,
        section: s.section || "",
        status: "RESERVED",
        ticketTypeId: s.ticketTypeId || "",
        seatType: s.seatType || "",
        price: Number(s.price) || 0,
      }));
    }
    if (orderData?.items?.length) {
      return orderData.items.map((s: any, idx: number) => ({
        id: s.seatId || s.id || `item-${idx}`,
        seatNumber: s.seatNumber,
        row: String(s.seatNumber || "").replace(/[0-9]/g, "") || "?",
        number:
          parseInt(String(s.seatNumber || "").replace(/\D/g, ""), 10) || 0,
        section: "",
        status: "RESERVED",
        ticketTypeId: s.ticketTypeId || "",
        seatType: s.seatType || "",
        price: Number(s.price) || 0,
      }));
    }
    if (event?.seatMap?.length && seatIds.length) {
      return event.seatMap
        .flatMap((row) => row.seats)
        .filter((seat) => seatIds.includes(seat.id));
    }
    return [];
  })();

  type TicketLine = {
    ticketTypeId: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  };

  const isTicketClass =
    orderData?.bookingMode === "TICKET_CLASS" ||
    (Array.isArray(orderData?.ticketLines) && orderData.ticketLines.length > 0);

  const ticketLines: TicketLine[] = (() => {
    if (Array.isArray(orderData?.ticketLines) && orderData.ticketLines.length) {
      return orderData.ticketLines.map((l: any) => ({
        ticketTypeId: l.ticketTypeId ?? null,
        name: l.name || "Ticket",
        unitPrice: Number(l.unitPrice) || 0,
        quantity: Number(l.quantity) || 0,
        lineTotal:
          Number(l.lineTotal) ||
          (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0),
      }));
    }
    // Client-side group fallback from seats/items
    if (!selectedSeats.length) return [];
    const map = new Map<string, TicketLine>();
    for (const s of selectedSeats) {
      const name = s.seatType || "Ticket";
      const key = `${s.ticketTypeId || ""}|${name}|${s.price}`;
      const cur = map.get(key);
      if (cur) {
        cur.quantity += 1;
        cur.lineTotal += s.price;
      } else {
        map.set(key, {
          ticketTypeId: s.ticketTypeId || null,
          name,
          unitPrice: s.price,
          quantity: 1,
          lineTotal: s.price,
        });
      }
    }
    return Array.from(map.values());
  })();

  const hasOrderLines =
    (isTicketClass && ticketLines.length > 0) || selectedSeats.length > 0;

  const totalPrice =
    orderData?.totalAmount != null
      ? Number(orderData.totalAmount)
      : isTicketClass
        ? ticketLines.reduce((s, l) => s + l.lineTotal, 0)
        : selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  // Promotion applied when the order was created. Read from the order rather
  // than the checkout store so a reload — which clears sessionStorage — still
  // shows it.
  const discountAmount = Number(orderData?.discountAmount) || 0;
  const promoCode: string | null = orderData?.promoCode || null;
  const subtotal = Number(orderData?.subtotal) || totalPrice + discountAmount;
  const transferContent = `Ticket payment order ${orderCode}`;

  const formatENDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  /**
   * Button handler: validate first, then ask for confirmation. Submitting a
   * payment claim is not reversible from the buyer's side, so they get a
   * chance to re-check their details before it goes to the organisers.
   */
  const handleConfirmPayment = () => {
    // Re-checked here and not only through the disabled button: the button
    // could be enabled by a stale render, and the claim is irreversible.
    if (missingInfo.length > 0) {
      toast.error(`Still missing: ${missingInfo.join(", ")}`);
      return;
    }

    if (!orderNumber || !accessToken) {
      setOrderError(
        "Missing order information. Please return to the seat selection page.",
      );
      return;
    }

    setShowPayConfirm(true);
  };

  const submitPayment = async () => {
    if (!orderNumber || !accessToken) return;

    setIsProcessing(true);
    setOrderError(null);

    try {
      // Call API to confirm payment (update order status to PAID)
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const response = await fetch(`${apiUrl}/orders/confirm-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderNumber,
          accessToken,
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          attendees: attendees.length
            ? attendees.map((a) => ({
                orderItemId: a.orderItemId,
                name: a.name,
                email: a.email,
                phone: a.phone,
              }))
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to confirm payment");
      }

      console.log("[CHECKOUT] Payment confirmed for order:", orderNumber);

      // Navigate to waiting page where we poll for admin confirmation
      const waitingPath = `/order-waiting?order=${orderNumber}&token=${accessToken}`;
      router.replace(waitingPath);
    } catch (error: unknown) {
      console.error("Payment confirmation error:", error);
      setOrderError(
        error instanceof Error
          ? error.message
          : "An error occurred while confirming the payment",
      );
      setIsProcessing(false);
      // Drop back to the page so the error is visible and they can retry.
      setShowPayConfirm(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading order details...</p>
        </div>
      </div>
    );
  }

  const hasEventMeta = !!(event?.id || event?.name || orderData?.eventName);
  if (orderError && !hasOrderLines) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center glass-panel p-8 rounded-2xl max-w-md">
          <h1 className="text-2xl font-bold text-white mb-3">
            Unable to load order
          </h1>
          <p className="text-gray-400 text-sm mb-6">{orderError}</p>
          <Link
            href={eventId ? `/events/${eventId}/tickets` : "/"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors"
          >
            Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  if (!hasOrderLines || !hasEventMeta) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center glass-panel p-8 rounded-2xl max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">
            Order Not Found
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Missing order items or event info. Please start again from the
            ticket page.
          </p>
          <Link
            href={eventId ? `/events/${eventId}/tickets` : "/"}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors"
          >
            Back to tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-20 right-20 w-125 h-125 bg-red-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-20 left-20 w-100 h-100 bg-red-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "5s" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Countdown Timer - Fixed on mobile */}
        <div
          className={`fixed top-20 left-0 right-0 z-40 px-4 sm:static sm:mb-6 ${
            isExpired ? "animate-pulse" : ""
          }`}
        >
          <div
            className={`max-w-6xl mx-auto p-3 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-xl border ${
              isExpired
                ? "bg-red-900/80 border-red-500/50"
                : timeLeft <= 60
                  ? "bg-yellow-900/80 border-yellow-500/50"
                  : "bg-white/10 border-white/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {isExpired ? (
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                ) : (
                  <Clock
                    className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      timeLeft <= 60 ? "text-yellow-400" : "text-red-400"
                    }`}
                  />
                )}
                <div>
                  <p
                    className={`text-xs sm:text-sm font-medium ${
                      isExpired
                        ? "text-red-300"
                        : timeLeft <= 60
                          ? "text-yellow-300"
                          : "text-gray-300"
                    }`}
                  >
                    {isExpired
                      ? "Payment time expired"
                      : "Time remaining for payment"}
                  </p>
                </div>
              </div>

              {!isExpired && (
                <div
                  className={`flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono font-black text-lg sm:text-2xl ${
                    timeLeft <= 60
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-600/20 text-red-400"
                  }`}
                >
                  <span>{formatTime(timeLeft)}</span>
                </div>
              )}

              {isExpired && (
                <Link
                  href={`/events/${eventId}/tickets`}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  Reselect Tickets
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Spacer for fixed timer on mobile */}
        <div className="h-16 sm:hidden" />

        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-fade-in-down">
          <Link
            href={`/checkout/attendee-info?event=${encodeURIComponent(eventId || "")}&order=${encodeURIComponent(orderNumber || "")}&token=${encodeURIComponent(accessToken || "")}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to ticket details
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mt-4">
            Payment
          </h1>
        </div>

        <StepIndicator currentStep={3} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Customer Info & Bank Transfer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket holders, captured on the previous step. Shown read-only
                here so the buyer can check each ticket before paying. */}
            {attendees.length > 0 && (
              <div className="glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between gap-4 mb-5">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-red-500" />
                    </div>
                    Ticket Holders
                  </h2>
                  <Link
                    href={`/checkout/attendee-info?event=${encodeURIComponent(eventId || "")}&order=${encodeURIComponent(orderNumber || "")}&token=${encodeURIComponent(accessToken || "")}`}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors shrink-0"
                  >
                    Edit
                  </Link>
                </div>

                <div className="space-y-3">
                  {attendees.map((attendee, idx) => (
                    <div
                      key={attendee.orderItemId || idx}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Ticket {idx + 1}
                        </span>
                        {attendee.ticketTypeName && (
                          <span className="text-[11px] font-semibold text-red-400">
                            {attendee.ticketTypeName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {attendee.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 break-all">
                        {attendee.email}
                        <span className="mx-2 text-gray-700">·</span>
                        {attendee.phone}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Info */}
            <div className="glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-2xl" />

              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-red-500" />
                </div>
                Representative Customer
              </h2>

              <div className="space-y-4 relative">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all"
                      placeholder="e.g. 0901234567"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Transfer Section */}
            <div
              className="glass-panel rounded-2xl overflow-hidden animate-fade-in relative"
              style={{ animationDelay: "0.1s" }}
            >
              <div className="absolute top-0 left-0 w-48 h-48 bg-red-600/5 rounded-full blur-2xl -translate-y-1/2 -translate-x-1/2" />

              <div className="border-l-4 border-red-500 px-6 py-4 bg-red-600/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-red-500" />
                  Bank Transfer Payment
                </h2>
              </div>

              <div className="p-6 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bank Info Left */}
                  <div className="space-y-5">
                    {/* Bank Name */}
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <div className="w-12 h-12 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-red-500/30">
                        {bankInfo.bankCode.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {bankInfo.bankName}
                        </p>
                      </div>
                    </div>

                    {/* Account Number */}
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-red-400 mb-1">
                        Account Number
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white">
                          {bankInfo.accountNumber}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(bankInfo.accountNumber, "account")
                          }
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {copiedField === "account" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Account Holder */}
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-red-400 mb-1">
                        Account Holder
                      </p>
                      <p className="font-semibold text-white">
                        {bankInfo.accountHolder}
                      </p>
                    </div>

                    {/* Transfer Content */}
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-sm text-red-400 mb-1">
                        Transfer Content
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {transferContent}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(transferContent, "content")
                          }
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {copiedField === "content" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="p-4 bg-linear-to-r from-red-600/20 to-red-600/10 rounded-xl border border-red-500/30">
                      <p className="text-sm text-red-400 mb-1">Amount</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-red-500">
                          {totalPrice.toLocaleString("en-US")} VND
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(totalPrice.toString(), "amount")
                          }
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          {copiedField === "amount" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Right */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-sm text-gray-400 mb-4 text-center">
                      Scan the QR code using your mobile banking
                      <br />
                      or e-wallet app to pay
                    </p>
                    <div className="border-2 border-white/10 rounded-2xl p-4 bg-white relative overflow-hidden">
                      {/* VietQR Header */}
                      <div className="flex items-center justify-center gap-1 mb-3">
                        <span className="text-blue-600 font-bold text-lg">
                          Viet
                        </span>
                        <span className="text-red-500 font-bold text-lg">
                          QR
                        </span>
                      </div>
                      {/* QR Code Image */}
                      <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center relative overflow-hidden p-2">
                        {totalPrice > 0 ? (
                          <img
                            src={`https://img.vietqr.io/image/${bankInfo.bankCode}-${bankInfo.accountNumber}-qr_only.png?amount=${Math.round(totalPrice)}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankInfo.accountHolder)}`}
                            alt="VietQR Code"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center text-gray-400 text-xs">
                            Generating QR Code...
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
                        <span className="text-blue-600 font-semibold">
                          napas
                        </span>
                        <span>247</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-500 font-bold">
                          {bankInfo.bankCode.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div
                className="glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden"
                style={{ animationDelay: "0.2s" }}
              >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl" />

                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-red-500" />
                  </div>
                  Order Summary
                </h2>

                <div className="mb-4 pb-4 border-b border-white/10">
                  <p className="font-semibold text-white">
                    {event?.name || orderData?.eventName || "Event"}
                  </p>
                  <p className="text-sm text-gray-400">
                    {formatENDate(
                      event?.eventDate ||
                        event?.date ||
                        orderData?.event?.eventDate ||
                        "",
                    )}
                  </p>
                </div>

                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                  {isTicketClass
                    ? ticketLines.map((line, idx) => (
                        <div
                          key={`${line.ticketTypeId || line.name}-${idx}`}
                          className="flex justify-between text-sm py-2 border-b border-white/5 gap-3"
                        >
                          <span className="text-gray-300 min-w-0">
                            <span className="text-white font-medium">
                              {line.name}
                            </span>
                            <span className="text-gray-500">
                              {" "}
                              × {line.quantity}
                            </span>
                            {line.unitPrice > 0 && (
                              <span className="block text-[11px] text-gray-600 mt-0.5">
                                {line.unitPrice.toLocaleString("en-US")} VND
                                each
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-white shrink-0 tabular-nums">
                            {line.lineTotal.toLocaleString("en-US")} VND
                          </span>
                        </div>
                      ))
                    : selectedSeats.map((seat) => (
                        <div
                          key={seat.id}
                          className="flex justify-between text-sm py-2 border-b border-white/5"
                        >
                          <span className="text-gray-300">
                            Seat {seat.seatNumber}
                          </span>
                          <span className="font-medium text-white">
                            {seat.price.toLocaleString("en-US")} VND
                          </span>
                        </div>
                      ))}
                </div>

                {/* The order's total is already net of any promotion, so
                    without these two rows the discount simply vanishes from
                    the buyer's view at the last step. */}
                {discountAmount > 0 && (
                  <div className="px-4 space-y-2 mb-3 text-sm">
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Subtotal</span>
                      <span className="tabular-nums">
                        {subtotal.toLocaleString("en-US")} VND
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        Discount
                        {promoCode && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-[10px] font-bold uppercase tracking-wide">
                            {promoCode}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums font-semibold">
                        −{discountAmount.toLocaleString("en-US")} VND
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-linear-to-r from-red-600/20 to-transparent rounded-xl mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Total</span>
                    <span className="text-2xl font-black text-red-500">
                      {totalPrice.toLocaleString("en-US")} VND
                    </span>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-400">
                        Payment Timeout
                      </p>
                      <p className="text-xs text-yellow-500/80">
                        Please complete payment within 15 minutes
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {orderError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                      <p className="text-sm text-red-400">{orderError}</p>
                    </div>
                  </div>
                )}

                {/* A disabled button with no explanation is a dead end, so
                    say exactly what is outstanding and link back to the step
                    that fixes it. */}
                {missingInfo.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="text-amber-300 font-semibold mb-1">
                          Complete your details before confirming payment
                        </p>
                        <ul className="text-amber-200/80 list-disc list-inside space-y-0.5">
                          {missingInfo.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        {attendees.length > 0 || expectedAttendees ? (
                          <Link
                            href={`/checkout/attendee-info?event=${encodeURIComponent(eventId || "")}&order=${encodeURIComponent(orderNumber || "")}&token=${encodeURIComponent(accessToken || "")}`}
                            className="inline-block mt-2 text-amber-300 underline hover:text-amber-200"
                          >
                            Edit ticket holder details
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConfirmPayment}
                  disabled={isProcessing || !canConfirmPayment}
                  className="relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <span className="relative">
                    {isProcessing ? "Processing..." : "I Have Paid"}
                  </span>
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  After transferring, please click &quot;I Have Paid&quot; to
                  confirm
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showPayConfirm}
        busy={isProcessing}
        title="Confirm your details"
        message={
          <>
            <p className="mb-4">
              Please check these details are correct. Each ticket is emailed to
              its own holder, so a wrong address means that person won&apos;t
              receive their ticket.
            </p>

            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
              Representative customer
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-white">
                {formData.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 break-all">
                {formData.email}
                <span className="mx-2 text-gray-700">·</span>
                {formData.phone}
              </p>
            </div>

            {attendees.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-4 mb-2">
                  Ticket holders ({attendees.length})
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {attendees.map((a, idx) => (
                    <div
                      key={a.orderItemId || idx}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Ticket {idx + 1}
                        </span>
                        {a.ticketTypeName && (
                          <span className="text-[11px] font-semibold text-[#ff6b5e]">
                            {a.ticketTypeName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {a.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 break-all">
                        {a.email}
                        <span className="mx-2 text-gray-700">·</span>
                        {a.phone}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        }
        confirmLabel="Yes, I have paid"
        cancelLabel="Let me check again"
        onConfirm={submitPayment}
        onCancel={() => setShowPayConfirm(false)}
      />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
