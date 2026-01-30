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
} from "lucide-react";
import { Button } from "@/components";
import { events as mockEvents, Speaker, TimelineItem } from "@/lib/mock-data";

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

export default function Home() {
  const [featuredEvent, setFeaturedEvent] = useState<FeaturedEvent | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

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
            time: item.startTime,
            title: item.title,
            description: item.description || "",
            type: item.type.toLowerCase(),
            speakerId: item.speakerName ? item.id : undefined,
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
                    {new Date(featuredEvent.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 group cursor-default">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span className="text-red-500 font-medium text-sm sm:text-base underline underline-offset-4 decoration-red-500/50">
                    {featuredEvent.venue}
                  </span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-in-up delay-500">
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

        {/* Speaker Cards - Mobile: Card style, Desktop: Row style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4 px-4 py-8">
          {speakers.map((speaker, index) => (
            <div
              key={speaker.id}
              className="group relative rounded-2xl overflow-hidden bg-black border border-red-500/20 shadow-lg shadow-red-500/10 hover:shadow-red-500/20 transition-all duration-300"
            >
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 via-transparent to-red-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Speaker Image */}
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={speaker.image}
                  alt={speaker.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105"
                />
                {/* Dark overlay with gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-transparent" />

                {/* Red accent line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-600 via-red-500 to-transparent" />

                {/* Number badge */}
                <div className="absolute top-3 right-3 px-3 py-1 bg-red-600 rounded-full shadow-lg shadow-red-500/50">
                  <span className="text-white text-xs font-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Info overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white text-lg sm:text-xl font-black uppercase mb-1 drop-shadow-lg">
                    {speaker.name}
                  </h3>
                  <p className="text-red-500 font-bold uppercase tracking-wider text-[10px] sm:text-xs mb-2">
                    {speaker.topic}
                  </p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    {speaker.title}
                  </p>
                </div>
              </div>

              {/* Bottom accent */}
              <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
            </div>
          ))}
        </div>

        {/* Speaker Rows - Desktop only */}
        <div className="hidden lg:block">
          {speakers.map((speaker, index) => (
            <div
              key={speaker.id}
              className="speaker-row group relative min-h-[70vh] flex items-center border-t border-white/5 overflow-hidden"
            >
              {/* Kinetic Text Background */}
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="kinetic-text select-none transition-all duration-700">
                  {speaker.topic.toUpperCase()} • {speaker.topic.toUpperCase()}{" "}
                  •
                </div>
              </div>

              {/* Content Container */}
              <div
                className={`container mx-auto px-10 flex flex-row items-center justify-between relative z-20 ${index % 2 === 1 ? "flex-row-reverse" : ""}`}
              >
                {/* Info Card */}
                <div className="w-1/2">
                  <div className="info-card glass-panel p-8 max-w-md rounded-lg shadow-2xl">
                    <div className="text-red-600 font-bold text-sm mb-2">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-white text-4xl font-black uppercase mb-1 ted-logo-text">
                      {speaker.name}
                    </h3>
                    <p className="text-red-600 font-bold uppercase tracking-widest text-sm mb-4">
                      {speaker.topic}
                    </p>
                    <p className="text-gray-300 font-light text-sm leading-relaxed mb-4">
                      {speaker.title}
                    </p>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {speaker.bio}
                    </p>
                  </div>
                </div>

                {/* Speaker Image */}
                <div
                  className={`w-1/2 flex ${index % 2 === 1 ? "justify-start" : "justify-end"}`}
                >
                  <div className="relative w-100 transition-transform duration-700 group-hover:-translate-x-5">
                    <img
                      src={speaker.image}
                      alt={speaker.name}
                      className="speaker-cutout w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Program/Timeline Section - Vertical Timeline */}
      <section
        id="program"
        className="py-12 sm:py-24 bg-black relative overflow-hidden"
      >
        {/* Background decoration - hidden on mobile */}
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-px h-full vertical-timeline-line opacity-30" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-20 animate-fade-in-up">
            <p className="text-red-600 font-bold uppercase tracking-widest mb-2 sm:mb-4 text-xs sm:text-base">
              The Journey
            </p>
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-white ted-logo-text">
              EVENT <span className="text-red-600">TIMELINE</span>
            </h2>
          </div>

          {/* Mobile Timeline - Single column with creative design */}
          <div className="sm:hidden relative">
            {/* Glowing timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-600 via-red-500/50 to-transparent" />

            <div className="space-y-6">
              {timeline.map((item, index) => (
                <div key={item.id} className="relative pl-10 group">
                  {/* Animated dot with glow */}
                  <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-red-600 shadow-lg shadow-red-500/50 group-hover:scale-125 transition-transform duration-300">
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30" />
                  </div>

                  {/* Connector line */}
                  <div className="absolute left-[18px] top-5 w-4 h-0.5 bg-gradient-to-r from-red-600/50 to-transparent" />

                  {/* Content Card */}
                  <div className="relative bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-red-500/20 p-4 rounded-2xl overflow-hidden group-hover:border-red-500/40 transition-all duration-300">
                    {/* Glow effect on hover */}
                    <div className="absolute -inset-1 bg-red-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />

                    {/* Time badge */}
                    <div className="relative flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-red-600 rounded-lg shadow-lg shadow-red-500/30">
                          <span className="text-white font-black text-sm">
                            {item.time}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${getTimelineTypeStyle(item.type).mobile}`}
                        >
                          {item.type}
                        </span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h4 className="relative text-white font-bold text-base uppercase mb-2 leading-tight">
                      {item.title}
                    </h4>
                    <p className="relative text-gray-400 text-xs leading-relaxed">
                      {item.description}
                    </p>

                    {/* Corner accent */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-red-600/30 rounded-br-2xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Timeline - Two columns */}
          <div className="hidden sm:block relative">
            {/* Vertical line */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px vertical-timeline-line" />

            {timeline.map((item, index) => (
              <div
                key={item.id}
                className={`relative flex items-center mb-16 animate-fade-in-up ${
                  index % 2 === 0 ? "flex-row" : "flex-row-reverse"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Content */}
                <div
                  className={`w-5/12 ${index % 2 === 0 ? "text-right pr-12" : "text-left pl-12"}`}
                >
                  <div
                    className={`glass-panel p-6 rounded-lg inline-block ${index % 2 === 0 ? "ml-auto" : "mr-auto"}`}
                  >
                    <span className="text-red-600 font-bold text-lg block mb-2">
                      {item.time}
                    </span>
                    <h4 className="text-white font-black text-xl uppercase mb-2 ted-logo-text">
                      {item.title}
                    </h4>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                    <span
                      className={`inline-block mt-3 px-3 py-1 text-xs uppercase tracking-wide rounded-full ${getTimelineTypeStyle(item.type).desktop}`}
                    >
                      {item.type}
                    </span>
                  </div>
                </div>

                {/* Center dot */}
                <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full dot-glow timeline-dot z-10" />

                {/* Empty space for other side */}
                <div className="w-5/12" />
              </div>
            ))}
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
              className="bg-black text-white hover:bg-gray-900 px-12 rounded-full animate-fade-in-up delay-200"
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
