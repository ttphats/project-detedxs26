"use client";

import { Tag } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";

type StatusType = 
  | "PUBLISHED" | "DRAFT" | "ARCHIVED" 
  | "PENDING" | "PAID" | "CANCELLED" | "EXPIRED" | "REFUNDED"
  | "AVAILABLE" | "RESERVED" | "SOLD" | "LOCKED"
  | "ACTIVE" | "INACTIVE"
  | "SUCCESS" | "FAILED" | "PROCESSING";

const STATUS_CONFIG: Record<StatusType, { color: string; icon?: React.ReactNode }> = {
  // Event status
  PUBLISHED: { color: "green", icon: <CheckCircleOutlined /> },
  DRAFT: { color: "orange", icon: <ClockCircleOutlined /> },
  ARCHIVED: { color: "default" },

  // Order/Payment status
  PENDING: { color: "orange", icon: <ClockCircleOutlined /> },
  PAID: { color: "green", icon: <CheckCircleOutlined /> },
  CANCELLED: { color: "red", icon: <CloseCircleOutlined /> },
  EXPIRED: { color: "default", icon: <CloseCircleOutlined /> },
  REFUNDED: { color: "purple" },

  // Seat status
  AVAILABLE: { color: "green" },
  RESERVED: { color: "orange" },
  SOLD: { color: "blue" },
  LOCKED: { color: "red", icon: <ExclamationCircleOutlined /> },

  // General status
  ACTIVE: { color: "green", icon: <CheckCircleOutlined /> },
  INACTIVE: { color: "default" },
  SUCCESS: { color: "green", icon: <CheckCircleOutlined /> },
  FAILED: { color: "red", icon: <CloseCircleOutlined /> },
  PROCESSING: { color: "blue", icon: <SyncOutlined spin /> },
};

interface StatusTagProps {
  status: string;
  showIcon?: boolean;
  className?: string;
}

export default function StatusTag({
  status,
  showIcon = true,
  className = "",
}: StatusTagProps) {
  const config = STATUS_CONFIG[status as StatusType] || { color: "default" };

  return (
    <Tag
      color={config.color}
      icon={showIcon ? config.icon : undefined}
      className={className}
    >
      {status}
    </Tag>
  );
}

// For boolean active/inactive
export function ActiveTag({ active }: { active: boolean }) {
  return <StatusTag status={active ? "ACTIVE" : "INACTIVE"} />;
}
