import {prisma} from '../../db/prisma.js'
import {randomUUID} from 'crypto'

/**
 * Speaker management using Speaker model
 */

export interface CreateSpeakerInput {
  event_id: string
  name: string
  title?: string
  company?: string
  bio?: string
  topic?: string
  image_url?: string
  social_links?: string
  sort_order?: number
}

export interface UpdateSpeakerInput {
  name?: string
  title?: string
  company?: string
  bio?: string
  topic?: string
  image_url?: string
  social_links?: string
  sort_order?: number
  is_active?: boolean
}

/**
 * List speakers
 */
export async function listSpeakers(eventId?: string) {
  const where: any = {}
  if (eventId) {
    where.eventId = eventId
  }

  const rawSpeakers = await prisma.speaker.findMany({
    where,
    orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}],
  })

  // Transform to snake_case for frontend
  const speakers = rawSpeakers.map((s: any) => ({
    id: s.id,
    event_id: s.eventId,
    name: s.name,
    title: s.title,
    company: s.company,
    bio: s.bio,
    image_url: s.imageUrl,
    topic: s.topic,
    social_links: s.socialLinks,
    sort_order: s.sortOrder,
    is_active: s.isActive,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }))

  // Get events for dropdown - order by status (PUBLISHED first) then date
  const events = await prisma.event.findMany({
    select: {id: true, name: true, status: true},
    orderBy: [{status: 'asc'}, {createdAt: 'desc'}],
  })

  return {speakers, events}
}

/**
 * Get speaker by ID
 */
export async function getSpeakerById(id: string) {
  const s = await prisma.speaker.findUnique({
    where: {id},
  })

  if (!s) return null

  return {
    id: s.id,
    event_id: s.eventId,
    name: s.name,
    title: s.title,
    company: s.company,
    bio: s.bio,
    image_url: s.imageUrl,
    topic: s.topic,
    social_links: s.socialLinks,
    sort_order: s.sortOrder,
    is_active: s.isActive,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

/**
 * Create new speaker
 */
export async function createSpeaker(input: CreateSpeakerInput) {
  const id = randomUUID()

  return prisma.speaker.create({
    data: {
      id,
      eventId: input.event_id,
      name: input.name,
      title: input.title,
      company: input.company,
      bio: input.bio,
      topic: input.topic,
      imageUrl: input.image_url,
      socialLinks: input.social_links,
      sortOrder: input.sort_order ?? 0,
      isActive: true,
    },
  })
}

/**
 * Update speaker
 */
export async function updateSpeaker(id: string, input: UpdateSpeakerInput) {
  const data: any = {}

  if (input.name !== undefined) data.name = input.name
  if (input.title !== undefined) data.title = input.title
  if (input.company !== undefined) data.company = input.company
  if (input.bio !== undefined) data.bio = input.bio
  if (input.topic !== undefined) data.topic = input.topic
  if (input.image_url !== undefined) data.imageUrl = input.image_url
  if (input.social_links !== undefined) data.socialLinks = input.social_links
  if (input.sort_order !== undefined) data.sortOrder = input.sort_order
  if (input.is_active !== undefined) data.isActive = input.is_active

  return prisma.speaker.update({
    where: {id},
    data,
  })
}

/**
 * Delete speaker
 */
export async function deleteSpeaker(id: string) {
  return prisma.speaker.delete({
    where: {id},
  })
}
