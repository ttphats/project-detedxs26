/**
 * API Client for calling Fastify Backend (port 4000)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

  // Add auth token if provided
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
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

export { API_URL };

