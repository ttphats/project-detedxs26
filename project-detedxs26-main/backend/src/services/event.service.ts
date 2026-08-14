import {query, queryOne} from '../db/mysql.js'
import {NotFoundError} from '../utils/errors.js'
import {Event} from '../types/index.js'

function formatTime(date: Date): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Ho_Chi_Minh',
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
    level: number
    color: string
  }>(
    'SELECT id, name, subtitle, description, price, benefits, level, color FROM ticket_types WHERE event_id = ? AND is_active = 1 ORDER BY level ASC',
    [eventId]
  )

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
      level: tt.level,
      color: tt.color,
    }))
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
    status: string
  }>(
    `SELECT id, start_time, end_time, title, description, speaker_name, speaker_avatar_url, type, order_index, status
     FROM event_timelines
     WHERE event_id = ? AND status IN ('PUBLISHED', 'COMPLETED')
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
    status: t.status,
  }))
}

/**
 * Ticket-class page: event meta + ticket types, including how many of each
 * type are still available so the UI can stop customers selecting a type
 * that's already gone. Stock is still enforced server-side at
 * order-creation time — this is the shop window, not the gate.
 */
export async function getEventTickets(eventIdOrSlug: string) {
  // First check if eventId is an ID or slug
  let realEventId = eventIdOrSlug
  const eventBySlug = await queryOne<{id: string}>(
    'SELECT id FROM events WHERE slug = ? OR id = ?',
    [eventIdOrSlug, eventIdOrSlug]
  )
  if (eventBySlug) {
    realEventId = eventBySlug.id
  }

  const event = await queryOne<Event>(
    `SELECT id, name, slug, description, event_date, doors_open_time, end_time,
            venue, status, banner_image_url, thumbnail_url
     FROM events WHERE id = ?`,
    [realEventId]
  )
  if (!event) throw new NotFoundError('Event not found')

  type TtRow = {
    id: string
    name: string
    subtitle: string | null
    description: string | null
    price: number
    benefits: string | null
    level: number
    color: string
    icon: string | null
    image_url: string | null
    max_quantity: number | null
    sort_order: number
  }

  const ticketTypeRows = await query<TtRow>(
    `SELECT id, name, subtitle, description, price, benefits, level, color, icon,
            image_url, max_quantity, sort_order
     FROM ticket_types
     WHERE event_id = ? AND is_active = 1
     ORDER BY sort_order ASC, level ASC, name ASC`,
    [realEventId]
  )

  // How many tickets of each type are already spoken for. Mirrors the
  // guard in order.service.ts: PENDING counts only while unexpired, so
  // abandoned carts free their stock automatically.
  const takenRows = await query<{ticket_type_id: string; taken: number}>(
    `SELECT oi.ticket_type_id, COUNT(*) AS taken
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.event_id = ?
       AND oi.ticket_type_id IS NOT NULL
       AND o.status IN ('PAID', 'PENDING_CONFIRMATION', 'PENDING')
       AND (o.status <> 'PENDING' OR o.expires_at > NOW())
     GROUP BY oi.ticket_type_id`,
    [realEventId]
  )
  const takenByType = new Map(takenRows.map((r) => [r.ticket_type_id, Number(r.taken)]))

  const ticketTypes = ticketTypeRows.map((tt) => {
    let benefits: string[] = []
    if (tt.benefits) {
      try {
        const parsed = typeof tt.benefits === 'string' ? JSON.parse(tt.benefits) : tt.benefits
        benefits = Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        benefits = []
      }
    }

    return {
      id: tt.id,
      name: tt.name,
      subtitle: tt.subtitle,
      description: tt.description,
      price: Number(tt.price),
      benefits,
      level: Number(tt.level) || 1,
      color: tt.color || '#e62b1e',
      icon: tt.icon || null,
      // Ticket artwork shown on the purchase page; null falls back to the icon tile.
      imageUrl: tt.image_url || null,
      maxQuantity: tt.max_quantity != null ? Number(tt.max_quantity) : null,
      // null = unlimited. Never negative, even if a type was oversold
      // before limits existed.
      remaining:
        tt.max_quantity != null
          ? Math.max(0, Number(tt.max_quantity) - (takenByType.get(tt.id) || 0))
          : null,
      soldOut:
        tt.max_quantity != null &&
        Number(tt.max_quantity) - (takenByType.get(tt.id) || 0) <= 0,
      sortOrder: Number(tt.sort_order) || 0,
    }
  })

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    tagline: extractTagline(event.name),
    description: event.description,
    date: event.event_date,
    time: `${formatTime(event.doors_open_time)} - ${formatTime(event.end_time)}`,
    venue: event.venue,
    status: event.status,
    bannerImageUrl: event.banner_image_url,
    thumbnailUrl: event.thumbnail_url,
    ticketTypes,
  }
}
