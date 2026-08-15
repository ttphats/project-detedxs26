"use client";

import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Button,
  Input,
  Select,
  Switch,
  Tag,
  Popconfirm,
  message,
  notification,
  Empty,
  Space,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  HolderOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  fetchGalleryEvents,
  createGalleryEvent,
  updateGalleryEvent,
  deleteGalleryEvent,
  reorderGalleryEvents,
  type GalleryEvent,
  type GalleryEventInput,
} from "@/lib/gallery-client";
import GalleryForm from "./GalleryForm";

type VisibilityFilter = "all" | "visible" | "hidden";
type SortMode = "order" | "date";

function DraggableRow(props: React.HTMLAttributes<HTMLTableRowElement> & { "data-row-key": string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"],
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 10, background: "#fafafa" } : {}),
  };

  return (
    <tr {...props} ref={setNodeRef} style={style}>
      {Children.map(props.children, (child) => {
        if (!isValidElement(child)) return child;
        if (child.key === "drag-handle") {
          return cloneElement(child as React.ReactElement<{ children?: React.ReactNode }>, {
            children: (
              <span
                {...attributes}
                {...listeners}
                className="flex cursor-grab items-center justify-center"
                style={{ touchAction: "none" }}
              >
                <HolderOutlined className="text-gray-400" />
              </span>
            ),
          });
        }
        return child;
      })}
    </tr>
  );
}

export default function GalleryAdminPage() {
  const [events, setEvents] = useState<GalleryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("order");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GalleryEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchGalleryEvents();
      setEvents(data);
    } catch (err) {
      console.error("[GALLERY ADMIN] Failed to load:", err);
      message.error(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const reorderEnabled = sortMode === "order" && !searchText && visibilityFilter === "all";

  const displayedEvents = useMemo(() => {
    let list = [...events];
    if (visibilityFilter === "visible") list = list.filter((e) => e.isVisible);
    if (visibilityFilter === "hidden") list = list.filter((e) => !e.isVisible);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (sortMode === "date") {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      list.sort((a, b) => a.order - b.order);
    }
    return list;
  }, [events, visibilityFilter, searchText, sortMode]);

  const handleToggleVisible = async (event: GalleryEvent, checked: boolean) => {
    const prev = events;
    setEvents((cur) => cur.map((e) => (e.id === event.id ? { ...e, isVisible: checked } : e)));
    try {
      await updateGalleryEvent(event.id, { isVisible: checked });
    } catch (err) {
      setEvents(prev);
      message.error(err instanceof Error ? err.message : "Failed to update visibility");
    }
  };

  const handleDuplicate = async (event: GalleryEvent) => {
    try {
      const { id: _id, order: _order, ...rest } = event;
      const created = await createGalleryEvent({ ...rest, title: `${rest.title} (copy)` });
      setEvents((cur) => [...cur, created]);
      message.success("Event duplicated");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to duplicate event");
    }
  };

  const handleDelete = (event: GalleryEvent) => {
    const prevEvents = events;
    setEvents((cur) => cur.filter((e) => e.id !== event.id));
    setSelectedRowKeys((keys) => keys.filter((k) => k !== event.id));

    const key = `undo-delete-${event.id}`;
    const timeoutId = setTimeout(async () => {
      try {
        await deleteGalleryEvent(event.id);
      } catch (err) {
        message.error(
          `Failed to delete "${event.title}": ${err instanceof Error ? err.message : "unknown error"}`,
        );
        setEvents((cur) => [...cur, event]);
      }
    }, 5000);

    notification.open({
      key,
      message: "Event deleted",
      description: `"${event.title}" was removed permanently.`,
      duration: 5,
      btn: (
        <Button
          size="small"
          onClick={() => {
            clearTimeout(timeoutId);
            setEvents(prevEvents);
            notification.destroy(key);
          }}
        >
          Undo
        </Button>
      ),
    });
  };

  const handleBulkDelete = () => {
    const ids = new Set(selectedRowKeys as string[]);
    const toDelete = events.filter((e) => ids.has(e.id));
    toDelete.forEach((event) => handleDelete(event));
  };

  const handleBulkHide = async () => {
    const ids = new Set(selectedRowKeys as string[]);
    const prev = events;
    setEvents((cur) => cur.map((e) => (ids.has(e.id) ? { ...e, isVisible: false } : e)));
    try {
      await Promise.all(
        Array.from(ids).map((id) => updateGalleryEvent(id, { isVisible: false })),
      );
      message.success(`${ids.size} event(s) hidden`);
      setSelectedRowKeys([]);
    } catch (err) {
      setEvents(prev);
      message.error(err instanceof Error ? err.message : "Failed to hide events");
    }
  };

  const handleDragEnd = async (dragEvent: DragEndEvent) => {
    const { active, over } = dragEvent;
    if (!over || active.id === over.id) return;

    const oldIndex = displayedEvents.findIndex((e) => e.id === active.id);
    const newIndex = displayedEvents.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(displayedEvents, oldIndex, newIndex);
    const prev = events;
    setEvents(reordered.map((e, i) => ({ ...e, order: i })));

    try {
      await reorderGalleryEvents(reordered.map((e) => e.id));
    } catch (err) {
      setEvents(prev);
      message.error(err instanceof Error ? err.message : "Failed to save new order");
    }
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (event: GalleryEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleSubmit = async (input: GalleryEventInput) => {
    setSaving(true);
    try {
      if (editingEvent) {
        const updated = await updateGalleryEvent(editingEvent.id, input);
        setEvents((cur) => cur.map((e) => (e.id === updated.id ? updated : e)));
        message.success("Event updated");
      } else {
        const created = await createGalleryEvent(input);
        setEvents((cur) => [...cur, created]);
        message.success("Event created");
      }
      setFormOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<GalleryEvent> = [
    ...(reorderEnabled
      ? [{ key: "drag-handle", width: 32, title: "" }]
      : []),
    {
      title: "",
      dataIndex: "imageUrl",
      width: 64,
      render: (url: string, record) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={record.imageAlt}
          className="h-14 w-11 rounded-md object-cover"
          style={{
            objectPosition: `${record.focalPoint.x * 100}% ${record.focalPoint.y * 100}%`,
          }}
        />
      ),
    },
    {
      title: "Title",
      dataIndex: "title",
      render: (title: string, record) => (
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {record.tags.map((tag) => (
              <Tag key={tag} className="text-[10px]">
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Date",
      dataIndex: "date",
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString("en-US", { timeZone: "UTC" }),
    },
    {
      title: "Order",
      dataIndex: "order",
      width: 70,
    },
    {
      title: "Visible",
      dataIndex: "isVisible",
      width: 90,
      render: (isVisible: boolean, record) => (
        <Switch
          checked={isVisible}
          onChange={(checked) => handleToggleVisible(record, checked)}
          size="small"
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          </Tooltip>
          <Tooltip title="Duplicate">
            <Button size="small" icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete this event?"
            description={`"${record.title}" will be permanently removed.`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Events Gallery</h1>
          <p className="text-sm text-gray-500">
            Manage what appears on the public gallery strip and its left-to-right order.
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          New Event
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input.Search
          placeholder="Search by title"
          allowClear
          className="w-64"
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Select<VisibilityFilter>
          value={visibilityFilter}
          onChange={setVisibilityFilter}
          className="w-40"
          options={[
            { value: "all", label: "All events" },
            { value: "visible", label: "Visible only" },
            { value: "hidden", label: "Hidden only" },
          ]}
        />
        <Select<SortMode>
          value={sortMode}
          onChange={setSortMode}
          className="w-48"
          options={[
            { value: "order", label: "Sort: manual order" },
            { value: "date", label: "Sort: date (newest)" },
          ]}
        />
        {!reorderEnabled && (
          <span className="text-xs text-gray-400">
            Clear search/filters and switch to manual order to drag-reorder rows
          </span>
        )}
        {selectedRowKeys.length > 0 && (
          <Space className="ml-auto">
            <span className="text-sm text-gray-500">{selectedRowKeys.length} selected</span>
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={handleBulkHide}>
              Hide
            </Button>
            <Popconfirm
              title={`Delete ${selectedRowKeys.length} event(s)?`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={handleBulkDelete}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>

      {!loading && events.length === 0 ? (
        <Empty
          description="No gallery events yet"
          className="rounded-lg border border-dashed border-gray-300 bg-white py-16"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Create your first event
          </Button>
        </Empty>
      ) : reorderEnabled ? (
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayedEvents.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table<GalleryEvent>
              rowKey="id"
              loading={loading}
              dataSource={displayedEvents}
              columns={columns}
              pagination={false}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              components={{ body: { row: DraggableRow } }}
            />
          </SortableContext>
        </DndContext>
      ) : (
        <Table<GalleryEvent>
          rowKey="id"
          loading={loading}
          dataSource={displayedEvents}
          columns={columns}
          pagination={false}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      )}

      <GalleryForm
        open={formOpen}
        event={editingEvent}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </AdminLayout>
  );
}
