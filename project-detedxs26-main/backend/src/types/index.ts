// Common types used across the application

// JWT Payload for authentication
export interface JWTPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  description?: string;
  venue: string;
  event_date: Date;
  doors_open_time: Date;
  start_time: Date;
  end_time: Date;
  status: string;
  max_capacity: number;
  available_seats: number;
  banner_image_url?: string;
  thumbnail_url?: string;
  is_published: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  event_id: string;
  total_amount: number;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  expires_at?: Date;
  paid_at?: Date;
  access_token_hash?: string;
  created_at?: Date;
  updated_at?: Date;
}

// API Request types
export interface ConfirmPaymentRequest {
  orderNumber: string;
  accessToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

