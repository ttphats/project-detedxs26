"use client";

import { useEffect, useState } from "react";
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Button,
  Space,
  Divider,
  Upload,
  message,
} from "antd";
import { LoadingOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import dayjs from "dayjs";
import type { GalleryEvent, GalleryEventInput } from "@/lib/gallery-client";
import ImageFrameEditor from "./ImageFrameEditor";

const { TextArea } = Input;

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 600;
const ACCEPTED_TYPES = ["image/png", "image/jpeg"];

interface GalleryFormProps {
  open: boolean;
  event: GalleryEvent | null; // null = creating
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: GalleryEventInput) => Promise<void>;
}

interface FormValues {
  title: string;
  description: string;
  date?: dayjs.Dayjs;
  tags: string[];
  imageUrl: string;
  imageAlt?: string;
  isVisible: boolean;
}

export default function GalleryForm({
  open,
  event,
  saving,
  onClose,
  onSubmit,
}: GalleryFormProps) {
  const [form] = Form.useForm<FormValues>();
  const [isDirty, setIsDirty] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [focalPoint, setFocalPoint] = useState({ x: 0.5, y: 0.5 });
  const [zoom, setZoom] = useState(1);
  const [descLength, setDescLength] = useState(0);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsDirty(false);
    setConfirmingClose(false);
    if (event) {
      form.setFieldsValue({
        title: event.title,
        description: event.description,
        date: dayjs(event.date),
        tags: event.tags,
        imageUrl: event.imageUrl,
        imageAlt: event.imageAlt,
        isVisible: event.isVisible,
      });
      setImageUrl(event.imageUrl);
      setFocalPoint(event.focalPoint);
      setZoom(event.zoom);
      setDescLength(event.description.length);
    } else {
      form.resetFields();
      form.setFieldsValue({ isVisible: true, tags: [] });
      setImageUrl("");
      setFocalPoint({ x: 0.5, y: 0.5 });
      setZoom(1);
      setDescLength(0);
    }
  }, [open, event, form]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const handleFinish = async (values: FormValues) => {
    await onSubmit({
      title: values.title.trim(),
      description: values.description.trim(),
      date: (values.date ?? dayjs()).format("YYYY-MM-DD"),
      imageUrl: values.imageUrl.trim(),
      imageAlt: values.imageAlt?.trim() || values.title.trim(),
      tags: values.tags ?? [],
      isVisible: values.isVisible,
      focalPoint,
      zoom,
    });
  };

  const handlePosterUpload: UploadProps["beforeUpload"] = async (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      message.error("Only PNG or JPG images are allowed");
      return false;
    }
    setUploadingPoster(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", "gallery");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        form.setFieldsValue({ imageUrl: data.data.url });
        setImageUrl(data.data.url);
        setIsDirty(true);
        message.success("Poster uploaded");
      } else {
        message.error(data.error || "Upload failed");
      }
    } catch {
      message.error("Upload failed");
    } finally {
      setUploadingPoster(false);
    }
    return false; // prevent antd's own upload; we've handled it above
  };

  return (
    <Drawer
      title={event ? `Edit "${event.title}"` : "New Event"}
      open={open}
      onClose={handleAttemptClose}
      size={640}
      destroyOnHidden
      footer={
        <div className="flex items-center justify-between">
          {confirmingClose ? (
            <Space>
              <span className="text-sm text-gray-500">Discard unsaved changes?</span>
              <Button size="small" onClick={() => setConfirmingClose(false)}>
                Keep editing
              </Button>
              <Button size="small" danger onClick={onClose}>
                Discard
              </Button>
            </Space>
          ) : (
            <span />
          )}
          <Space>
            <Button onClick={handleAttemptClose}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              Save
            </Button>
          </Space>
        </div>
      }
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={(_, values) => {
          setIsDirty(true);
          setConfirmingClose(false);
          if (values.imageUrl !== undefined) setImageUrl(values.imageUrl);
          if (values.description !== undefined) setDescLength(values.description.length);
        }}
      >
        <Form.Item
          name="title"
          label="Title"
          rules={[
            { required: true, message: "Title is required" },
            { max: TITLE_MAX, message: `Max ${TITLE_MAX} characters` },
          ]}
        >
          <Input placeholder="Opening Keynote" showCount maxLength={TITLE_MAX} />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[
            { required: true, message: "Description is required" },
            { max: DESCRIPTION_MAX, message: `Max ${DESCRIPTION_MAX} characters` },
          ]}
          extra={
            <span className={descLength > DESCRIPTION_MAX ? "text-red-500" : "text-gray-400"}>
              {descLength}/{DESCRIPTION_MAX}
            </span>
          }
        >
          <TextArea
            rows={4}
            placeholder="Shown in the quick view"
            maxLength={DESCRIPTION_MAX}
          />
        </Form.Item>

        <Form.Item name="date" label="Date" tooltip="Optional — used for sorting only, never shown on the public card">
          <DatePicker className="w-full" />
        </Form.Item>

        <Form.Item name="tags" label="Tags">
          <Select mode="tags" placeholder="TALK, WORKSHOP, PANEL..." tokenSeparators={[","]} />
        </Form.Item>

        <div className="flex items-start gap-2">
          <Form.Item
            name="imageUrl"
            label="Poster"
            rules={[{ required: true, message: "A poster image is required" }]}
            extra="Recommended source size: 3300 × 4200px (11:14). Paste a URL or upload a PNG/JPG."
            className="flex-1"
          >
            <Input placeholder="https://..." />
          </Form.Item>
          {/* Invisible label matches the Input's Form.Item so the button lines up with the field, not the label */}
          <Form.Item label={<span className="invisible">Upload</span>}>
            <Upload
              accept="image/png,image/jpeg"
              showUploadList={false}
              beforeUpload={handlePosterUpload}
            >
              <Button icon={uploadingPoster ? <LoadingOutlined /> : <UploadOutlined />}>
                {uploadingPoster ? "Uploading..." : "Upload"}
              </Button>
            </Upload>
          </Form.Item>
        </div>

        <Form.Item
          name="imageAlt"
          label="Alt text"
          tooltip="Optional — describe what's in the photo for accessibility. Falls back to the title if left blank."
        >
          <Input placeholder="Speaker on stage delivering the opening keynote" />
        </Form.Item>

        <Form.Item name="isVisible" label="Visible on public gallery" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Divider />

        <Form.Item label="Card frame preview">
          <ImageFrameEditor
            imageUrl={imageUrl}
            focalPoint={focalPoint}
            zoom={zoom}
            onChange={(next) => {
              setFocalPoint(next.focalPoint);
              setZoom(next.zoom);
              setIsDirty(true);
            }}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
