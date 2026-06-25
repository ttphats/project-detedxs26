"use client";

import { Button, Space, Breadcrumb } from "antd";
import { PlusOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import { ReactNode } from "react";

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  onAdd?: () => void;
  addText?: string;
  backHref?: string;
  extra?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  onAdd,
  addText = "Add New",
  backHref,
  extra,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs.length > 0 && (
        <Breadcrumb
          className="mb-2"
          items={breadcrumbs.map((item) => ({
            title: item.href ? (
              <Link href={item.href}>{item.title}</Link>
            ) : (
              item.title
            ),
          }))}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backHref && (
            <Link href={backHref}>
              <Button icon={<ArrowLeftOutlined />} type="text" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            {subtitle && (
              <p className="text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        <Space>
          {extra}
          {onAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {addText}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}
