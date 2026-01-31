import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';

/**
 * Speaker management using EventTimeline model
 * EventTimeline has speakerName, speakerAvatarUrl fields for speaker info
 */

export interface CreateSpeakerInput {
  event_id: string;
  name: string;
  title?: string;
  topic?: string;
  image_url?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  sort_order?: number;
}

export interface UpdateSpeakerInput {
  name?: string;
  title?: string;
  topic?: string;
  image_url?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  sort_order?: number;
  status?: string;
}

/**
 * List speakers (timeline items with type SPEAKER)
 */
export async function listSpeakers(eventId?: string) {
  const where: any = { type: 'SPEAKER' };
  if (eventId) {
    where.eventId = eventId;
  }

  return prisma.eventTimeline.findMany({
    where,
    include: {
      event: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
  });
}

/**
 * Get speaker by ID
 */
export async function getSpeakerById(id: string) {
  return prisma.eventTimeline.findUnique({
    where: { id },
    include: {
      event: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Create new speaker (timeline item with type SPEAKER)
 */
export async function createSpeaker(input: CreateSpeakerInput) {
  const id = randomUUID();

  return prisma.eventTimeline.create({
    data: {
      id,
      eventId: input.event_id,
      type: 'SPEAKER',
      title: input.topic || input.title || 'Speaker Session',
      description: input.description,
      speakerName: input.name,
      speakerAvatarUrl: input.image_url,
      startTime: input.start_time || '09:00',
      endTime: input.end_time || '09:30',
      orderIndex: input.sort_order ?? 0,
      status: 'DRAFT',
    },
  });
}

/**
 * Update speaker
 */
export async function updateSpeaker(id: string, input: UpdateSpeakerInput) {
  const data: any = {};

  if (input.name !== undefined) data.speakerName = input.name;
  if (input.image_url !== undefined) data.speakerAvatarUrl = input.image_url;
  if (input.topic !== undefined) data.title = input.topic;
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.start_time !== undefined) data.startTime = input.start_time;
  if (input.end_time !== undefined) data.endTime = input.end_time;
  if (input.sort_order !== undefined) data.orderIndex = input.sort_order;
  if (input.status !== undefined) data.status = input.status;

  return prisma.eventTimeline.update({
    where: { id },
    data,
  });
}

/**
 * Delete speaker
 */
export async function deleteSpeaker(id: string) {
  return prisma.eventTimeline.delete({
    where: { id },
  });
}

