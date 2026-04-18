"use client";

import { Table, Card, Space, Button, Input, Select, Row, Col, Spin } from "antd";
import { ReloadOutlined, SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { ReactNode, useState, useMemo } from "react";

interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search" | "dateRange";
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: ColumnsType<T>;
  dataSource: T[];
  loading?: boolean;
  rowKey?: string | ((record: T) => string);
  pagination?: TablePaginationConfig | false;
  filters?: FilterConfig[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  headerExtra?: ReactNode;
  scroll?: { x?: number | string; y?: number | string };
  expandable?: any;
  rowSelection?: any;
  size?: "small" | "middle" | "large";
}

export default function DataTable<T extends object>({
  title,
  columns,
  dataSource,
  loading = false,
  rowKey = "id",
  pagination,
  filters = [],
  filterValues = {},
  onFilterChange,
  onRefresh,
  onExport,
  headerExtra,
  scroll,
  expandable,
  rowSelection,
  size = "middle",
}: DataTableProps<T>) {
  const [searchText, setSearchText] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    onFilterChange?.("search", value);
  };

  const renderFilters = () => {
    if (filters.length === 0) return null;

    return (
      <Row gutter={[16, 16]} className="mb-4">
        {filters.map((filter) => (
          <Col key={filter.key} xs={24} sm={12} md={8} lg={6}>
            {filter.type === "select" && (
              <Select
                placeholder={filter.placeholder || filter.label}
                value={filterValues[filter.key]}
                onChange={(value) => onFilterChange?.(filter.key, value)}
                options={filter.options}
                allowClear
                className="w-full"
              />
            )}
            {filter.type === "search" && (
              <Input
                placeholder={filter.placeholder || `Search ${filter.label}`}
                prefix={<SearchOutlined className="text-gray-400" />}
                value={filterValues[filter.key] || searchText}
                onChange={(e) => handleSearchChange(e.target.value)}
                allowClear
              />
            )}
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <Card
      title={title}
      extra={
        <Space>
          {headerExtra}
          {onExport && (
            <Button icon={<DownloadOutlined />} onClick={onExport}>
              Export
            </Button>
          )}
          {onRefresh && (
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={onRefresh}
              loading={loading}
            >
              Refresh
            </Button>
          )}
        </Space>
      }
    >
      {renderFilters()}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey={rowKey}
          pagination={pagination}
          scroll={scroll}
          expandable={expandable}
          rowSelection={rowSelection}
          size={size}
        />
      </Spin>
    </Card>
  );
}
