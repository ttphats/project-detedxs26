"use client";

import { Suspense, useState } from "react";
import Sidebar from "./Sidebar";
import AdminHeader from "./AdminHeader";
import { Spin } from "antd";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
        <AdminHeader
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-full">
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
