import { prisma } from '../../db/prisma.js';

/**
 * Helper to generate slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface CreateEventInput {
  name: string;
  description?: string;
  venue: string;
  event_date: string;
  doors_open_time?: string;
  start_time?: string;
  end_time?: string;
  max_capacity?: number;
  banner_image_url?: string;
  thumbnail_url?: string;
  status?: string;
}

export interface UpdateEventInput {
  name?: string;
  description?: string;
  venue?: string;
  event_date?: string;
  doors_open_time?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  max_capacity?: number;
  available_seats?: number;
  banner_image_url?: string;
  thumbnail_url?: string;
  is_published?: boolean;
}

/**
 * List all events with stats
 */
export async function listEvents(status?: string) {
  const where: any = {};
  if (status) where.status = status;

  const events = await prisma.event.findMany({
    where,
    include: {
      _count: {
        select: {
          seats: true,
          orders: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' }, // PUBLISHED first
      { eventDate: 'desc' },
    ],
  });

  // Get additional stats
  const eventsWithStats = await Promise.all(
    events.map(async (event) => {
      const bookedSeats = await prisma.seat.count({
        where: { eventId: event.id, status: 'SOLD' },
      });

      return {
        ...event,
        total_seats: event._count.seats,
        booked_seats: bookedSeats,
        order_count: event._count.orders,
      };
    })
  );

  return eventsWithStats;
}

/**
 * Get event by ID
 */
export async function getEventById(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      seats: {
        select: { id: true, seatNumber: true, status: true, seatType: true, price: true },
        take: 100,
      },
      timelines: {
        orderBy: { orderIndex: 'asc' },
        where: { status: 'PUBLISHED' },
      },
    },
  });
}

/**
 * Create new event
 */
export async function createEvent(input: CreateEventInput) {
  const slug = slugify(input.name);

  // Check if slug exists
  const existing = await prisma.event.findFirst({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const id = `evt-${slugify(input.name)}-${Date.now().toString(36)}`;

  return prisma.event.create({
    data: {
      id,
      name: input.name,
      slug: finalSlug,
      description: input.description,
      venue: input.venue,
      eventDate: new Date(input.event_date),
      doorsOpenTime: input.doors_open_time ? new Date(input.doors_open_time) : new Date(input.event_date),
      startTime: input.start_time ? new Date(input.start_time) : new Date(input.event_date),
      endTime: input.end_time ? new Date(input.end_time) : new Date(input.event_date),
      status: input.status || 'DRAFT',
      maxCapacity: input.max_capacity || 100,
      availableSeats: input.max_capacity || 100,
      bannerImageUrl: input.banner_image_url,
      thumbnailUrl: input.thumbnail_url,
      isPublished: input.status === 'PUBLISHED',
    },
  });
}

/**
 * Update event
 */
export async function updateEvent(id: string, input: UpdateEventInput) {
  const data: any = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.venue !== undefined) data.venue = input.venue;
  if (input.event_date !== undefined) data.eventDate = new Date(input.event_date);
  if (input.doors_open_time !== undefined) data.doorsOpenTime = new Date(input.doors_open_time);
  if (input.start_time !== undefined) data.startTime = new Date(input.start_time);
  if (input.end_time !== undefined) data.endTime = new Date(input.end_time);
  if (input.status !== undefined) data.status = input.status;
  if (input.max_capacity !== undefined) data.maxCapacity = input.max_capacity;
  if (input.available_seats !== undefined) data.availableSeats = input.available_seats;
  if (input.banner_image_url !== undefined) data.bannerImageUrl = input.banner_image_url;
  if (input.thumbnail_url !== undefined) data.thumbnailUrl = input.thumbnail_url;
  
  if (input.is_published !== undefined) {
    data.isPublished = input.is_published;
    if (input.is_published) {
      data.publishedAt = new Date();
    }
  }

  return prisma.event.update({ where: { id }, data });
}

/**
 * Delete event (only if no booked seats)
 */
export async function deleteEvent(id: string) {
  // Check for booked seats
  const bookedCount = await prisma.seat.count({
    where: { eventId: id, status: 'SOLD' },
  });

  if (bookedCount > 0) {
    throw new Error(`Cannot delete event with ${bookedCount} booked seats`);
  }

  // Delete related data first
  await prisma.seat.deleteMany({ where: { eventId: id } });
  await prisma.eventTimeline.deleteMany({ where: { eventId: id } });
  await prisma.seatLayout.deleteMany({ where: { eventId: id } });

  return prisma.event.delete({ where: { id } });
}

