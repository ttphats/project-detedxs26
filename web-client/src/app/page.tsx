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
  Clock,
} from "lucide-react";
import { Button, NeonBackground, SponsorCategories } from "@/components";
import { mergeSponsors } from "@/lib/sponsors";
import { events as mockEvents, Speaker, TimelineItem as OriginalTimelineItem } from "@/lib/mock-data";
import { formatVNDate, generateGoogleCalendarUrl } from "@/lib/date-utils";

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

// Partner logo for the spotlight slideshow: the uploaded image, or the name
// as a wordmark until one is attached. Fills its box; the box sets the size.
const getPartnerLogo = (id: string, _tier: string, logoUrl?: string | null, name?: string) => {
  if (logoUrl) {
    return <img src={logoUrl} alt={name || id} className="w-full h-full object-contain" />;
  }
  return <span className="text-white/80 font-black text-lg uppercase tracking-tight text-center">{name || id}</span>;
};

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
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  // Fetch featured event from API
  useEffect(() => {
    const fetchFeaturedEvent = async () => {
      try {
        const res = await fetch("/api/events?featured=true", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
          // API returned empty (all hidden by admin) - show nothing
          setTimeline([]);
        }
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
        // On error, show nothing rather than mock data
        setTimeline([]);
      }
    };
    fetchTimeline();
  }, [featuredEvent?.id, featuredEvent?.timeline]);

  // Fetch partners/sponsors from API
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const res = await fetch("/api/partners");
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Only show partners explicitly enabled for spotlight — no fallback
  const slidePartners = partners.filter((p) => p.show_in_marquee === true);

  return (
    // overflow-x-clip, not overflow-hidden: `hidden` turns this into a scroll
    // container, which captures every position:sticky descendant (the neon
    // band's pinned layer) and stops it following the viewport. `clip` still
    // hides horizontal overflow from the marquee and blobs without doing that.
    <div className="bg-black overflow-x-clip">
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
                  {featuredEvent.name ? (featuredEvent.name.includes(':') ? featuredEvent.name.split(':')[0].split(' ').pop() : '2026') : '2026'}:
                </h2>
              </div>

              {/* Finding Flow - Large Italic */}
              <div className="mb-6 sm:mb-8 animate-fade-in-up delay-100">
                {featuredEvent.tagline ? (
                  featuredEvent.tagline.split(' ').map((word, idx) => (
                    <h1 key={idx} className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-600 leading-[0.9] tracking-tight italic animate-glow-text uppercase">
                      {word}
                    </h1>
                  ))
                ) : (
                  <>
                    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-600 leading-[0.9] tracking-tight italic animate-glow-text">
                      FINDING
                    </h1>
                    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-red-600 leading-[0.9] tracking-tight italic animate-glow-text">
                      FLOW
                    </h1>
                  </>
                )}
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
                <a
                  href={generateGoogleCalendarUrl(featuredEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 group cursor-pointer w-fit"
                >
                  <Calendar className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                  <span className="text-red-500 font-medium text-sm sm:text-base underline underline-offset-4 decoration-red-500/50 group-hover:text-red-400 transition-colors">
                    {formatVNDate(featuredEvent.date, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </a>
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
                  href={`/events/${featuredEvent.id}/tickets`}
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
                      <p className="text-3xl font-black text-red-500">100+</p>
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

      {/* Speakers through Partners share one background: the gallery page's
          neon treatment — NeonBackground plus the .blob / .grid-pattern /
          .animate-float layers from globals.css. The gallery pins its layer
          with position:fixed; here it is sticky inside an absolute wrapper,
          so it stays pinned to the viewport only while this band is on
          screen and never bleeds into the hero or the footer. */}
      <div className="relative bg-black">
        {/* No overflow-hidden on this wrapper: sticky sticks to its nearest
            overflow≠visible ancestor, and this wrapper never scrolls, so
            clipping here would park the layer at the top of the band. The
            h-screen child does its own clipping. */}
        <div aria-hidden className="absolute inset-0 pointer-events-none z-0">
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            <NeonBackground />

            <div className="blob blob-red w-150 h-150 -top-40 -right-40 animate-morph" />
            <div
              className="blob blob-orange w-100 h-100 bottom-20 left-20 animate-morph"
              style={{animationDelay: "2s"}}
            />
            <div className="absolute inset-0 grid-pattern opacity-50" />

            {/* Drifting motes, as on the hero. */}
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full animate-float opacity-60" />
            <div
              className="absolute top-1/3 right-1/3 w-1 h-1 bg-red-400 rounded-full animate-float"
              style={{animationDelay: "1s"}}
            />
            <div
              className="absolute bottom-1/4 left-1/3 w-3 h-3 bg-red-600/50 rounded-full animate-float"
              style={{animationDelay: "2s"}}
            />
            <div
              className="absolute top-2/3 right-1/4 w-2 h-2 bg-orange-500/40 rounded-full animate-float"
              style={{animationDelay: "3s"}}
            />
          </div>
        </div>

      {/* Speaker Lineup Section - TEDx Hanoi Style */}
      <section id="speakers" className="relative z-10 overflow-hidden">
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

        {/* Speaker Grid — on desktop, a first row of five and a second row of
            six, every poster the same size. The desktop grid has 60 columns
            and each poster spans 10, so six fill a row exactly; the first
            poster starts at column 6, which pushes row one in by half a
            poster at each end and centres its five. The sixth poster no
            longer fits on row one and wraps. A full second row of six then
            fills edge to edge; a short second row is given the same column-6
            start as row one, so its posters sit directly under row one's
            rather than snapping to the left edge. Below lg the spans do not
            apply and it flows as a normal 4 / 3 / 2-across grid. */}
        {/* Wider than the page's usual max-w-7xl: six posters have to share a
            row, and at 1280px they came out under 190px each. */}
        <div className="max-w-[1720px] mx-auto px-4 sm:px-5 lg:px-6 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(60,minmax(0,1fr))] gap-3">
            {speakers.map((speaker, index) => {
              const secondRowIsShort = speakers.length > 5 && speakers.length < 11;
              const startsUnderRowOne =
                index === 0 || (index === 5 && secondRowIsShort);
              return (
              <div
                key={speaker.id}
                className={`group relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 hover:border-red-500 shadow-2xl hover:shadow-[0_0_50px_rgba(255,0,0,0.9)] transition-all duration-500 flex items-center justify-center hover:scale-[1.03] hover:-translate-y-2 z-10 hover:z-20 lg:col-span-10 ${
                  startsUnderRowOne ? "lg:col-start-6" : ""
                }`}
              >
                {/* Speaker Image */}
                <img
                  src={speaker.image}
                  alt={speaker.name}
                  className="relative z-10 w-full h-auto block object-cover transition-transform duration-500"
                />
                
                {/* Brighter glowing shine overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-red-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20 mix-blend-overlay" />
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Program/Timeline Section - Only show when there are published timeline items */}
      {timeline.length > 0 && <section
        id="program"
        className="py-12 sm:py-24 relative z-10 overflow-hidden"
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
      </section>}

      {/* Partner Spotlight Slideshow */}
      <PartnerSlideshow partners={slidePartners} />

      {/* Partners/Sponsors Section — white logo tiles on the shared neon
          band, so every mark sits on the light background it was drawn for. */}
      <section
        id="partners"
        className="py-16 sm:py-28 relative z-10 overflow-hidden border-t border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
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

          {/* Every confirmed sponsor, grouped by category. Database entries
              override the baseline list by name, so attaching a logo in the
              admin is enough to replace a wordmark. */}
          <SponsorCategories sponsors={mergeSponsors(partners)} />
        </div>
      </section>
      </div>

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
            100+ attendees for a day of ideas worth spreading.
          </p>
          <Link href={`/events/${featuredEvent.id}/tickets`}>
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
            {/* You can replace /trailer.mp4 with your actual video file in the public folder */}
            <video
              className="w-full h-full rounded-xl shadow-2xl shadow-red-500/20 bg-black"
              src="/trailer.mp4"
              controls
              autoPlay
              playsInline
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
}
