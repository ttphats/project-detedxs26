"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, User, Calendar } from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    href: "/",
    icon: <Home className="w-5 h-5" />,
    label: "Trang chủ",
    active: (pathname) => pathname === "/",
  },
  {
    href: "/events/1/seats",
    icon: <Ticket className="w-5 h-5" />,
    label: "Đặt vé",
    active: (pathname) => pathname.includes("/seats"),
  },
  {
    href: "#program",
    icon: <Calendar className="w-5 h-5" />,
    label: "Lịch trình",
  },
  {
    href: "#speakers",
    icon: <User className="w-5 h-5" />,
    label: "Speakers",
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Don't show on order-success page only
  if (pathname.includes("/order-success")) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl border-t border-white/10" />

      {/* Gradient glow on top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />

      {/* Nav items */}
      <div className="relative flex items-center justify-around py-2 px-2 safe-area-bottom">
        {navItems.map((item) => {
          const isActive = item.active ? item.active(pathname) : false;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all ${
                isActive
                  ? "text-red-500"
                  : "text-gray-400 hover:text-white active:scale-95"
              }`}
            >
              {/* Icon with glow for active state */}
              <div className="relative">
                {isActive && (
                  <div className="absolute inset-0 bg-red-500/30 blur-md rounded-full" />
                )}
                <div className="relative">{item.icon}</div>
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-medium ${isActive ? "text-red-500" : ""}`}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 bg-red-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
