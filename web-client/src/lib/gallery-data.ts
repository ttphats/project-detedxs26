/**
 * Gallery seasons.
 *
 * Photos live in `public/gallery/<year>/`. Their filenames were normalised on
 * import — the originals contained spaces and parentheses, which have to be
 * percent-encoded in a URL and are a common source of images that load on
 * Windows and 404 on the Linux server.
 *
 * Each season carries its own blurb: the year buttons switch the whole story,
 * not just the pictures, so a visitor landing on 2023 reads about 2023.
 */

export interface GalleryPhoto {
  src: string;
  /** Derived from the filename — drives the filter chips and the alt text. */
  category: string;
}

export interface GallerySeason {
  year: string;
  /** Event theme for that edition, shown under the year. */
  theme: string;
  /** One-paragraph retrospective shown beside the grid. */
  blurb: string;
  photos: GalleryPhoto[];
}

export const GALLERY_SEASONS: GallerySeason[] = [
  {
    year: "2023",
    theme: "Season 03",
    blurb:
      "The season that filled the hall. Eight frames of a packed auditorium, an exhibition floor that never emptied, and the tea breaks where the real conversations happened.",
    photos: [
      {src: "/gallery/2023/2023-event-experience.jpg", category: "Event experience"},
      {src: "/gallery/2023/2023-event-experience-1.jpg", category: "Event experience"},
      {src: "/gallery/2023/2023-exhibition.jpg", category: "Exhibition"},
      {src: "/gallery/2023/2023-exhibition-1.jpg", category: "Exhibition"},
      {src: "/gallery/2023/2023-hall-1.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-2.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-3.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-4.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-5.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-6.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-7.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-hall-8.jpg", category: "Main hall"},
      {src: "/gallery/2023/2023-teabreak-1.jpg", category: "Tea break"},
      {src: "/gallery/2023/2023-teabreak.jpg", category: "Tea break"},
    ],
  },
  {
    year: "2024",
    theme: "Season 04",
    blurb:
      "A tighter, sharper edition. Fewer frames, more focus — the stage, the exhibition, and an audience that leaned in for every talk.",
    photos: [
      {src: "/gallery/2024/2024-event-experience-1.jpg", category: "Event experience"},
      {src: "/gallery/2024/2024-event-experience-2.jpg", category: "Event experience"},
      {src: "/gallery/2024/2024-event-experience-3.jpg", category: "Event experience"},
      {src: "/gallery/2024/2024-exhibition.jpg", category: "Exhibition"},
      {src: "/gallery/2024/2024-hall-0.jpg", category: "Main hall"},
      {src: "/gallery/2024/2024-hall-1.jpg", category: "Main hall"},
      {src: "/gallery/2024/2024-hall-2.jpg", category: "Main hall"},
      {src: "/gallery/2024/2024-hall.jpg", category: "Main hall"},
      {src: "/gallery/2024/2024-teabreak.jpg", category: "Tea break"},
    ],
  },
  {
    year: "2025",
    theme: "Season 05",
    blurb:
      "The biggest season yet, and the first with hands-on workshops — ceramics and scented candles alongside the talks, the exhibition and the hall.",
    photos: [
      {src: "/gallery/2025/2025-event-experience-1.jpg", category: "Event experience"},
      {src: "/gallery/2025/2025-event-experience.jpg", category: "Event experience"},
      {src: "/gallery/2025/2025-exhibition-1.jpg", category: "Exhibition"},
      {src: "/gallery/2025/2025-exhibition.jpg", category: "Exhibition"},
      {src: "/gallery/2025/2025-hall-1.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-2.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-3.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-4.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-5.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-6.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-hall-7.jpg", category: "Main hall"},
      {src: "/gallery/2025/2025-teabreak-1.jpg", category: "Tea break"},
      {src: "/gallery/2025/2025-teabreak.jpg", category: "Tea break"},
      {src: "/gallery/2025/2025-workshop-scented-candle-making-1.jpg", category: "Workshop"},
      {src: "/gallery/2025/2025-workshop-ceramic-making.jpg", category: "Workshop"},
      {src: "/gallery/2025/2025-workshop-scented-candle-making-2.jpg", category: "Workshop"},
      {src: "/gallery/2025/2025-workshop-scented-candle-making.jpg", category: "Workshop"},
    ],
  },
];

/** Newest season first, which is what the page opens on. */
export const SEASONS_NEWEST_FIRST = [...GALLERY_SEASONS].reverse();

export function getSeason(year: string): GallerySeason | undefined {
  return GALLERY_SEASONS.find((s) => s.year === year);
}

/** Alt text worth reading aloud, rather than a filename. */
export function photoAlt(photo: GalleryPhoto, year: string): string {
  return `${photo.category} at TEDxFPTUniversityHCMC ${year}`;
}
