"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { message } from "antd";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  cache?: boolean;
  cacheKey?: string;
}

// Simple in-memory cache
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export function useApi<T = any>(
  url: string | null,
  options: UseApiOptions = {}
) {
  const { immediate = true, onSuccess, onError, cache = false, cacheKey } = options;
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: immediate && !!url,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (fetchUrl?: string) => {
    const targetUrl = fetchUrl || url;
    if (!targetUrl) return;

    // Check cache first
    const key = cacheKey || targetUrl;
    if (cache) {
      const cached = apiCache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setState({ data: cached.data, loading: false, error: null });
        onSuccess?.(cached.data);
        return cached.data;
      }
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(targetUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal,
      });

      const json = await res.json();

      if (json.success) {
        setState({ data: json.data, loading: false, error: null });
        if (cache) {
          apiCache.set(key, { data: json.data, timestamp: Date.now() });
        }
        onSuccess?.(json.data);
        return json.data;
      } else {
        const errorMsg = json.error || "API Error";
        setState({ data: null, loading: false, error: errorMsg });
        onError?.(errorMsg);
        return null;
      }
    } catch (error: any) {
      if (error.name === "AbortError") return;
      const errorMsg = error.message || "Network Error";
      setState({ data: null, loading: false, error: errorMsg });
      onError?.(errorMsg);
      return null;
    }
  }, [url, cache, cacheKey, onSuccess, onError]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  const mutate = useCallback((newData: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      ...prev,
      data: typeof newData === "function" 
        ? (newData as (prev: T | null) => T)(prev.data) 
        : newData,
    }));
  }, []);

  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [url, immediate]);

  return {
    ...state,
    refetch,
    mutate,
    fetchData,
  };
}

// Hook for mutations (POST, PUT, DELETE)
export function useMutation<T = any, P = any>(
  urlOrFn: string | ((params: P) => string),
  method: "POST" | "PUT" | "DELETE" = "POST"
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (data?: P, customUrl?: string): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token");
        const url = customUrl || (typeof urlOrFn === "function" ? urlOrFn(data as P) : urlOrFn);
        
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        const json = await res.json();

        if (json.success) {
          setLoading(false);
          return json.data;
        } else {
          const errorMsg = json.error || "Operation failed";
          setError(errorMsg);
          message.error(errorMsg);
          setLoading(false);
          return null;
        }
      } catch (err: any) {
        const errorMsg = err.message || "Network Error";
        setError(errorMsg);
        message.error(errorMsg);
        setLoading(false);
        return null;
      }
    },
    [urlOrFn, method]
  );

  return { execute, loading, error };
}

// Invalidate cache
export function invalidateCache(key?: string) {
  if (key) {
    apiCache.delete(key);
  } else {
    apiCache.clear();
  }
}
