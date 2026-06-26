"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition, useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  ShoppingCart,
  Mail,
  Users,
  Settings,
  LogOut,
  Ticket,
  Grid3X3,
  Mic2,
  History,
  Clock,
  Lock,
  UserCheck,
  QrCode,
  LucideIcon,
  Handshake,
  FileText,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { MENU_LABELS } from "@/constants/menu";

const menuItems = [
  { href: "/admin/speakers", label: "Speakers", icon: Mic2 },
  { href: "/admin/speaker-submissions", label: "Manage Applications", icon: ClipboardList },
];


interface MenuItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isPending: boolean;
  onClick: () => void;
}

function MenuItem({
  href,
  label,
  icon: Icon,
  isActive,
  isPending,
  onClick,
  isCollapsed,
}: MenuItemProps & { isCollapsed: boolean }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        prefetch={true}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-[#e62b1e] text-white shadow-lg shadow-red-500/20"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
        title={isCollapsed ? label : undefined}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!isCollapsed && <span className="font-medium">{label}</span>}
      </Link>
    </li>
  );
}

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest("aside") &&
        !target.closest("[data-mobile-menu-button]")
      ) {
        onMobileClose?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileOpen, onMobileClose]);

  const handleNavigation = useCallback(
    (href: string) => {
      // Close mobile menu on navigation
      onMobileClose?.();

      startTransition(() => {
        router.push(href);
      });
    },
    [router, onMobileClose],
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    window.location.href = "/admin/login";
  }, []);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? "w-20" : "w-64"}
          shrink-0 bg-[#1a1a1a] min-h-screen flex flex-col
          transition-all duration-300

          /* Desktop: Sticky sidebar */
          md:sticky md:top-0 md:relative md:translate-x-0

          /* Mobile: Fixed overlay drawer */
          fixed inset-y-0 left-0 z-50
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo & Toggle */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          {!isCollapsed && (
            <Link href="/admin/speaker-submissions" className="flex items-center gap-2">
              <span className="text-2xl font-black text-white">
                TED<span className="text-[#e62b1e]">x</span>
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                Admin
              </span>
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors ml-auto"
            title={isCollapsed ? "Mở rộng" : "Thu gọn"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <MenuItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  isPending={isPending}
                  onClick={() => handleNavigation(item.href)}
                  isCollapsed={isCollapsed}
                />
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            title={isCollapsed ? MENU_LABELS.LOGOUT : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && (
              <span className="font-medium">{MENU_LABELS.LOGOUT}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
