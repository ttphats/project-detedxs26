"use client";

import { Suspense } from "react";
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
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <AdminHeader />
        <main className="flex-1 p-6 overflow-auto">
          <Suspense fallback={<PageLoader />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
