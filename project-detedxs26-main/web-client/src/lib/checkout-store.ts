/**
 * Checkout Store — SessionStorage-backed state for the 3-step purchase flow.
 *
 * Persists: selected seats, attendee info, event/order context across pages.
 * Cleared automatically after successful payment confirmation.
 */

const STORAGE_KEY = "tedx_checkout_state";

export interface AttendeeInfo {
  seatId: string;
  seatLabel: string; // e.g. "A3 — VIP"
  name: string;
  email: string;
  phone: string;
}

export interface SelectedSeat {
  id: string;
  row: string;
  number: number;
  seatNumber?: string;
  section?: string;
  seatType?: string;
  level?: number;
  price: number;
  ticketTypeId: string;
}

export interface CheckoutState {
  eventId: string;
  eventName: string;
  eventDate: string;
  orderNumber: string;
  accessToken: string;
  selectedSeats: SelectedSeat[];
  attendees: AttendeeInfo[];
}

/** Save checkout state to sessionStorage */
export function saveCheckoutState(state: CheckoutState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("[CHECKOUT STORE] Failed to save state:", err);
  }
}

/** Load checkout state from sessionStorage (returns null if missing/invalid) */
export function loadCheckoutState(): CheckoutState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutState;
  } catch (err) {
    console.error("[CHECKOUT STORE] Failed to load state:", err);
    return null;
  }
}

/** Clear checkout state from sessionStorage */
export function clearCheckoutState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Update only the attendees portion of the state */
export function saveAttendees(attendees: AttendeeInfo[]): void {
  const state = loadCheckoutState();
  if (!state) return;
  state.attendees = attendees;
  saveCheckoutState(state);
}

/**
 * Human-readable label for an attendee form header.
 * Ticket-class flow: seats are auto-assigned server-side and never shown to
 * the buyer, so the label is the purchased ticket type (e.g. "VIP"), not a
 * seat code.
 */
export function buildSeatLabel(seat: SelectedSeat): string {
  return seat.seatType || "STANDARD";
}
