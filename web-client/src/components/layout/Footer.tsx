"use client";

import Link from "next/link";
import { Facebook, Instagram, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-1 mb-4">
              <span className="text-2xl font-black">TED</span>
              <span className="text-2xl font-black text-red-600">x</span>
              <span className="text-2xl font-light">FPTUniversityHCMC</span>
            </Link>
            <p className="text-gray-500 text-sm mb-4 max-w-sm uppercase tracking-wide">
              This independently organized TEDx event is operated under license
              from TED.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider">
              Explore
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="#speakers"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  Speakers
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  Archive
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  About TED
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-sm font-bold mb-4 uppercase tracking-wider">
              Contact
            </h4>
            <ul className="space-y-2 text-sm mb-6">
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  Support
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  Media
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-red-500 transition-colors uppercase"
                >
                  Partner
                </Link>
              </li>
            </ul>
            <div className="flex gap-3">
              <a
                href="#"
                className="w-8 h-8 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-8 h-8 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
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
