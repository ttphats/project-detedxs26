"use client";

import Link from "next/link";
import { ArrowLeft, Shield, FileText, UserCheck, Lock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

export default function PrivacyPage() {
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    // Current date format
    const today = new Date();
    setLastUpdated(today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const sections = [
    {
      icon: Shield,
      title: "1. Information Collection",
      content: (
        <>
          <p className="mb-3">
            We collect information you provide directly to us when you register for the event:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Full Name</li>
            <li>Email Address</li>
            <li>Phone Number</li>
            <li>Student/Staff ID (if applicable)</li>
          </ul>
        </>
      ),
    },
    {
      icon: FileText,
      title: "2. Use of Information",
      content: (
        <>
          <p className="mb-3">
            The information we collect is used for the following purposes:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>To process your ticket registration and payment</li>
            <li>To send you important updates about the event</li>
            <li>To verify your identity at check-in</li>
            <li>To improve our future events</li>
          </ul>
        </>
      ),
    },
    {
      icon: UserCheck,
      title: "3. Information Sharing",
      content: (
        <p className="text-gray-400">
          We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information with our partners and advertisers for the purposes outlined above.
        </p>
      ),
    },
    {
      icon: Lock,
      title: "4. Data Security",
      content: (
        <p className="text-gray-400">
          We adopt appropriate data collection, storage, and processing practices and security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information and data stored on our site.
        </p>
      ),
    },
    {
      icon: AlertCircle,
      title: "5. Your Rights",
      content: (
        <p className="text-gray-400">
          You have the right to access, update, or delete your personal information at any time. If you have any questions about this Privacy Policy, the practices of this site, or your dealings with this site, please contact us.
        </p>
      ),
    }
  ];

  return (
    <div className="bg-black text-white min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Homepage</span>
        </Link>

        <div className="border-b border-white/10 pb-8 mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            PRIVACY <span className="text-red-600 font-black">POLICY</span>
          </h1>
          <p className="text-gray-500 text-sm">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-invert max-w-none text-gray-300 text-base sm:text-lg mb-12 leading-relaxed">
          <p>
            Welcome to the <span className="font-bold text-white">TEDxFPTUniversityHCMC</span> event. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data and tell you about your privacy rights and how the law protects you.
          </p>
        </div>

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
      </div>
    </div>
  );
}
