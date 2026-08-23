/**
 * Checkout Store — SessionStorage-backed state for the 3-step purchase flow.
 *
 * Persists: purchased tickets, attendee info, event/order context across
 * pages. Cleared automatically after successful payment confirmation.
 */

const STORAGE_KEY = "tedx_checkout_state";

export interface AttendeeInfo {
  /** order_items.id — identifies which ticket this attendee holds. */
  orderItemId: string;
  /** Display label for the form header, e.g. "VIP". */
  ticketTypeName: string;
  name: string;
  email: string;
  phone: string;
}

/** One purchased ticket. The venue has no seat map — organisers seat people afterwards. */
export interface PurchasedTicket {
  /** order_items.id */
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  /** Hex colour assigned to this ticket type in the admin, e.g. "#10b981". */
  color?: string | null;
}

export interface CheckoutState {
  eventId: string;
  eventName: string;
  eventDate: string;
  orderNumber: string;
  accessToken: string;
  tickets: PurchasedTicket[];
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
