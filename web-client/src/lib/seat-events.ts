/**
 * Simple in-memory event emitter for seat updates
 * Used to broadcast seat lock/unlock events to SSE clients
 */

type SeatEventListener = (data: SeatEventData) => void

interface SeatEventData {
  eventId: string
  type: 'LOCK' | 'UNLOCK' | 'REFRESH'
  seatIds?: string[]
  sessionId?: string
  timestamp: string
}

class SeatEventEmitter {
  private listeners: Map<string, Set<SeatEventListener>> = new Map()

  /**
   * Subscribe to seat events for a specific event
   */
  on(eventId: string, listener: SeatEventListener) {
    if (!this.listeners.has(eventId)) {
      this.listeners.set(eventId, new Set())
    }
    this.listeners.get(eventId)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventId)?.delete(listener)
      if (this.listeners.get(eventId)?.size === 0) {
        this.listeners.delete(eventId)
      }
    }
  }

  /**
   * Emit seat event to all listeners
   */
  emit(data: SeatEventData) {
    const listeners = this.listeners.get(data.eventId)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          console.error('Error in seat event listener:', error)
        }
      })
    }
  }

  /**
   * Get number of active listeners for an event
   */
  getListenerCount(eventId: string): number {
    return this.listeners.get(eventId)?.size || 0
  }

  /**
   * Clear all listeners (for cleanup)
   */
  clear() {
    this.listeners.clear()
  }
}

// Singleton instance
export const seatEvents = new SeatEventEmitter()

/**
 * Helper to emit lock event
 */
export function emitSeatLock(eventId: string, seatIds: string[], sessionId: string) {
  seatEvents.emit({
    eventId,
    type: 'LOCK',
    seatIds,
    sessionId,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Helper to emit unlock event
 */
export function emitSeatUnlock(eventId: string, seatIds: string[], sessionId: string) {
  seatEvents.emit({
    eventId,
    type: 'UNLOCK',
    seatIds,
    sessionId,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Helper to emit refresh event (force all clients to refresh)
 */
export function emitSeatRefresh(eventId: string) {
  seatEvents.emit({
    eventId,
    type: 'REFRESH',
    timestamp: new Date().toISOString(),
  })
}

