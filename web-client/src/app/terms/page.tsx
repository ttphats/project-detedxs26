"use client";

import Link from "next/link";
import { ArrowLeft, Ticket, CalendarDays, Video, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function PolicyPage() {
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const today = new Date();
    setLastUpdated(today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const sections = [
    {
      icon: Ticket,
      title: "1. Ticket Registration & Payment",
      content: (
        <>
          <p className="mb-3">
            Tickets are only valid when purchased through our official website or authorized partners.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>All ticket purchases are final and non-refundable under any circumstances.</li>
            <li>Tickets cannot be exchanged for cash or other goods/services.</li>
            <li>The Organizing Committee will not resolve any cases of ticket buying, selling, or transferring outside of the official organization.</li>
          </ul>
        </>
      ),
    },
    {
      icon: CalendarDays,
      title: "2. Event Entry & Attendance",
      content: (
        <>
          <p className="mb-3">
             Attendees must comply with event security and etiquette regulations:
           </p>
           <ul className="list-disc pl-5 space-y-2 text-gray-400">
             <li>Present a valid e-ticket (QR code) along with personal ID (ID Card/Student ID) at the check-in counter to receive an attendee badge.</li>
             <li>The Organizing Committee reserves the right to deny entry to anyone without a valid ticket or exhibiting inappropriate behavior that disrupts the event.</li>
             <li>Please arrive during the check-in period. If you arrive more than 15 minutes late after the event starts, the Organizing Committee will arrange seating for you to avoid disrupting the speakers and the program. This means we cannot guarantee you will sit in your previously selected seat if you arrive more than 15 minutes late from the event start time.</li>
             <li>Comply with fire safety regulations or other instructions from event coordinators.</li>
           </ul>
        </>
      ),
    },
    {
      icon: Video,
      title: "3. Recording, Photography & Media",
      content: (
        <>
          <p className="mb-3">
            TEDx is a fully recorded event for archival and publishing on the global TEDx channel:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>By attending the event, you agree to allow the Organizing Committee to use images, voices, or short video clips in which you may appear for non-profit communication purposes of TEDx.</li>
            <li>The audience is not allowed to use professional photography/recording equipment (such as DSLR cameras, tripods, camcorders) inside the hall without consent or a press pass from the Organizing Committee.</li>
            <li>Please switch phones and electronic devices to silent or turn them off during the program. Flash photography via phones is strictly prohibited.</li>
          </ul>
        </>
      ),
    },
    {
      icon: HelpCircle,
      title: "4. Force Majeure",
      content: (
        <p className="text-gray-400">
          In the event that the event must be postponed or the time/venue changed due to natural disasters, epidemics, or unexpected requests from competent authorities, the Organizing Committee will notify you as soon as possible via the registered email. Your ticket will be automatically extended and valid for the new time or location. The Organizing Committee is not responsible for other incurred personal expenses such as travel or accommodation.
        </p>
      ),
    },
  ];

  return (
    <div className="bg-black text-white min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Homepage</span>
        </Link>

        {/* Title & Metadata */}
        <div className="border-b border-white/10 pb-8 mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            TERMS & <span className="text-red-600 font-black">CONDITIONS</span>
          </h1>
          <p className="text-gray-500 text-sm">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Introduction */}
        <div className="prose prose-invert max-w-none text-gray-300 text-base sm:text-lg mb-12 leading-relaxed">
          <p>
            Welcome to the <span className="font-bold text-white">TEDxFPTUniversityHCMC</span> event. To ensure the event is successful and provides a complete and safe experience for everyone, please carefully read the regulations and terms below. Completing the ticket purchase means you commit to fully complying with these contents.
          </p>
        </div>

        {/* Sections Grid/List */}
        <div className="space-y-12">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <section
                key={idx}
                className="bg-[#121212] border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-red-600/35 transition-all duration-300 hover:shadow-[0_0_20px_rgba(230,43,30,0.05)]"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="bg-red-600/10 p-3 rounded-xl border border-red-600/20 text-red-600">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                    {section.title}
                  </h2>
                </div>
                <div className="text-gray-300 leading-relaxed text-sm sm:text-base">
                  {section.content}
                </div>
              </section>
            );
          })}
        </div>

        {/* Support Callout */}
        <div className="mt-16 bg-gradient-to-r from-red-950/20 via-black to-black border border-red-950/50 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Need help with the terms?</h3>
            <p className="text-gray-400 text-sm">
              The Organizing Committee is always ready to listen and assist with your requests.
            </p>
          </div>
          <a
            href="mailto:tedxfptuniversityhcmc@gmail.com"
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shrink-0"
          >
            tedxfptuniversityhcmc@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
