"use client";

import Link from "next/link";
import {
  Facebook,
  Instagram,
  Mail,
  Phone,
  MapPin,
  MessageCircle
} from "lucide-react";

// Custom TikTok icon since it might not be exported in the local lucide-react version
const TiktokIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-black text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 lg:gap-12">
          {/* Brand - takes 4 columns */}
          <div className="col-span-1 md:col-span-4 flex flex-col justify-between">
            <div>
              <Link href="/" className="flex items-center gap-1 mb-4">
                <span className="text-2xl font-black">TED</span>
                <span className="text-2xl font-black text-red-600">x</span>
                <span className="text-2xl font-light">FPTUniversityHCMC</span>
              </Link>
              <p className="text-gray-500 text-xs sm:text-sm uppercase tracking-wide leading-relaxed">
                This independently organized TEDx event is operated under license
                from TED.
              </p>
            </div>
          </div>

          {/* Explore - takes 2 columns */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-red-600">
              Explore
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/#speakers"
                  className="text-gray-400 hover:text-white transition-colors uppercase font-medium tracking-wide"
                >
                  Speakers
                </Link>
              </li>
              <li>
                <a
                  href="https://www.ted.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors uppercase font-medium tracking-wide"
                >
                  About TED
                </a>
              </li>
            </ul>
          </div>

          {/* Contact - takes 3 columns */}
          <div className="col-span-1 md:col-span-3">
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-red-600">
              Contact
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-gray-400">
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <a href="mailto:tedxfptuniversityhcmc@gmail.com" className="hover:text-white transition-colors break-all">
                  tedxfptuniversityhcmc@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <a href="tel:+84702998614" className="hover:text-white transition-colors">
                  +84 70 299 8614
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="leading-relaxed">
                  Lô E2a-7, Đường D1, Khu Công nghệ cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP. HCM
                </span>
              </li>
            </ul>
          </div>

          {/* Connect - takes 3 columns */}
          <div className="col-span-1 md:col-span-3">
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider text-red-600">
              Connect
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a
                  href="https://facebook.com/tedxfptuniversityhcmc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Facebook className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Fanpage</span>
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/tedxfptuniversityhcmc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Instagram className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Instagram</span>
                </a>
              </li>
              <li>
                <a
                  href="https://www.tiktok.com/@tedxfptuniversityhcmc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <TiktokIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Tiktok</span>
                </a>
              </li>
              <li>
                <a
                  href="https://m.me/tedxfptuniversityhcmc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>Messenger</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-900 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 TEDxFPTUniversityHCMC. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <span>Powered by</span>
            <span className="font-bold text-white">Skillcetera</span>
          </div>
          <div className="flex gap-6 text-sm">
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
