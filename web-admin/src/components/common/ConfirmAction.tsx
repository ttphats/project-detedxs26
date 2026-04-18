"use client";

import { Popconfirm, Button, Tooltip } from "antd";
import { DeleteOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { ReactNode } from "react";

interface ConfirmActionProps {
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
  okText?: string;
  cancelText?: string;
  okType?: "primary" | "danger" | "default";
  icon?: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
}

export default function ConfirmAction({
  title,
  description,
  onConfirm,
  children,
  okText = "Yes",
  cancelText = "No",
  okType = "danger",
  icon,
  placement = "top",
  disabled = false,
}: ConfirmActionProps) {
  return (
    <Popconfirm
      title={title}
      description={description}
      onConfirm={onConfirm}
      okText={okText}
      cancelText={cancelText}
      okType={okType}
      icon={icon || <QuestionCircleOutlined style={{ color: "red" }} />}
      placement={placement}
      disabled={disabled}
    >
      {children}
    </Popconfirm>
  );
}

// Preset for delete action
export function DeleteButton({
  onDelete,
  itemName = "this item",
  size = "small",
  disabled = false,
}: {
  onDelete: () => void | Promise<void>;
  itemName?: string;
  size?: "small" | "middle" | "large";
  disabled?: boolean;
}) {
  return (
    <ConfirmAction
      title={`Delete ${itemName}?`}
      description="This action cannot be undone."
      onConfirm={onDelete}
      disabled={disabled}
    >
      <Tooltip title="Delete">
        <Button
          danger
          icon={<DeleteOutlined />}
          size={size}
          disabled={disabled}
        />
      </Tooltip>
    </ConfirmAction>
  );
}
