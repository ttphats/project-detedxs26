/**
 * API Client for calling Fastify Backend (port 4000)
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = API_BASE_URL;

/**
 * Get full API URL for an endpoint
 * Usage: getApiUrl('/admin/events') => 'http://localhost:4000/api/admin/events'
 */
export function getApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}

interface ApiOptions extends RequestInit {
  token?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Make API request to backend
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if provided or from localStorage
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('API request error:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * GET request
 */
export async function apiGet<T = any>(endpoint: string, options?: ApiOptions): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export async function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: ApiOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: ApiOptions
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(endpoint: string, options?: ApiOptions): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/**
 * Upload file (multipart/form-data)
 */
export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData,
  options?: ApiOptions
): Promise<ApiResponse<T>> {
  const { token, headers, ...fetchOptions } = options || {};

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const requestHeaders: HeadersInit = {};
  
  if (authToken) {
    (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method: 'POST',
      headers: requestHeaders,
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('API upload error:', error);
    return {
      success: false,
      error: error.message || 'Upload failed',
    };
  }
}

/**
 * Get auth headers with token from localStorage
 */
export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export { API_URL };

