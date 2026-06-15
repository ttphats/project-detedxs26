"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Users,
  Sparkles,
  Play,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components";
import { events as mockEvents, Speaker, TimelineItem as OriginalTimelineItem } from "@/lib/mock-data";
import { formatVNDate } from "@/lib/date-utils";

interface TimelineItem extends OriginalTimelineItem {
  status?: string;
}

interface FeaturedEvent {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  bannerImageUrl: string | null;
  thumbnailUrl: string | null;
  speakerCount: number;
  background: {
    type: string;
    value: string;
    overlay: string;
  };
  highlights: { icon: string; text: string }[];
  timeline: TimelineItem[];
}

// Helper function to get timeline type styles
const getTimelineTypeStyle = (type: string) => {
  const lowerType = type.toLowerCase();
  const styles: Record<string, { mobile: string; desktop: string }> = {
    talk: {
      mobile: "bg-red-500/20 text-red-400 border border-red-500/30",
      desktop: "bg-red-600/20 text-red-500",
    },
    break: {
      mobile: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
      desktop: "bg-yellow-600/20 text-yellow-500",
    },
    checkin: {
      mobile: "bg-green-500/20 text-green-400 border border-green-500/30",
      desktop: "bg-green-600/20 text-green-500",
    },
    networking: {
      mobile: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      desktop: "bg-blue-600/20 text-blue-500",
    },
    performance: {
      mobile: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
      desktop: "bg-purple-600/20 text-purple-500",
    },
  };
  return (
    styles[lowerType] || {
      mobile: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
      desktop: "bg-gray-600/20 text-gray-500",
    }
  );
};

// Helper function to render vector SVG logos for partners
const getPartnerLogo = (id: string, tier: 'diamond' | 'gold' | 'silver', logoUrl?: string | null, name?: string) => {
  const sizeClass =
    tier === 'diamond' ? 'h-14 sm:h-16 max-w-full object-contain' :
      tier === 'gold' ? 'h-10 sm:h-12 max-w-full object-contain' :
        'h-7 sm:h-8 max-w-full object-contain';

  if (logoUrl) {
    return <img src={logoUrl} alt={name || id} className={sizeClass} style={{ objectFit: 'contain' }} />;
  }

  switch (id) {
    case 'p-fpt':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 160 50" xmlns="http://www.w3.org/2000/svg">
          {/* FPT styled swooshes */}
          <path className="fill-orange-500" d="M12 8c0-3.3 2.7-6 6-6h24v12H18c-3.3 0-6-2.7-6-6z" />
          <path className="fill-green-600" d="M18 20c0-3.3 2.7-6 6-6h24v12H24c-3.3 0-6-2.7-6-6z" />
          <path className="fill-blue-500" d="M24 32c0-3.3 2.7-6 6-6h24v12H30c-3.3 0-6-2.7-6-6z" />
          <text x="65" y="35" className="font-black text-3xl tracking-tighter fill-white">FPT</text>
        </svg>
      );
    case 'p-vinfast':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
          {/* VinFast V logo */}
          <path className="fill-white" d="M20 10 L52 38 L60 45 L68 38 L100 10 L88 10 L60 34 L32 10 Z" />
          <path className="fill-red-600" d="M38 10 L54 24 L60 29 L66 24 L82 10 L74 10 L60 21 L46 10 Z" />
        </svg>
      );
    case 'p-techcom':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 160 50" xmlns="http://www.w3.org/2000/svg">
          {/* Techcombank logo */}
          <rect x="5" y="10" width="30" height="30" className="fill-red-600" />
          <rect x="13" y="18" width="14" height="14" className="fill-white" />
          <text x="44" y="32" className="font-black text-xl fill-white tracking-tighter">Techcombank</text>
        </svg>
      );
    case 'p-vng':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
          {/* VNG logo */}
          <text x="10" y="35" className="font-black text-3xl fill-cyan-400 tracking-wider">VNG</text>
          <circle cx="85" cy="25" r="12" className="stroke-cyan-400 stroke-2 fill-none" />
          <circle cx="85" cy="25" r="7" className="fill-cyan-400" />
        </svg>
      );
    case 'p-shopee':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 140 50" xmlns="http://www.w3.org/2000/svg">
          {/* Shopee logo */}
          <path className="fill-orange-500" d="M15 15v25h26V15H15zm13-10c-3.5 0-6.5 3-6.5 6.5H34c0-3.5-3-6.5-6.5-6.5z" />
          <text x="25" y="34" className="font-black text-white text-base">S</text>
          <text x="49" y="33" className="font-black text-2xl fill-orange-500">Shopee</text>
        </svg>
      );
    case 'p-intel':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
          {/* Intel logo */}
          <ellipse cx="60" cy="25" rx="55" ry="22" className="stroke-blue-500 stroke-2 fill-none" />
          <text x="32" y="33" className="font-black text-3xl fill-white italic tracking-tighter">intel</text>
        </svg>
      );
    case 'p-asus':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg">
          {/* ASUS logo */}
          <text x="15" y="34" className="font-black text-3xl fill-white italic tracking-widest">ASUS</text>
        </svg>
      );
    case 'p-highlands':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 160 50" xmlns="http://www.w3.org/2000/svg">
          {/* Highlands logo */}
          <circle cx="25" cy="25" r="20" className="fill-red-800" />
          <circle cx="25" cy="25" r="16" className="stroke-amber-600 stroke-2 fill-none" />
          <text x="54" y="32" className="font-black text-lg fill-amber-600 tracking-wider">HIGHLANDS</text>
        </svg>
      );
    case 'p-pepsi':
      return (
        <svg className={`${sizeClass}`} viewBox="0 0 140 50" xmlns="http://www.w3.org/2000/svg">
          {/* Pepsi logo */}
          <circle cx="25" cy="25" r="20" className="fill-blue-600" />
          <path d="M5 25 A20 20 0 0 1 45 25 C30 30 20 20 5 25 Z" className="fill-white" />
          <path d="M5 25 A20 20 0 0 1 25 5 C30 13 20 18 5 25 Z" className="fill-red-600" />
          <text x="54" y="34" className="font-black text-2xl fill-white tracking-widest uppercase">pepsi</text>
        </svg>
      );
    default:
      return <span className="text-white/60 font-black text-lg">{id}</span>;
  }
};

const fallbackPartners = [
  { id: 'p-fpt', name: 'FPT', tier: 'diamond' as const, logo_url: null, banner_url: null, website: 'https://fpt.com.vn' },
  { id: 'p-vinfast', name: 'VinFast', tier: 'diamond' as const, logo_url: null, banner_url: null, website: 'https://vinfastauto.com' },
  { id: 'p-techcom', name: 'Techcombank', tier: 'diamond' as const, logo_url: null, banner_url: null, website: 'https://techcombank.com' },
  { id: 'p-vng', name: 'VNG', tier: 'gold' as const, logo_url: null, banner_url: null, website: 'https://vng.com.vn' },
  { id: 'p-shopee', name: 'Shopee', tier: 'gold' as const, logo_url: null, banner_url: null, website: 'https://shopee.vn' },
  { id: 'p-intel', name: 'Intel', tier: 'gold' as const, logo_url: null, banner_url: null, website: 'https://intel.vn' },
  { id: 'p-asus', name: 'ASUS', tier: 'silver' as const, logo_url: null, banner_url: null, website: 'https://asus.com' },
  { id: 'p-highlands', name: 'Highlands Coffee', tier: 'silver' as const, logo_url: null, banner_url: null, website: 'https://highlandscoffee.com.vn' },
  { id: 'p-pepsi', name: 'Pepsi', tier: 'silver' as const, logo_url: null, banner_url: null, website: 'https://pepsi.com' },
];

// ====================================================================
// PartnerSlideshow — full-width spotlight, one partner at a time
// ====================================================================
function PartnerSlideshow({ partners }: { partners: any[] }) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const DURATION = 5000; // ms per slide

  const goTo = (index: number) => {
    setAnimating(true);
    setProgress(0);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 400);
  };

  const prev = () => goTo((current - 1 + partners.length) % partners.length);
  const next = () => goTo((current + 1) % partners.length);

  // Reset current index when partners list changes (prevents out-of-bounds crash)
  useEffect(() => {
    setCurrent((prev) => (prev >= partners.length ? 0 : prev));
  }, [partners.length]);

  // Auto-advance every DURATION ms with a real-time progress bar
  useEffect(() => {
    if (partners.length <= 1) return;
    const start = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(tick);
      } else {
        setCurrent((prev) => (prev + 1) % partners.length);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [current, partners.length]);


  if (!partners.length) return null;
  const partner = partners[current];

  return (
    <section className="py-10 sm:py-16 bg-black relative overflow-hidden border-t border-b border-white/5">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-48 bg-red-600/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section label */}
        <p className="text-center text-red-600 font-bold uppercase tracking-widest text-xs sm:text-sm mb-6">
          Our Partners & Sponsors
        </p>

        {/* Main slide frame */}
        <div className="relative">
          {/* Card */}
          <div
            className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_60px_rgba(230,43,30,0.08)] h-48 sm:h-64 md:h-80"
          >
            {/* Progress bar — top edge */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5 z-20">
              <div
                className="h-full bg-red-500 transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Slide content — image fills the full card */}
            <div
              className="transition-opacity duration-400"
              style={{ opacity: animating ? 0 : 1 }}
            >
              {partner.banner_url ? (
                <img
                  src={partner.banner_url}
                  alt={partner.name}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : partner.logo_url ? (
                <img
                  src={partner.logo_url}
                  alt={partner.name}
                  className="w-full h-full object-cover absolute inset-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {getPartnerLogo(partner.id, partner.tier, partner.logo_url, partner.name)}
                </div>
              )}
            </div>

            {/* Corner accent lines */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-red-500/30 rounded-tl-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-red-500/30 rounded-br-2xl pointer-events-none" />

            {/* Slide index badge */}
            <div className="absolute top-4 right-5 text-xs text-gray-600 font-mono">
              {String(current + 1).padStart(2, '0')} / {String(partners.length).padStart(2, '0')}
            </div>
          </div>

          {/* Prev / Next Arrows */}
          {partners.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous partner"
                className="absolute -left-4 sm:-left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center text-white hover:border-red-500 hover:text-red-500 transition-all shadow-lg mobile-tap-feedback"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next partner"
                className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center text-white hover:border-red-500 hover:text-red-500 transition-all shadow-lg mobile-tap-feedback"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Dot Indicators */}
        {partners.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {partners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to partner ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 h-2 bg-red-500'
                    : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [featuredEvent, setFeaturedEvent] = useState<FeaturedEvent | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  // Fetch featured event from API
  useEffect(() => {
    const fetchFeaturedEvent = async () => {
      try {
        const res = await fetch("/api/events?featured=true");
        const data = await res.json();
        if (data.success && data.data) {
          // Merge with mock timeline since API doesn't have it yet
          const mock = mockEvents[0];
          setFeaturedEvent({
            ...data.data,
            timeline: data.data.timeline || mock.timeline,
          });
        } else {
          // Fallback to mock data
          const mock = mockEvents[0];
          setFeaturedEvent({
            id: mock.id,
            name: mock.name,
            slug: mock.id,
            tagline: mock.tagline,
            description: mock.description,
            date: mock.date,
            time: mock.time,
            venue: mock.venue,
            location: mock.location,
            bannerImageUrl: mock.background.value,
            thumbnailUrl:
              "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
            speakerCount: mock.speakers.length,
            background: mock.background,
            highlights: mock.highlights,
            timeline: mock.timeline,
          });
          setSpeakers(mock.speakers);
        }
      } catch (error) {
        console.error("Failed to fetch featured event:", error);
        // Fallback to mock data
        const mock = mockEvents[0];
        setFeaturedEvent({
          id: mock.id,
          name: mock.name,
          slug: mock.id,
          tagline: mock.tagline,
          description: mock.description,
          date: mock.date,
          time: mock.time,
          venue: mock.venue,
          location: mock.location,
          bannerImageUrl: mock.background.value,
          thumbnailUrl:
            "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
          speakerCount: mock.speakers.length,
          background: mock.background,
          highlights: mock.highlights,
          timeline: mock.timeline,
        });
        setSpeakers(mock.speakers);
      } finally {
        setLoading(false);
      }
    };
    fetchFeaturedEvent();
  }, []);

  // Fetch speakers when featuredEvent is loaded
  useEffect(() => {
    if (!featuredEvent) return;

    const fetchSpeakers = async () => {
      try {
        const res = await fetch(`/api/events/${featuredEvent.id}/speakers`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setSpeakers(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch speakers:", error);
      }
    };
    fetchSpeakers();
  }, [featuredEvent?.id]);

  // Fetch timeline when featuredEvent is loaded
  useEffect(() => {
    if (!featuredEvent) return;

    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/events/${featuredEvent.id}/timeline`);
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          // Transform API format - use type directly from database (lowercase)
          const transformed: TimelineItem[] = data.data.map((item: any) => ({
            id: item.id,
            time: item.time,
            title: item.title,
            description: item.description || "",
            type: item.type.toLowerCase(),
            speakerId: item.speaker ? item.id : undefined,
            status: item.status,
          }));
          setTimeline(transformed);
        } else {
          // Fallback to mock timeline
          setTimeline(featuredEvent.timeline);
        }
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
        // Fallback to mock timeline
        setTimeline(featuredEvent.timeline);
      }
    };
    fetchTimeline();
  }, [featuredEvent?.id, featuredEvent?.timeline]);

  // Fetch partners/sponsors from API
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const res = await fetch("/api/partners");
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          setPartners(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch partners:", error);
      }
    };
    fetchPartners();
  }, []);


  // Loading state
  if (loading || !featuredEvent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Only show partners explicitly enabled for spotlight — no fallback
  const slidePartners = partners.filter((p) => p.show_in_marquee === true);

  return (
    <div className="bg-black overflow-hidden">
      {/* Hero Section - Creative with animations */}
      <section className="relative min-h-auto sm:min-h-screen overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Main background image */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url(${featuredEvent.background.value})`,
            }}
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-linear-to-br from-black via-black/90 to-red-950/30" />
          <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent" />

          {/* Animated blobs */}
          <div className="blob blob-red w-150 h-150 -top-40 -right-40 animate-morph" />
          <div
            className="blob blob-orange w-100 h-100 bottom-20 left-20 animate-morph"
            style={{ animationDelay: "-4s" }}
          />

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 grid-pattern opacity-50" />

          {/* Floating particles */}
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-float opacity-60" />
          <div
            className="absolute top-1/3 right-1/3 w-1 h-1 bg-red-400 rounded-full animate-float"
            style={{ animationDelay: "-2s" }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-red-600/50 rounded-full animate-float"
            style={{ animationDelay: "-4s" }}
          />
          <div
            className="absolute top-2/3 right-1/4 w-2 h-2 bg-orange-500/40 rounded-full animate-float"
            style={{ animationDelay: "-1s" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-8 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
            {/* Left Content - Takes 6 columns */}
            <div className="relative z-20 lg:col-span-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 glass-red rounded-full mb-4 sm:mb-6 animate-fade-in-up">
                <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs sm:text-sm font-medium uppercase tracking-wider">
                  x = independently organized event
                </span>
              </div>

              {/* Main Title - Stacked Layout */}
              <div className="mb-4 sm:mb-6 animate-fade-in-up">
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[0.95] tracking-tight uppercase">
                  TED
                  <span className="text-red-600 text-2xl sm:text-4xl md:text-5xl lg:text-6xl align-baseline">
                    x
                  </span>
                </h1>
                <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-[1] tracking-tight uppercase mt-1">
                  FPTUNIVERSITYHCMC
                </h2>
                <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-[1] tracking-tight uppercase mt-1">
                  2026:
                </h2>
              </div>

              {/* Finding Flow - Large Italic */}
              <div className="mb-6 sm:mb-8 animate-fade-in-up delay-100">
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-600 leading-[0.9] tracking-tight italic animate-glow-text">
                  FINDING
                </h1>
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-600 leading-[0.9] tracking-tight italic animate-glow-text">
                  FLOW
                </h1>
              </div>

              <p className="text-gray-400 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-md animate-fade-in-up delay-300 leading-relaxed">
                Join us for a day of{" "}
                <span className="text-white font-semibold">
                  transformative ideas
                </span>{" "}
                and
                <span className="text-red-500 font-semibold">
                  {" "}
                  groundbreaking talks
                </span>{" "}
                about achieving flow states in work, creativity, and life.
              </p>

              {/* Event Info - Underlined style like the image */}
              <div className="flex flex-col gap-2 sm:gap-3 mb-6 sm:mb-8 animate-fade-in-up delay-400">
                <div className="flex items-center gap-2 group cursor-default">
                  <Calendar className="w-4 h-4 text-red-500" />
                  <span className="text-red-500 font-medium text-sm sm:text-base underline underline-offset-4 decoration-red-500/50">
                    {formatVNDate(featuredEvent.date, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(featuredEvent.venue + ", " + featuredEvent.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 group cursor-pointer w-fit"
                >
                  <MapPin className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                  <span className="text-red-500 font-medium text-sm sm:text-base underline underline-offset-4 decoration-red-500/50 group-hover:text-red-400 transition-colors">
                    {featuredEvent.venue}
                  </span>
                </a>

              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 animate-fade-in-up delay-500">
                <Link
                  href={`/events/${featuredEvent.id}/seats`}
                  className="w-full sm:w-auto"
                >
                  <button className="w-full sm:w-auto group relative px-6 sm:px-8 py-3 sm:py-4 bg-red-600 text-white font-bold uppercase tracking-wider rounded-full overflow-hidden transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/30 btn-ripple mobile-tap-feedback">
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Buy Ticket
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </Link>
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="w-full sm:w-auto group px-6 sm:px-8 py-3 sm:py-4 border-2 border-white/30 text-white font-bold uppercase tracking-wider rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 mobile-tap-feedback"
                >
                  <Play className="w-5 h-5" />
                  Watch Trailer
                </button>
                <Link
                  href="/speakers/register"
                  className="w-full sm:w-auto"
                >
                  <button className="w-full sm:w-auto group px-6 sm:px-8 py-3 sm:py-4 bg-zinc-950 border border-white/20 text-white font-bold uppercase tracking-wider rounded-full hover:border-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 mobile-tap-feedback">
                    Become a Speaker
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Content - Takes 6 columns */}
            <div className="hidden lg:block lg:col-span-6 animate-fade-in-right relative z-10">
              <div className="relative overflow-visible">
                {/* Decorative rotating rings */}
                <div className="absolute -inset-8 pointer-events-none">
                  <div className="absolute inset-0 border-2 border-red-500/20 rounded-full animate-spin-slow" />
                  <div
                    className="absolute inset-4 border border-white/10 rounded-full animate-spin-slow"
                    style={{
                      animationDirection: "reverse",
                      animationDuration: "25s",
                    }}
                  />
                  <div
                    className="absolute inset-8 border border-red-500/10 rounded-full animate-spin-slow"
                    style={{ animationDuration: "30s" }}
                  />
                </div>

                {/* Floating decorative elements */}
                <div className="absolute -top-6 -left-6 w-12 h-12 border-2 border-red-500/30 rounded-full animate-float" />
                <div className="absolute -bottom-4 -left-8 w-8 h-8 bg-red-600/20 rounded-full blur-sm animate-pulse" />
                <div
                  className="absolute top-1/2 -right-6 w-4 h-4 bg-red-500 rounded-full animate-float shadow-lg shadow-red-500/50"
                  style={{ animationDelay: "-2s" }}
                />

                {/* Main image with effects */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-red-500/30 group">
                  <img
                    src={
                      featuredEvent.thumbnailUrl ||
                      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop"
                    }
                    alt="TEDx Stage"
                    className="w-full h-auto transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent" />

                  {/* Animated scan line effect */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/5 to-transparent h-[200%] animate-scan" />
                  </div>

                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-16 h-16 border-l-2 border-t-2 border-red-500/50 rounded-tl-2xl" />
                  <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-red-500/50 rounded-br-2xl" />

                  {/* Floating stats */}
                  <div className="absolute bottom-6 left-6 right-6 flex gap-4">
                    <div className="flex-1 glass-dark rounded-xl p-4 animate-fade-in-up delay-600 hover:bg-white/10 transition-colors">
                      <p className="text-3xl font-black text-white">
                        {featuredEvent.speakerCount || speakers.length}+
                      </p>
                      <p className="text-gray-400 text-sm uppercase tracking-wide">
                        Speakers
                      </p>
                    </div>
                    <div className="flex-1 glass-dark rounded-xl p-4 animate-fade-in-up delay-700 hover:bg-white/10 transition-colors">
                      <p className="text-3xl font-black text-red-500">500+</p>
                      <p className="text-gray-400 text-sm uppercase tracking-wide">
                        Attendees
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floating badge with pulse effect */}
                <div className="absolute -top-4 -right-4 z-20">
                  <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-20" />
                  <div className="relative px-6 py-3 bg-red-600 rounded-full shadow-lg shadow-red-500/50 animate-float">
                    <span className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      Live Event
                    </span>
                  </div>
                </div>

                {/* Decorative glow behind image */}
                <div
                  className="absolute -inset-4 bg-red-600/20 rounded-3xl blur-3xl -z-10 animate-pulse"
                  style={{ animationDuration: "3s" }}
                />
                <div className="absolute -inset-8 bg-red-600/10 rounded-full blur-3xl -z-20" />
              </div>
            </div>
          </div>

          {/* Scroll indicator - Hidden on mobile */}
          <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 animate-fade-in delay-800">
            <span className="text-gray-500 text-sm uppercase tracking-widest">
              Scroll
            </span>
            <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center pt-2">
              <div className="w-1 h-3 bg-red-500 rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <section className="py-6 bg-red-600 overflow-hidden">
        <div className="marquee">
          <div className="marquee-content flex gap-12 items-center">
            {[...Array(10)].map((_, i) => (
              <span
                key={i}
                className="text-white/90 font-black text-xl uppercase tracking-widest whitespace-nowrap flex items-center gap-4"
              >
                IDEAS WORTH SPREADING <span className="text-white/50">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Speaker Lineup Section - TEDx Hanoi Style */}
      <section id="speakers" className="bg-black relative overflow-hidden">
        {/* Section Header */}
        <div className="py-20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between">
              <div className="animate-fade-in-up">
                <p className="text-red-600 font-bold uppercase tracking-widest mb-4">
                  Meet Our Visionaries
                </p>
                <h2 className="text-5xl md:text-7xl font-black text-white leading-none ted-logo-text">
                  SPEAKER
                  <br />
                  <span className="text-red-600">LINEUP</span>
                </h2>
              </div>
              <p className="text-gray-400 max-w-md mt-6 md:mt-0 animate-fade-in-up delay-200 text-lg">
                World-class thinkers, innovators, and change-makers ready to
                share ideas that will transform your perspective.
              </p>
            </div>
          </div>
        </div>

        {/* Speaker Grid - Space-saving Horizontal Layout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {speakers.map((speaker, index) => (
              <div
                key={speaker.id}
                className="group relative h-[450px] rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 hover:border-red-500/50 shadow-2xl transition-all duration-500"
              >
                {/* Glow effect on hover */}
                <div className="absolute -inset-0.5 bg-red-600/10 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Speaker Image */}
                <img
                  src={speaker.image}
                  alt={speaker.name}
                  className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                />

                {/* Image Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-85 group-hover:opacity-45 transition-opacity duration-500" />

                {/* Number badge */}
                <div className="absolute top-4 left-4 z-10 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-lg shadow-red-600/30">
                  {String(index + 1).padStart(2, "0")}
                </div>

                {/* Slide-up Content Panel */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-zinc-950/95 backdrop-blur-md border-t border-white/10 translate-y-[calc(100%-80px)] group-hover:translate-y-0 transition-transform duration-500 ease-out flex flex-col h-full justify-between">

                  {/* Header info (always visible at the bottom of the card) */}
                  <div>
                    <div className="flex flex-col gap-1 mb-4">
                      <p className="text-red-500 font-bold uppercase tracking-wider text-[11px]">
                        {speaker.topic}
                      </p>
                      <h3 className="text-white text-lg sm:text-xl font-black uppercase tracking-tight group-hover:text-red-500 transition-colors leading-tight">
                        {speaker.name}
                      </h3>
                    </div>

                    {/* Expanded info (visible when panel slides up) */}
                    <div className="space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 overflow-y-auto max-h-[250px] pr-1 scrollbar-thin">
                      <p className="text-white/90 text-xs font-semibold italic border-l-2 border-red-500 pl-2 leading-relaxed">
                        {speaker.bio}
                      </p>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        {speaker.title}
                      </p>
                    </div>
                  </div>

                  {/* Footer action / badge inside panel (visible when hovered) */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                      {speaker.company || "TEDx Speaker"}
                    </span>
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      Keynote Talk
                    </span>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program/Timeline Section - Vertical Timeline */}
      <section
        id="program"
        className="py-12 sm:py-24 bg-black relative overflow-hidden"
      >
        {/* Background decoration - removed for horizontal layout */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-20 animate-fade-in-up">
            <p className="text-red-600 font-bold uppercase tracking-widest mb-2 sm:mb-4 text-xs sm:text-base">
              The Journey
            </p>
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-white ted-logo-text">
              EVENT <span className="text-red-600">TIMELINE</span>
            </h2>
          </div>

          {/* Responsive Horizontal Wrapping Timeline */}
          <div className="relative z-10 w-full flex flex-row flex-wrap justify-center items-stretch gap-y-8 gap-x-6 sm:gap-x-8">
            {timeline.map((item, index) => {
              const isCompleted = item.status === "COMPLETED";
              return (
                <div
                  key={item.id}
                  className="relative w-full sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.5rem)] animate-fade-in-up group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Content Card */}
                  <div className={`h-full relative glass-panel p-6 rounded-2xl overflow-hidden border transition-all duration-300 ${isCompleted ? 'border-green-500/20 hover:border-green-500/40 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-red-500/10 hover:border-red-500/30'}`}>
                    {/* Glow effect on hover */}
                    <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isCompleted ? 'bg-green-600/10' : 'bg-red-600/10'}`} />

                    {/* Top glowing line to simulate timeline path */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-70 group-hover:opacity-100 transition-opacity ${isCompleted ? 'from-green-600/20 via-green-500 to-green-600/20' : 'from-red-600/20 via-red-500 to-red-600/20'}`} />

                    {/* Dot indicator */}
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full dot-glow timeline-dot ${isCompleted ? 'bg-green-500 shadow-[0_0_10px_2px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-600 shadow-[0_0_10px_2px_rgba(230,43,30,0.6)]'}`} />

                    <div className="relative z-10 flex flex-col h-full pt-2">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`font-black text-xl tracking-wider drop-shadow-md flex items-center gap-1.5 ${isCompleted ? 'text-green-400' : 'text-red-500'}`}>
                          {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                          {item.time}
                        </span>
                        <span
                          className={`inline-block px-3 py-1 text-[10px] sm:text-xs uppercase font-bold tracking-wider rounded-lg ${isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/30' : getTimelineTypeStyle(item.type).desktop}`}
                        >
                          {isCompleted ? 'Completed' : item.type}
                        </span>
                      </div>

                      <h4 className={`font-black text-lg sm:text-xl uppercase mb-3 ted-logo-text leading-tight transition-colors ${isCompleted ? 'text-green-300 group-hover:text-green-200' : 'text-white group-hover:text-red-100'}`}>
                        {item.title}
                      </h4>

                      <p className="text-gray-400 text-sm leading-relaxed flex-grow">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Arrow pointing to next item */}
                  <div className={`hidden sm:block absolute top-1/2 -right-5 -translate-y-1/2 z-20 transition-colors pointer-events-none ${isCompleted ? 'text-green-500/20 group-hover:text-green-500/60' : 'text-red-500/20 group-hover:text-red-500/60'}`}>
                    <ArrowRight className="w-6 h-6" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Partner Spotlight Slideshow */}
      <PartnerSlideshow partners={slidePartners} />

      {/* Partners/Sponsors Section */}
      <section
        id="partners"
        className="py-16 sm:py-28 bg-black relative overflow-hidden border-t border-white/5"
      >
        {/* Subtle background glow elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Section Header */}
          <div className="text-center mb-16 sm:mb-24 animate-fade-in-up">
            <p className="text-red-600 font-bold uppercase tracking-widest mb-3 text-xs sm:text-sm">
              Our Supporters
            </p>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white uppercase tracking-tight leading-none mb-6">
              PARTNERS & <span className="text-red-600">SPONSORS</span>
            </h2>
            <div className="w-20 h-1 bg-red-600 mx-auto rounded-full mb-6" />
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Accompanying TEDxFPTUniversityHCMC on the journey of spreading valuable ideas.
            </p>
          </div>

          <div className="flex flex-col gap-16 sm:gap-24">
            {/* Diamond Tier */}
            <div>
              <div className="flex items-center gap-4 justify-center mb-6">
                <div className="h-[1px] bg-cyan-500/20 flex-grow max-w-[120px] hidden sm:block" />
                <h3 className="text-center font-black text-cyan-400 text-base sm:text-lg uppercase tracking-widest flex items-center gap-2">
                  <span className="text-cyan-500">✦</span> Diamond Sponsors <span className="text-cyan-500">✦</span>
                </h3>
                <div className="h-[1px] bg-cyan-500/20 flex-grow max-w-[120px] hidden sm:block" />
              </div>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 max-w-4xl mx-auto">
                {partners
                  .filter((p) => p.tier === "diamond")
                  .map((partner) => (
                    <a
                      key={partner.id}
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative flex items-center justify-center p-3 sm:p-4 w-[140px] sm:w-[180px] md:w-[200px] h-24 sm:h-28 rounded-xl border border-cyan-500/20 bg-white/5 backdrop-blur-md partner-card partner-card-diamond shine-effect mobile-tap-feedback"
                    >
                      {/* Glow backing */}
                      <div className="absolute inset-0 rounded-xl bg-cyan-500/0 group-hover:bg-cyan-500/5 transition-colors duration-500 -z-10" />
                      {/* Logo container */}
                      <div className="filter grayscale contrast-125 opacity-55 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center w-full h-full">
                        {getPartnerLogo(partner.id, partner.tier, partner.logo_url, partner.name)}
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            {/* Gold Tier */}
            <div>
              <div className="flex items-center gap-4 justify-center mb-6">
                <div className="h-[1px] bg-amber-500/20 flex-grow max-w-[120px] hidden sm:block" />
                <h3 className="text-center font-black text-amber-400 text-base sm:text-lg uppercase tracking-widest flex items-center gap-2">
                  <span className="text-amber-500">✦</span> Gold Sponsors <span className="text-amber-500">✦</span>
                </h3>
                <div className="h-[1px] bg-amber-500/20 flex-grow max-w-[120px] hidden sm:block" />
              </div>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
                {partners
                  .filter((p) => p.tier === "gold")
                  .map((partner) => (
                    <a
                      key={partner.id}
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative flex items-center justify-center p-2 sm:p-3 w-[110px] sm:w-[140px] md:w-[160px] h-20 sm:h-24 rounded-xl border border-amber-500/10 bg-white/5 backdrop-blur-md partner-card partner-card-gold shine-effect mobile-tap-feedback"
                    >
                      <div className="absolute inset-0 rounded-xl bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors duration-500 -z-10" />
                      <div className="filter grayscale contrast-125 opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center w-full h-full">
                        {getPartnerLogo(partner.id, partner.tier, partner.logo_url, partner.name)}
                      </div>
                    </a>
                  ))}
              </div>
            </div>

            {/* Silver Tier */}
            <div>
              <div className="flex items-center gap-4 justify-center mb-6">
                <div className="h-[1px] bg-slate-400/20 flex-grow max-w-[120px] hidden sm:block" />
                <h3 className="text-center font-black text-slate-300 text-base sm:text-lg uppercase tracking-widest flex items-center gap-2">
                  <span className="text-slate-400">✦</span> Silver Sponsors <span className="text-slate-400">✦</span>
                </h3>
                <div className="h-[1px] bg-slate-400/20 flex-grow max-w-[120px] hidden sm:block" />
              </div>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-5xl mx-auto">
                {partners
                  .filter((p) => p.tier === "silver")
                  .map((partner) => (
                    <a
                      key={partner.id}
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative flex items-center justify-center p-1.5 sm:p-2 w-[80px] sm:w-[100px] md:w-[120px] lg:w-[130px] h-16 sm:h-20 rounded-lg border border-white/5 bg-white/5 backdrop-blur-md partner-card partner-card-silver shine-effect mobile-tap-feedback"
                    >
                      <div className="absolute inset-0 rounded-lg bg-white/0 group-hover:bg-white/5 transition-colors duration-500 -z-10" />
                      <div className="filter grayscale contrast-125 opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center w-full h-full">
                        {getPartnerLogo(partner.id, partner.tier, partner.logo_url, partner.name)}
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Attend TEDx Section */}

      <section className="py-12 sm:py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 sm:mb-12 animate-fade-in-up">
            <h2 className="text-2xl sm:text-4xl font-black text-black">
              WHY ATTEND TED<span className="text-red-600">x</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="animate-fade-in-up delay-100">
              <div className="mb-3 sm:mb-4">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h3 className="font-black text-black uppercase mb-2 sm:mb-3 text-sm sm:text-base">
                World-Class Ideas
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                Curated talks from visionaries across technology, entertainment,
                and design, condensed into powerful 18-minute stories.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="animate-fade-in-up delay-200">
              <div className="mb-3 sm:mb-4">
                <Users className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h3 className="font-black text-black uppercase mb-2 sm:mb-3 text-sm sm:text-base">
                Vibrant Community
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                Connect with Vietnam&apos;s most curious minds and passionate
                change-makers during our interactive networking sessions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="animate-fade-in-up delay-300">
              <div className="mb-3 sm:mb-4">
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
              <h3 className="font-black text-black uppercase mb-2 sm:mb-3 text-sm sm:text-base">
                Full Experience
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                Beyond the talks: live performances, hands-on workshops, and
                immersive exhibits throughout the venue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 bg-red-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-4 animate-fade-in-up">
            READY TO BE INSPIRED?
          </h2>
          <p className="text-xl text-white/80 mb-8 animate-fade-in-up delay-100">
            Join {featuredEvent.speakerCount || speakers.length}+ speakers and
            500+ attendees for a day of ideas worth spreading.
          </p>
          <Link href={`/events/${featuredEvent.id}/seats`}>
            <Button
              size="lg"
              className="bg-white text-black hover:bg-zinc-100 hover:text-black px-12 rounded-full font-bold uppercase tracking-wider shadow-2xl transition-all duration-300 hover:scale-105 animate-fade-in-up delay-200"
              style={{ backgroundColor: 'white', color: 'black' }}
            >
              GET YOUR TICKET NOW
            </Button>
          </Link>
        </div>
      </section>

      {/* YouTube Video Modal */}
      {isVideoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-red-500 transition-colors p-2 mobile-tap-feedback"
            >
              <X className="w-8 h-8" />
            </button>

            {/* YouTube iframe */}
            <iframe
              className="w-full h-full rounded-xl shadow-2xl shadow-red-500/20"
              src="https://www.youtube.com/embed/2XuXC3_pLGg?autoplay=1"
              title="TEDxFPTUniversityHCMC Intro"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
