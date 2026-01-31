import { query, queryOne } from '../db/mysql.js';
import { NotFoundError } from '../utils/errors.js';
import { Event } from '../types/index.js';

function formatTime(date: Date): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function extractTagline(name: string): string {
  const match = name.match(/:\s*(.+)$/);
  return match ? match[1] : '';
}

// Get all published events
export async function getPublishedEvents(status: string = 'PUBLISHED', featured?: boolean) {
  const events = await query<Event & { speaker_count: number }>(
    `SELECT e.*, 
      (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
    FROM events e
    WHERE e.status = ?
    ORDER BY e.event_date ASC`,
    [status]
  );

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
      value: event.banner_image_url || 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
      overlay: 'linear-gradient(135deg, rgba(230,43,30,0.9) 0%, rgba(26,26,26,0.95) 100%)',
    },
    highlights: [
      { icon: 'mic', text: `${event.speaker_count || 12}+ Speakers` },
      { icon: 'lightbulb', text: 'Ideas Worth Spreading' },
      { icon: 'users', text: '500+ Attendees' },
      { icon: 'coffee', text: 'Networking Sessions' },
    ],
  }));

  if (featured && formattedEvents.length > 0) {
    return formattedEvents[0];
  }

  return formattedEvents;
}

// Get event by ID
export async function getEventById(eventId: string) {
  const event = await queryOne<Event & { speaker_count: number }>(
    `SELECT e.*, 
      (SELECT COUNT(*) FROM speakers WHERE event_id = e.id AND is_active = 1) as speaker_count
    FROM events e
    WHERE e.id = ?`,
    [eventId]
  );

  if (!event) {
    throw new NotFoundError('Event not found');
  }

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
  };
}

// Get event by slug
export async function getEventBySlug(slug: string) {
  const event = await queryOne<Event>(
    'SELECT * FROM events WHERE slug = ?',
    [slug]
  );

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return event;
}

