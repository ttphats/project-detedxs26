"use client";

import { Select, Space, Tag } from "antd";
import { useMemo } from "react";

interface Event {
  id: string;
  name: string;
  status?: string;
}

interface EventFilterProps {
  events: Event[];
  value?: string;
  onChange: (eventId: string) => void;
  loading?: boolean;
  showStatus?: boolean;
  className?: string;
  placeholder?: string;
}

export default function EventFilter({
  events,
  value,
  onChange,
  loading = false,
  showStatus = true,
  className = "",
  placeholder = "Select Event",
}: EventFilterProps) {
  const options = useMemo(() => {
    return events.map((event) => ({
      value: event.id,
      label: (
        <Space>
          <span>{event.name}</span>
          {showStatus && event.status && (
            <Tag
              color={event.status === "PUBLISHED" ? "green" : "orange"}
              style={{ marginLeft: 8 }}
            >
              {event.status}
            </Tag>
          )}
        </Space>
      ),
      searchLabel: event.name,
    }));
  }, [events, showStatus]);

  return (
    <Select
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      className={`min-w-[200px] ${className}`}
      showSearch
      filterOption={(input, option) =>
        (option?.searchLabel as string)?.toLowerCase().includes(input.toLowerCase())
      }
      optionFilterProp="searchLabel"
    />
  );
}

// Helper to get default event (PUBLISHED first)
export function getDefaultEventId(events: Event[]): string | undefined {
  if (!events?.length) return undefined;
  const published = events.find((e) => e.status === "PUBLISHED");
  return published?.id || events[0]?.id;
}
