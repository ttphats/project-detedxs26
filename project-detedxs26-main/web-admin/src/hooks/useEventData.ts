"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";

interface Event {
  id: string;
  name: string;
  status?: string;
}

interface UseEventDataOptions<T> {
  endpoint: string;
  dataKey?: string;
  eventsKey?: string;
}

interface UseEventDataReturn<T> {
  data: T[];
  events: Event[];
  loading: boolean;
  selectedEvent: string | undefined;
  setSelectedEvent: (eventId: string) => void;
  refetch: () => Promise<void>;
  create: (values: any) => Promise<boolean>;
  update: (id: string, values: any) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useEventData<T>({
  endpoint,
  dataKey = "data",
  eventsKey = "events",
}: UseEventDataOptions<T>): UseEventDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>();

  const getToken = () => localStorage.getItem("token");

  const fetchData = useCallback(async (eventId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("eventId", eventId);
      
      const res = await fetch(`/api/admin/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();

      if (json.success && json.data) {
        // Handle different response structures
        if (Array.isArray(json.data)) {
          setData(json.data);
        } else {
          setData(json.data[dataKey] || []);
          if (json.data[eventsKey]) {
            setEvents(json.data[eventsKey]);
            // Auto-select published event on first load
            if (!eventId && !selectedEvent) {
              const published = json.data[eventsKey].find(
                (e: Event) => e.status === "PUBLISHED"
              );
              const defaultId = published?.id || json.data[eventsKey][0]?.id;
              if (defaultId) {
                setSelectedEvent(defaultId);
                // Refetch with selected event
                fetchData(defaultId);
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [endpoint, dataKey, eventsKey, selectedEvent]);

  const handleEventChange = useCallback((eventId: string) => {
    setSelectedEvent(eventId);
    fetchData(eventId);
  }, [fetchData]);

  const create = useCallback(async (values: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (json.success) {
        message.success("Created successfully");
        await fetchData(selectedEvent);
        return true;
      }
      message.error(json.error || "Create failed");
      return false;
    } catch {
      message.error("Network error");
      return false;
    }
  }, [endpoint, selectedEvent, fetchData]);

  const update = useCallback(async (id: string, values: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/${endpoint}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (json.success) {
        message.success("Updated successfully");
        await fetchData(selectedEvent);
        return true;
      }
      message.error(json.error || "Update failed");
      return false;
    } catch {
      message.error("Network error");
      return false;
    }
  }, [endpoint, selectedEvent, fetchData]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/${endpoint}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (json.success) {
        message.success("Deleted successfully");
        await fetchData(selectedEvent);
        return true;
      }
      message.error(json.error || "Delete failed");
      return false;
    } catch {
      message.error("Network error");
      return false;
    }
  }, [endpoint, selectedEvent, fetchData]);

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    events,
    loading,
    selectedEvent,
    setSelectedEvent: handleEventChange,
    refetch: () => fetchData(selectedEvent),
    create,
    update,
    remove,
  };
}
