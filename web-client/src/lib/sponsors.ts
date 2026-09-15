/**
 * Sponsor categories and the confirmed baseline list for the 2026 season.
 *
 * `Partner.tier` in the database is a free string, so the set of categories
 * lives here rather than in the schema. The admin partner form offers the
 * same keys (web-admin/src/app/admin/partners/page.tsx) — keep the two lists
 * in step when adding a category.
 */

export type SponsorSize = "xl" | "lg" | "md" | "sm";

export interface SponsorCategory {
  key: string;
  label: string;
  /** Tile size — the visual weight of the category, largest first. */
  size: SponsorSize;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: string;
  website?: string | null;
  logo_url?: string | null;
  /**
   * Visual scale applied to the logo inside its tile (1 = fit). For a mark
   * whose file carries so much internal padding that it reads undersized
   * next to its neighbours. Keep it modest — the tile does not clip.
   */
  scale?: number;
}

/**
 * Display order, top to bottom. A category with no sponsors is not rendered,
 * so it is fine for most of these to sit empty in a given season.
 */
export const SPONSOR_CATEGORIES: readonly SponsorCategory[] = [
  {key: "organizer", label: "Organizer", size: "xl"},
  {key: "diamond", label: "Diamond Sponsor", size: "xl"},
  {key: "strategic", label: "Strategic Partner", size: "xl"},
  {key: "gold", label: "Gold Sponsor", size: "lg"},
  {key: "silver", label: "Silver Sponsor", size: "md"},
  {key: "bronze", label: "Bronze Sponsor", size: "md"},
  {key: "professional", label: "Professional Partner", size: "md"},
  {key: "uniform", label: "Uniform Partner", size: "md"},
  {key: "teabreak", label: "Teabreak Partner", size: "md"},
  {key: "media", label: "Media Partner", size: "sm"},
];

/**
 * Confirmed sponsors for TEDxFPTUniversityHCMC 2026.
 *
 * Each of these shows unless the database already holds a partner of the
 * same name, in which case the database entry takes over — that is how a
 * website gets attached from the admin without touching code. To remove one
 * from the site, delete it here.
 *
 * Logo files live in public/sponsors/ and are produced from the team's
 * originals by scripts/prepare-sponsor-logos.mjs. The section is white, so
 * each is the variant the brand supplies for a light background. Sponsors
 * without a logo file are left out until one arrives (The IELTS Workshop and
 * Swaganz, at the time of writing).
 */
export const SPONSOR_BASELINE: readonly Sponsor[] = [
  {id: "baseline-net-corp", name: "NET Corp", tier: "silver", logo_url: "/sponsors/net-corp.webp", website: "https://netenglish.edu.vn/"},
  {id: "baseline-onto", name: "Onto", tier: "silver", logo_url: "/sponsors/onto.webp", website: "https://onto.vn"},
  {id: "baseline-goodblend", name: "Goodblend", tier: "silver", logo_url: "/sponsors/goodblend.webp"},
  {id: "baseline-thalic", name: "Thalic Voice", tier: "silver", logo_url: "/sponsors/thalic-voice.webp", website: "https://thalic.edu.vn/"},
  {id: "baseline-cake", name: "Cake", tier: "bronze", logo_url: "/sponsors/cake.webp", website: "https://www.cake.me/"},
  {id: "baseline-okkas", name: "Okkas", tier: "uniform", logo_url: "/sponsors/okkas.webp", website: "https://dongphucokkas.com/"},
  {id: "baseline-que-chip", name: "Bánh Mì Que Chip", tier: "teabreak", logo_url: "/sponsors/banh-mi-que-chip.webp", website: "https://www.facebook.com/BMQCHip.vn"},
  // Not in the sponsorship overview, but supplied with the logo set and shown
  // as a teabreak partner on the season poster.
  {id: "baseline-dtp", name: "Diệp Trương Phát", tier: "teabreak", logo_url: "/sponsors/diep-truong-phat.webp", website: "https://dtpfoods.vn/"},
];

const byName = (name: string) => name.trim().toLowerCase();

/**
 * Database sponsors first, then every baseline entry not already present by
 * name.
 *
 * Where a database row matches a baseline entry, the baseline's logo,
 * website and scale win whenever they are set, and the row fills in only
 * what the baseline leaves blank. The baseline is curated by hand for this
 * section — prepared logo files, confirmed links — and an older value
 * sitting in the database must not quietly replace it.
 */
export function mergeSponsors(fromApi: Sponsor[]): Sponsor[] {
  const baselineByName = new Map(SPONSOR_BASELINE.map((s) => [byName(s.name), s]));
  const present = new Set(fromApi.map((s) => byName(s.name)));

  const fromDb = fromApi.map((row) => {
    const curated = baselineByName.get(byName(row.name));
    if (!curated) return row;
    return {
      ...row,
      logo_url: curated.logo_url ?? row.logo_url,
      website: curated.website ?? row.website,
      scale: curated.scale ?? row.scale,
    };
  });

  return [
    ...fromDb,
    ...SPONSOR_BASELINE.filter((s) => !present.has(byName(s.name))),
  ];
}

/** Sponsors grouped by category in display order; empty categories dropped. */
export function groupSponsors(sponsors: Sponsor[]) {
  return SPONSOR_CATEGORIES.map((category) => ({
    ...category,
    sponsors: sponsors.filter((s) => s.tier === category.key),
  })).filter((group) => group.sponsors.length > 0);
}
