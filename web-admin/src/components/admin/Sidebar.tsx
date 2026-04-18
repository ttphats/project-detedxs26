"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
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
  LucideIcon,
} from "lucide-react";

const menuItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/ticket-types", label: "Ticket Types", icon: Ticket },
  { href: "/admin/speakers", label: "Speakers", icon: Mic2 },
  { href: "/admin/timelines", label: "Timeline", icon: Clock },
  { href: "/admin/layout-editor", label: "Seats & Layout", icon: Grid3X3 },
  { href: "/admin/seat-locks", label: "Seat Locks", icon: Lock },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: History },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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
}: MenuItemProps) {
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
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium">{label}</span>
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleNavigation = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    window.location.href = "/admin/login";
  }, []);

  return (
    <aside className="w-64 bg-[#1a1a1a] min-h-screen flex flex-col sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="text-2xl font-black text-white">
            TED<span className="text-[#e62b1e]">x</span>
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Admin
          </span>
        </Link>
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
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
