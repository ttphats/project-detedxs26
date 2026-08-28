/**
 * Gallery seasons.
 *
 * Photos live in `public/gallery/<year>/`. Their filenames were normalised on
 * import — the originals contained spaces and parentheses, which have to be
 * percent-encoded in a URL and are a common source of images that load on
 * Windows and 404 on the Linux server.
 *
 * Each season carries its own copy: the year buttons switch the whole story,
 * not just the pictures, so a visitor landing on 2023 reads about 2023.
 *
 * The wording is the organisers' own, kept verbatim rather than paraphrased —
 * these are the published themes for each edition.
 */

export interface GalleryPhoto {
  src: string;
  /** Derived from the filename — drives the filter chips and the alt text. */
  category: string;
}

export interface GallerySeason {
  year: string;
  /** Edition number and its theme, shown under the year. */
  theme: string;
  /** The theme's one-line hook, set larger than the description. */
  tagline: string;
  /** The published description of what the theme asks of you. */
  blurb: string;
  photos: GalleryPhoto[];
}

export const GALLERY_SEASONS: GallerySeason[] = [
  {
    year: "2023",
    theme: "Season 03 · With or Without?",
    tagline: "Finding balance between what to keep and what to let go.",
    blurb:
      "Inspired by the Japanese concept of “Ma”, the idea of space and pause, Season 3 explores the “with” and “without” in our lives. The theme encourages us to pause, reflect, and make conscious choices: what should we hold on to, what should we let go of, and how can we find the answer that is right for ourselves?",
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
    theme: "Season 04 · Start Small",
    tagline: "Big Things Start Small.",
    blurb:
      "Season 4 encourages us to begin with the smallest things, reminding us that big goals do not necessarily require a big first step. Sometimes, a small action is all it takes to set meaningful change in motion and gradually create something bigger over time.",
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
    theme: "Season 05 · All The Way",
    tagline: "Go All The Way, Come What May.",
    blurb:
      "After taking the first step with “Start Small”, Season 5 asks a bigger question: “Do we dare to go all the way?” All The Way is about the perseverance, courage, and determination to keep moving forward, even when the results are yet to be seen and the journey is filled with doubts, challenges, or moments of solitude. You do not have to be fast or perfect, what matters is that you do not give up.",
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
