import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser, requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ForbiddenError } from '@/lib/utils';
import { slugify } from '@/lib/utils';

const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  venue: z.string().min(3, 'Venue is required'),
  eventDate: z.string().datetime(),
  doorsOpenTime: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  maxCapacity: z.number().int().positive(),
  bannerImageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
});

// GET /api/events - List all events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          venue: true,
          eventDate: true,
          doorsOpenTime: true,
          startTime: true,
          endTime: true,
          status: true,
          maxCapacity: true,
          availableSeats: true,
          bannerImageUrl: true,
          thumbnailUrl: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.event.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error: any) {
    console.error('Get events error:', error);
    return NextResponse.json(
      errorResponse('Failed to fetch events'),
      { status: 500 }
    );
  }
}

// POST /api/events - Create new event (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Check if user is admin
    try {
      requireAdmin(user);
    } catch {
      throw new ForbiddenError();
    }

    // Parse and validate input
    const body = await request.json();
    const input = createEventSchema.parse(body);

    // Generate slug
    const slug = slugify(input.name);

    // Check if slug already exists
    const existingEvent = await prisma.event.findUnique({
      where: { slug },
    });

    if (existingEvent) {
      return NextResponse.json(
        errorResponse('Event with this name already exists'),
        { status: 409 }
      );
    }

    // Create event
    const event = await prisma.event.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        venue: input.venue,
        eventDate: new Date(input.eventDate),
        doorsOpenTime: new Date(input.doorsOpenTime),
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        maxCapacity: input.maxCapacity,
        availableSeats: input.maxCapacity,
        bannerImageUrl: input.bannerImageUrl,
        thumbnailUrl: input.thumbnailUrl,
        status: 'DRAFT',
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'CREATE',
        entity: 'Event',
        entityId: event.id,
        changes: JSON.stringify({ created: input }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      successResponse(event, 'Event created successfully'),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create event error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 401 }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 403 }
      );
    }

    return NextResponse.json(
      errorResponse('Failed to create event'),
      { status: 500 }
    );
  }
}

