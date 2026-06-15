import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';

export interface CreatePartnerInput {
  name: string;
  tier: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  sort_order?: number;
  show_in_marquee?: boolean;
}

export interface UpdatePartnerInput {
  name?: string;
  tier?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  sort_order?: number;
  is_active?: boolean;
  show_in_marquee?: boolean;
}

/**
 * List all partners for admin
 */
export async function listPartners() {
  const rawPartners = await prisma.partner.findMany({
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  // Transform to snake_case for frontend
  return rawPartners.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    website: p.website,
    logo_url: p.logoUrl,
    banner_url: p.bannerUrl,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    show_in_marquee: p.showInMarquee,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  }));
}

/**
 * List active partners for public web-client
 */
export async function listPublicPartners() {
  const rawPartners = await prisma.partner.findMany({
    where: {
      isActive: true
    },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'desc' }
    ]
  });

  return rawPartners.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    website: p.website,
    logo_url: p.logoUrl,
    banner_url: p.bannerUrl,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    show_in_marquee: p.showInMarquee
  }));
}

/**
 * Get partner by ID
 */
export async function getPartnerById(id: string) {
  const p = await prisma.partner.findUnique({
    where: { id }
  });

  if (!p) return null;

  return {
    id: p.id,
    name: p.name,
    tier: p.tier,
    website: p.website,
    logo_url: p.logoUrl,
    banner_url: p.bannerUrl,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    show_in_marquee: p.showInMarquee,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

/**
 * Create new partner
 */
export async function createPartner(input: CreatePartnerInput) {
  const id = randomUUID();

  const p = await prisma.partner.create({
    data: {
      id,
      name: input.name,
      tier: input.tier,
      website: input.website || null,
      logoUrl: input.logo_url || null,
      bannerUrl: input.banner_url || null,
      sortOrder: input.sort_order ?? 0,
      isActive: true,
      showInMarquee: input.show_in_marquee ?? false
    }
  });

  return {
    id: p.id,
    name: p.name,
    tier: p.tier,
    website: p.website,
    logo_url: p.logoUrl,
    banner_url: p.bannerUrl,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    show_in_marquee: p.showInMarquee,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

/**
 * Update partner
 */
export async function updatePartner(id: string, input: UpdatePartnerInput) {
  const data: any = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.tier !== undefined) data.tier = input.tier;
  if (input.website !== undefined) data.website = input.website;
  if (input.logo_url !== undefined) data.logoUrl = input.logo_url;
  if (input.banner_url !== undefined) data.bannerUrl = input.banner_url;
  if (input.sort_order !== undefined) data.sortOrder = input.sort_order;
  if (input.is_active !== undefined) data.isActive = input.is_active;
  if (input.show_in_marquee !== undefined) data.showInMarquee = input.show_in_marquee;

  const p = await prisma.partner.update({
    where: { id },
    data
  });

  return {
    id: p.id,
    name: p.name,
    tier: p.tier,
    website: p.website,
    logo_url: p.logoUrl,
    banner_url: p.bannerUrl,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    show_in_marquee: p.showInMarquee,
    created_at: p.createdAt,
    updated_at: p.updatedAt
  };
}

/**
 * Delete partner
 */
export async function deletePartner(id: string) {
  return prisma.partner.delete({
    where: { id }
  });
}
