import {query, queryOne} from '../db/mysql.js'
import {NotFoundError} from '../utils/errors.js'
import {Event} from '../types/index.js'

function formatTime(date: Date): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function extractTagline(name: string): string {
  const match = name.match(/:\s*(.+)$/)
  return match ? match[1] : ''
}

// Get all published events
export async function getPublishedEvents(status: string = 'PUBLISHED', featured?: boolean) {
  const events = await query<Event & {speaker_count: number}>(
    `SELECT e.*, 
      (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
    FROM events e
    WHERE e.status = ?
    ORDER BY e.event_date ASC`,
    [status]
  )

  const formattedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    tagline: extractTagline(event.name),
    description: event.description,
    date: event.event_date,
    time: `${formatTime(event.doors_open_time)} - ${formatTime(event.end_time)}`,
    venue: event.venue,
    location: 'Ho Chi Minh City, Vietnam',
    bannerImageUrl: event.banner_image_url,
    thumbnailUrl: event.thumbnail_url,
    speakerCount: event.speaker_count,
    background: {
      type: 'image',
      value:
        event.banner_image_url ||
        'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
      overlay: 'linear-gradient(135deg, rgba(230,43,30,0.9) 0%, rgba(26,26,26,0.95) 100%)',
    },
    highlights: [
      {icon: 'mic', text: `${event.speaker_count || 12}+ Speakers`},
      {icon: 'lightbulb', text: 'Ideas Worth Spreading'},
      {icon: 'users', text: '500+ Attendees'},
      {icon: 'coffee', text: 'Networking Sessions'},
    ],
  }))

  if (featured && formattedEvents.length > 0) {
    return formattedEvents[0]
  }

  return formattedEvents
}

// Get event by ID
export async function getEventById(eventId: string) {
  const event = await queryOne<Event & {speaker_count: number}>(
    `SELECT e.*,
      (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
    FROM events e
    WHERE e.id = ?`,
    [eventId]
  )

  if (!event) {
    throw new NotFoundError('Event not found')
  }

  // Get ticket types
  const ticketTypes = await query<{
    id: string
    name: string
    subtitle: string | null
    description: string | null
    price: number
    benefits: string | null
  }>(
    'SELECT id, name, subtitle, description, price, benefits FROM ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY price ASC',
    [eventId]
  )

  // Get seats grouped by row
  const seats = await query<{
    id: string
    seat_number: number
    row: string
    section: string | null
    seat_type: string
    price: number
    status: string
  }>(
    'SELECT id, seat_number, row, section, seat_type, price, status FROM seats WHERE event_id = ? ORDER BY row ASC, seat_number ASC',
    [eventId]
  )

  // Map seat types to frontend-supported values
  const mapSeatType = (type: string): 'VIP' | 'STANDARD' | 'ECONOMY' => {
    const upperType = type?.toUpperCase() || 'STANDARD'
    if (upperType === 'VIP') return 'VIP'
    if (upperType === 'ECONOMY' || upperType === 'EARLY BIRD') return 'ECONOMY'
    return 'STANDARD'
  }

  // Group seats by row
  const seatMap = seats.reduce((acc, seat) => {
    const existing = acc.find((r) => r.row === seat.row)
    const seatData = {
      id: seat.id,
      seatNumber: seat.seat_number, // Add seatNumber field
      row: seat.row, // Add row field
      number: seat.seat_number, // Keep number for backwards compatibility
      status: seat.status.toLowerCase(), // Normalize to lowercase for frontend
      price: Number(seat.price), // Convert Decimal to number
      seatType: mapSeatType(seat.seat_type),
      section: seat.section,
    }
    if (existing) {
      existing.seats.push(seatData)
    } else {
      acc.push({row: seat.row, seats: [seatData]})
    }
    return acc
  }, [] as {row: string; seats: {id: string; seatNumber: number; row: string; number: number; status: string; price: number; seatType: string; section: string | null}[]}[])

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    tagline: extractTagline(event.name),
    description: event.description,
    date: event.event_date,
    time: `${formatTime(event.doors_open_time)} - ${formatTime(event.end_time)}`,
    venue: event.venue,
    location: 'Ho Chi Minh City, Vietnam',
    bannerImageUrl: event.banner_image_url,
    thumbnailUrl: event.thumbnail_url,
    speakerCount: event.speaker_count,
    status: event.status,
    maxCapacity: event.max_capacity,
    availableSeats: event.available_seats,
    ticketTypes: ticketTypes.map((tt) => ({
      id: tt.id,
      name: tt.name,
      subtitle: tt.subtitle,
      description: tt.description,
      price: tt.price,
      benefits: tt.benefits ? JSON.parse(tt.benefits) : [],
    })),
    seatMap,
  }
}

// Get event by slug
export async function getEventBySlug(slug: string) {
  const event = await queryOne<Event>('SELECT * FROM events WHERE slug = ?', [slug])

  if (!event) {
    throw new NotFoundError('Event not found')
  }

  return event
}

// Get event speakers
export async function getEventSpeakers(eventId: string) {
  // First check if eventId is an ID or slug
  let realEventId = eventId
  const eventBySlug = await queryOne<{id: string}>(
    'SELECT id FROM events WHERE slug = ? OR id = ?',
    [eventId, eventId]
  )

  if (eventBySlug) {
    realEventId = eventBySlug.id
  }

  const speakers = await query<{
    id: string
    name: string
    title: string | null
    company: string | null
    bio: string | null
    image_url: string | null
    topic: string | null
    social_links: string | null
    sort_order: number
  }>(
    `SELECT id, name, title, company, bio, image_url, topic, social_links, sort_order
     FROM speakers
     WHERE event_id = ? AND is_active = 1
     ORDER BY sort_order, name`,
    [realEventId]
  )

  return speakers.map((s) => ({
    id: s.id,
    name: s.name,
    title: s.title || '',
    company: s.company || '',
    bio: s.bio || '',
    image: s.image_url || '',
    topic: s.topic || '',
    socialLinks: s.social_links ? JSON.parse(s.social_links) : null,
  }))
}

// Get event timeline
export async function getEventTimeline(eventId: string) {
  // First check if eventId is an ID or slug
  let realEventId = eventId
  const eventBySlug = await queryOne<{id: string}>(
    'SELECT id FROM events WHERE slug = ? OR id = ?',
    [eventId, eventId]
  )

  if (eventBySlug) {
    realEventId = eventBySlug.id
  }

  const timeline = await query<{
    id: string
    start_time: string
    end_time: string
    title: string
    description: string | null
    speaker_name: string | null
    speaker_avatar_url: string | null
    type: string
    order_index: number
  }>(
    `SELECT id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index
     FROM event_timelines
     WHERE event_id = ? AND status = 'PUBLISHED'
     ORDER BY order_index, start_time`,
    [realEventId]
  )

  return timeline.map((t) => ({
    id: t.id,
    time: t.start_time,
    endTime: t.end_time,
    title: t.title,
    description: t.description || '',
    speaker: t.speaker_name || undefined,
    speakerImage: t.speaker_avatar_url || undefined,
    type: t.type.toLowerCase(),
  }))
}
