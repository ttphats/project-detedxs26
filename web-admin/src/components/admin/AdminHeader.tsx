"use client";

import { useEffect, useState } from "react";
import { Bell, Search, LogOut } from "lucide-react";

interface User {
  fullName: string;
  email: string;
  role: string;
}

export default function AdminHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; path=/; max-age=0";
    window.location.href = "/admin/login";
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e] focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#e62b1e] rounded-full"></span>
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="w-8 h-8 bg-[#e62b1e] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">
                {user?.fullName?.charAt(0) || "A"}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.fullName || "Admin"}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role || "Super Admin"}
              </p>
            </div>
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="ml-2 p-2 text-gray-400 hover:text-[#e62b1e] hover:bg-red-50 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
