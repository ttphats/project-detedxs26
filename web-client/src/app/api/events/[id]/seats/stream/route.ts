import {NextRequest} from 'next/server'
import {query, Seat, SeatLock} from '@/lib/db'
import {seatEvents} from '@/lib/seat-events'

/**
 * GET /api/events/[id]/seats/stream?sessionId=xxx
 * Server-Sent Events endpoint for real-time seat updates
 */
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{id: string}>}
) {
  const {id: eventId} = await params
  const {searchParams} = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Missing sessionId', {status: 400})
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE message
      const sendEvent = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial seat map
      try {
        const seatMap = await fetchSeatMap(eventId, sessionId)
        sendEvent({
          type: 'INITIAL',
          data: {seatMap},
          timestamp: new Date().toISOString(),
        })
      } catch (error) {
        console.error('Error fetching initial seat map:', error)
        sendEvent({
          type: 'ERROR',
          error: 'Failed to fetch seat map',
        })
      }

      // Subscribe to seat events
      const unsubscribe = seatEvents.on(eventId, async (eventData) => {
        try {
          // Fetch updated seat map
          const seatMap = await fetchSeatMap(eventId, sessionId)
          sendEvent({
            type: 'UPDATE',
            data: {seatMap, eventData},
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Error fetching updated seat map:', error)
        }
      })

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        sendEvent({type: 'HEARTBEAT', timestamp: new Date().toISOString()})
      }, 30000)

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        unsubscribe()
        controller.close()
        console.log(`[SSE] Client disconnected from event ${eventId}`)
      })

      console.log(
        `[SSE] Client connected to event ${eventId}, active listeners: ${seatEvents.getListenerCount(eventId)}`
      )
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

/**
 * Helper function to fetch seat map (same logic as /api/events/[id]/seats)
 */
async function fetchSeatMap(eventId: string, sessionId: string) {
  // Get seats for this event
  const seats = await query<Seat>(
    `SELECT id, seat_number, row, col, section, seat_type, price, status
     FROM seats
     WHERE event_id = ? AND status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'LOCKED')
     ORDER BY row, FIELD(section, 'LEFT', 'RIGHT'), col`,
    [eventId]
  )

  // Get active locks (not expired)
  const locks = await query<SeatLock>(
    `SELECT seat_id, session_id, expires_at FROM seat_locks WHERE event_id = ? AND expires_at > NOW()`,
    [eventId]
  )

  // Create lock map for quick lookup
  const lockMap = new Map(locks.map((l) => [l.seat_id, l]))

  // Group seats by row for seatMap format
  const seatsByRow = seats.reduce((acc: Record<string, Seat[]>, seat) => {
    if (!acc[seat.row]) {
      acc[seat.row] = []
    }
    acc[seat.row].push(seat)
    return acc
  }, {})

  const seatMap = Object.keys(seatsByRow)
    .sort()
    .map((row) => ({
      row,
      seats: seatsByRow[row].map((seat) => {
        const lock = lockMap.get(seat.id)
        let status: 'available' | 'sold' | 'locked' | 'locked_by_me' = 'available'

        if (seat.status === 'SOLD' || seat.status === 'RESERVED') {
          status = 'sold'
        } else if (lock) {
          // Seat is locked
          status = lock.session_id === sessionId ? 'locked_by_me' : 'locked'
        }

        return {
          id: seat.id,
          seatNumber: seat.seat_number,
          row: seat.row,
          number: seat.col,
          section: seat.section,
          status,
          seatType: seat.seat_type,
          price: Number(seat.price),
          lockExpiresAt: lock ? lock.expires_at : undefined,
        }
      }),
    }))

  return seatMap
}

