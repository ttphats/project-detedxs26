"use client";

import { Modal, Form, Button, Space } from "antd";
import type { FormInstance } from "antd";
import { ReactNode, useEffect } from "react";

interface FormModalProps {
  title: string;
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: any) => Promise<void> | void;
  form: FormInstance;
  loading?: boolean;
  width?: number | string;
  children: ReactNode;
  initialValues?: Record<string, any>;
  submitText?: string;
  cancelText?: string;
  destroyOnClose?: boolean;
}

export default function FormModal({
  title,
  open,
  onCancel,
  onSubmit,
  form,
  loading = false,
  width = 600,
  children,
  initialValues,
  submitText = "Save",
  cancelText = "Cancel",
  destroyOnClose = true,
}: FormModalProps) {
  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue(initialValues);
    } else if (!open) {
      form.resetFields();
    }
  }, [open, initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (error) {
      // Form validation error - handled by Ant Design
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={width}
      destroyOnClose={destroyOnClose}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {submitText}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        className="mt-4"
      >
        {children}
      </Form>
    </Modal>
  );
}
