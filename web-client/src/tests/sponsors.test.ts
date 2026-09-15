import { describe, it, expect } from 'vitest';
import {
  SPONSOR_BASELINE,
  SPONSOR_CATEGORIES,
  groupSponsors,
  mergeSponsors,
  type Sponsor,
} from '../lib/sponsors';

describe('Sponsor categories', () => {
  it('every baseline sponsor belongs to a known category', () => {
    const keys = new Set(SPONSOR_CATEGORIES.map((c) => c.key));
    for (const s of SPONSOR_BASELINE) {
      expect(keys.has(s.tier), `${s.name} has unknown tier "${s.tier}"`).toBe(true);
    }
  });

  it('lists every 2026 sponsor that has supplied a logo', () => {
    // The IELTS Workshop and Swaganz are confirmed sponsors but have no logo
    // file yet, so they are deliberately absent until one arrives.
    expect(SPONSOR_BASELINE.map((s) => s.name).sort()).toEqual(
      [
        'Bánh Mì Que Chip',
        'Cake',
        'Diệp Trương Phát',
        'Goodblend',
        'NET Corp',
        'Okkas',
        'Onto',
        'Thalic Voice',
      ].sort(),
    );
  });

  it('every baseline sponsor has a logo_url pointing at a real file in public/sponsors', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    for (const s of SPONSOR_BASELINE) {
      expect(s.logo_url, `${s.name} has no logo_url`).toBeTruthy();
      const file = path.join(process.cwd(), 'public', s.logo_url!);
      expect(fs.existsSync(file), `${s.name}: missing ${s.logo_url}`).toBe(true);
    }
  });
});

describe('mergeSponsors', () => {
  it('returns the full baseline when the database is empty', () => {
    expect(mergeSponsors([])).toHaveLength(SPONSOR_BASELINE.length);
  });

  it('merges a database row into the baseline entry of the same name, keeping the curated logo', () => {
    // The real database row: lowercase name, and an older logo upload on
    // Cloudinary that is the wrong variant for this section.
    const fromDb: Sponsor = {
      id: 'db-1',
      name: 'goodblend',
      tier: 'silver',
      logo_url: 'https://res.cloudinary.com/x/old-red-goodblend.png',
      website: 'https://goodblend.vn',
    };
    const merged = mergeSponsors([fromDb]);

    const goodblends = merged.filter((s) => s.name.toLowerCase() === 'goodblend');
    expect(goodblends).toHaveLength(1);
    // Identity and website come from the database…
    expect(goodblends[0].id).toBe('db-1');
    expect(goodblends[0].website).toBe('https://goodblend.vn');
    // …but the logo is the prepared local file, not the stale upload.
    expect(goodblends[0].logo_url).toBe('/sponsors/goodblend.webp');
    // Everyone else still comes from the baseline.
    expect(merged).toHaveLength(SPONSOR_BASELINE.length);
  });

  it('links every sponsor that has a confirmed website, and no one else', () => {
    const links = Object.fromEntries(
      SPONSOR_BASELINE.filter((s) => s.website).map((s) => [s.name, s.website]),
    );
    expect(links).toEqual({
      'NET Corp': 'https://netenglish.edu.vn/',
      Onto: 'https://onto.vn',
      'Thalic Voice': 'https://thalic.edu.vn/',
      Cake: 'https://www.cake.me/',
      Okkas: 'https://dongphucokkas.com/',
      'Bánh Mì Que Chip': 'https://www.facebook.com/BMQCHip.vn',
      'Diệp Trương Phát': 'https://dtpfoods.vn/',
    });
    // Goodblend has no confirmed link yet and stays unlinked.
    expect(SPONSOR_BASELINE.filter((s) => !s.website).map((s) => s.name)).toEqual(['Goodblend']);
  });

  it('prefers the curated website over one stored in the database', () => {
    const fromDb: Sponsor = {
      id: 'db-3',
      name: 'onto',
      tier: 'silver',
      website: 'https://old-onto.example',
    };
    const [onto] = mergeSponsors([fromDb]);
    expect(onto.id).toBe('db-3');
    expect(onto.website).toBe('https://onto.vn');
  });

  it('falls back to the database logo when the baseline has none for that sponsor', () => {
    const fromDb: Sponsor = {
      id: 'db-2',
      name: 'Brand New Co',
      tier: 'media',
      logo_url: 'https://res.cloudinary.com/x/brand-new.png',
    };
    const [first] = mergeSponsors([fromDb]);
    expect(first.logo_url).toBe('https://res.cloudinary.com/x/brand-new.png');
  });

  it('keeps database sponsors that are not in the baseline', () => {
    const extra: Sponsor = { id: 'db-2', name: 'Brand New Co', tier: 'media' };
    const merged = mergeSponsors([extra]);
    expect(merged).toHaveLength(SPONSOR_BASELINE.length + 1);
    expect(merged[0]).toBe(extra);
  });
});

describe('groupSponsors', () => {
  it('groups the baseline into the categories the poster uses, in display order', () => {
    const groups = groupSponsors(mergeSponsors([]));
    expect(groups.map((g) => g.key)).toEqual(['silver', 'bronze', 'uniform', 'teabreak']);
    expect(groups.find((g) => g.key === 'silver')?.sponsors).toHaveLength(4);
    expect(groups.find((g) => g.key === 'teabreak')?.sponsors.map((s) => s.name)).toEqual([
      'Bánh Mì Que Chip',
      'Diệp Trương Phát',
    ]);
  });

  it('omits categories with no sponsors', () => {
    const groups = groupSponsors([{ id: 'a', name: 'A', tier: 'media' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('media');
  });

  it('drops sponsors whose tier is not a known category rather than crashing', () => {
    const groups = groupSponsors([{ id: 'a', name: 'A', tier: 'platinum' }]);
    expect(groups).toHaveLength(0);
  });
});
