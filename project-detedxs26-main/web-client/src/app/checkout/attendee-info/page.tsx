"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { StepIndicator } from "@/components";
import {
  loadCheckoutState,
  saveAttendees,
  type AttendeeInfo,
  type CheckoutState,
  buildSeatLabel,
} from "@/lib/checkout-store";

function AttendeeInfoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("event");
  const orderNumber = searchParams.get("order");
  const accessToken = searchParams.get("token");

  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(
    null,
  );
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load checkout state on mount
  useEffect(() => {
    const state = loadCheckoutState();
    if (!state || !state.selectedSeats?.length) {
      // No checkout state — redirect back to home
      router.replace("/");
      return;
    }
    setCheckoutState(state);

    // Initialize attendee forms from saved state or create empty ones
    if (state.attendees?.length === state.selectedSeats.length) {
      setAttendees(state.attendees);
    } else {
      const initialAttendees: AttendeeInfo[] = state.selectedSeats.map(
        (seat) => ({
          seatId: seat.id,
          seatLabel: buildSeatLabel(seat),
          name: "",
          email: "",
          phone: "",
        }),
      );
      setAttendees(initialAttendees);
    }
  }, [router]);

  const updateAttendee = (
    index: number,
    field: keyof AttendeeInfo,
    value: string,
  ) => {
    setAttendees((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    // Clear error for this field
    const errorKey = `${index}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    attendees.forEach((attendee, index) => {
      if (!attendee.name.trim()) {
        newErrors[`${index}-name`] = "Name is required";
      }
      if (!attendee.email.trim()) {
        newErrors[`${index}-email`] = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email.trim())) {
        newErrors[`${index}-email`] = "Invalid email format";
      }
      if (!attendee.phone.trim()) {
        newErrors[`${index}-phone`] = "Phone is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) {
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const [index] = firstErrorKey.split("-");
        const el = document.getElementById(`attendee-block-${index}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);

    // Save attendees to checkout store
    saveAttendees(attendees);

    // Navigate to payment page
    const paymentUrl = `/checkout?event=${eventId}&order=${orderNumber}&token=${accessToken}`;
    router.push(paymentUrl);
  };

  const handleBack = () => {
    // Save current progress
    if (attendees.length > 0) {
      saveAttendees(attendees);
    }
    // Go back to ticket selection
    if (eventId) {
      router.push(`/events/${eventId}/tickets`);
    } else {
      router.back();
    }
  };

  // Loading / invalid state
  if (!checkoutState) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const totalPrice = checkoutState.selectedSeats.reduce(
    (sum, seat) => sum + Number(seat.price),
    0,
  );

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      {/* Background effects */}
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

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Step Indicator */}
        <StepIndicator currentStep={2} />

        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-fade-in-down">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group mb-4"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to ticket selection
          </button>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
            Attendee Information
          </h1>
          <p className="text-gray-400 mt-2">
            Please fill in the details for each ticket holder
          </p>
        </div>

        {/* Attendee Forms */}
        <div className="space-y-6 mb-8">
          {attendees.map((attendee, index) => {
            const seat = checkoutState.selectedSeats[index];
            const seatColor =
              seat?.seatType === "VIP"
                ? "from-orange-600/20 to-orange-600/5"
                : "from-emerald-600/20 to-emerald-600/5";
            const seatBorderColor =
              seat?.seatType === "VIP"
                ? "border-orange-500/30"
                : "border-emerald-500/30";
            const seatTextColor =
              seat?.seatType === "VIP" ? "text-orange-400" : "text-emerald-400";

            return (
              <div
                key={attendee.seatId}
                id={`attendee-block-${index}`}
                className="glass-panel rounded-2xl overflow-hidden animate-fade-in relative"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {/* Header with seat info */}
                <div
                  className={`bg-gradient-to-r ${seatColor} px-6 py-4 border-b ${seatBorderColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/10`}
                      >
                        <User className={`w-5 h-5 ${seatTextColor}`} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">
                          Attendee {index + 1}
                        </p>
                        <p className={`text-sm ${seatTextColor}`}>
                          {attendee.seatLabel}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full bg-white/10 ${seatTextColor}`}
                    >
                      {Number(seat?.price || 0).toLocaleString()} VND
                    </span>
                  </div>
                </div>

                {/* Form fields */}
                <div className="p-6 space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <User className="w-4 h-4 text-gray-500" />
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) =>
                        updateAttendee(index, "name", e.target.value)
                      }
                      className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${
                        errors[`${index}-name`]
                          ? "border-red-500/50"
                          : "border-white/10"
                      }`}
                      placeholder="John Doe"
                    />
                    {errors[`${index}-name`] && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {errors[`${index}-name`]}
                      </p>
                    )}
                  </div>

                  {/* Email & Phone row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={attendee.email}
                        onChange={(e) =>
                          updateAttendee(index, "email", e.target.value)
                        }
                        className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${
                          errors[`${index}-email`]
                            ? "border-red-500/50"
                            : "border-white/10"
                        }`}
                        placeholder="email@example.com"
                      />
                      {errors[`${index}-email`] && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {errors[`${index}-email`]}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={attendee.phone}
                        onChange={(e) =>
                          updateAttendee(index, "phone", e.target.value)
                        }
                        className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-white placeholder-gray-500 transition-all ${
                          errors[`${index}-phone`]
                            ? "border-red-500/50"
                            : "border-white/10"
                        }`}
                        placeholder="0901234567"
                      />
                      {errors[`${index}-phone`] && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {errors[`${index}-phone`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary & Continue */}
        <div className="glass-panel rounded-2xl p-6 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl" />

          <div className="relative">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-9 h-9 bg-red-600/20 rounded-xl flex items-center justify-center">
                <Ticket className="w-4 h-4 text-red-500" />
              </span>
              Order Summary
            </h2>

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm">
                    {attendees.length} ticket{attendees.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 text-sm">
                  {checkoutState.eventName}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-2xl font-black text-red-500">
                  {totalPrice.toLocaleString()} VND
                </p>
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin relative" />
                  <span className="relative">Processing...</span>
                </>
              ) : (
                <>
                  <span className="relative">Continue to Payment</span>
                  <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Glow effect under button */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-red-600/50 blur-xl rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttendeeInfoPage() {
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
      <AttendeeInfoContent />
    </Suspense>
  );
}
