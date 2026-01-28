"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Ticket } from "lucide-react";
import { useState, useEffect } from "react";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  // Always show solid background on checkout and order-success pages
  const isCheckoutPage =
    pathname.includes("/checkout") || pathname.includes("/order-success");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled || isCheckoutPage
          ? "bg-black/90 backdrop-blur-xl shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}
    >
      {/* Animated top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* TEDx Logo with glow effect */}
          <Link href="/" className="group flex items-center gap-1 relative">
            {/* Glow behind logo on hover */}
            <div className="absolute -inset-4 bg-red-600/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative text-2xl font-black text-white ted-logo-text tracking-tight">
              TED
            </span>
            <span className="relative text-2xl font-black text-red-600 ted-logo-text animate-pulse">
              x
            </span>
            <span className="relative text-lg font-light text-white/90 tracking-wide">
              FPTUniversityHCMC
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {[
              { href: "#program", label: "Timeline" },
              { href: "#speakers", label: "Speakers" },
              { href: "#partners", label: "Partners" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative px-5 py-2 text-gray-300 hover:text-white font-medium transition-all uppercase text-sm tracking-wider"
              >
                <span className="relative z-10">{item.label}</span>
                {/* Hover background */}
                <div className="absolute inset-0 bg-white/5 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
                {/* Underline animation */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-red-600 group-hover:w-3/4 transition-all duration-300" />
              </Link>
            ))}

            {/* CTA Button with glow */}
            <Link
              href="/events/1/seats"
              className="group relative ml-4 px-6 py-3 overflow-hidden"
            >
              {/* Button background with gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 rounded-full" />
              <div className="absolute inset-[2px] bg-black rounded-full group-hover:bg-red-600 transition-colors duration-300" />
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg shadow-red-500/50" />
              {/* Button content */}
              <span className="relative z-10 flex items-center gap-2 text-white font-bold uppercase text-sm tracking-wider">
                <Ticket className="w-4 h-4" />
                Get Tickets
              </span>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden relative p-3 group"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="absolute inset-0 bg-white/10 rounded-lg scale-0 group-hover:scale-100 transition-transform duration-300" />
            {isMenuOpen ? (
              <X className="relative w-6 h-6 text-white" />
            ) : (
              <Menu className="relative w-6 h-6 text-white" />
            )}
          </button>
        </div>

        {/* Mobile Navigation with slide animation */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-500 ${
            isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="py-4 border-t border-white/10">
            <nav className="flex flex-col gap-1">
              {[
                { href: "#program", label: "Timeline" },
                { href: "#speakers", label: "Speakers" },
                { href: "#partners", label: "Partners" },
              ].map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative px-4 py-3 text-gray-300 hover:text-white font-medium uppercase text-sm tracking-wider overflow-hidden"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="relative z-10">{item.label}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                </Link>
              ))}
              <Link
                href="/events/1/seats"
                className="mx-4 mt-3 px-4 py-3 bg-red-600 text-white font-bold text-center uppercase text-sm tracking-wider rounded-full hover:bg-red-500 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="flex items-center justify-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Get Tickets
                </span>
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
