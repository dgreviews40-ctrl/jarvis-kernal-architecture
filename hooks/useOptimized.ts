/**
 * Optimized React Hooks for JARVIS
 * Features: Memoization, debouncing, and efficient state management
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { optimizer } from '../services/performance';

// ==================== USE DEBOUNCED STATE ====================

export function useDebouncedState<T>(
  initialValue: T,
  delay: number
): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<number | null>(null);

  const setDebouncedState = useCallback((newValue: T) => {
    setValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => {
      setDebouncedValue(newValue);
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, debouncedValue, setDebouncedState];
}

// ==================== USE THROTTLED CALLBACK ====================

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limitMs: number
): T {
  const callbackRef = useRef(callback);
  const throttleRef = useRef<ReturnType<typeof optimizer.throttle> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    throttleRef.current = optimizer.throttle((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, limitMs);
    
    return () => {
      throttleRef.current = null;
    };
  }, [limitMs]);

  return useCallback((...args: Parameters<T>) => {
    throttleRef.current?.(...args);
  }, []) as T;
}

// ==================== USE CACHED MEMO ====================

export function useCachedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  cacheKey: string,
  maxAgeMs: number = 60000
): T {
  const cached = optimizer.get<T>('react', cacheKey, maxAgeMs);
  
  const value = useMemo(() => {
    if (cached !== null) {
      return cached;
    }
    const result = factory();
    optimizer.set('react', cacheKey, result, 100);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

// ==================== USE VIRTUAL LIST ====================

interface VirtualListOptions {
  itemHeight: number;
  overscan?: number;
  containerHeight: number;
}

interface VirtualListResult<T> {
  virtualItems: Array<{ item: T; index: number; style: React.CSSProperties }>;
  totalHeight: number;
  scrollToIndex: (index: number) => void;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions
): VirtualListResult<T> {
  const { itemHeight, overscan = 5, containerHeight } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { virtualItems, totalHeight, startIndex, endIndex } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute',
          top: i * itemHeight,
          height: itemHeight,
          left: 0,
          right: 0,
        } as React.CSSProperties,
      });
    }

    return { virtualItems, totalHeight, startIndex, endIndex };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  const handleScroll = useThrottledCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16); // ~60fps

  const scrollToIndex = useCallback((index: number) => {
    containerRef.current?.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth',
    });
  }, [itemHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll as any);
      return () => container.removeEventListener('scroll', handleScroll as any);
    }
  }, [handleScroll]);

  return { virtualItems, totalHeight, scrollToIndex };
}

// ==================== USE INTERSECTION OBSERVER ====================

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [(node: Element | null) => void, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<Element | null>(null);

  const setNode = useCallback((node: Element | null) => {
    if (nodeRef.current && observerRef.current) {
      observerRef.current.unobserve(nodeRef.current);
    }

    nodeRef.current = node;

    if (node && typeof IntersectionObserver !== 'undefined') {
      observerRef.current = new IntersectionObserver(([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      }, options);
      observerRef.current.observe(node);
    }
  }, [options]);

  useEffect(() => {
    return () => {
      if (observerRef.current && nodeRef.current) {
        observerRef.current.unobserve(nodeRef.current);
      }
    };
  }, []);

  return [setNode, isIntersecting];
}

// ==================== USE LAZY LOAD ====================

export function useLazyLoad<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = []
): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await loaderRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, ...deps]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload: load,
  };
}

// ==================== USE PREVIOUS ====================

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  const prevRef = useRef<T>(undefined);

  useEffect(() => {
    prevRef.current = ref.current;
    ref.current = value;
  }, [value]);

  return prevRef.current;
}

// ==================== USE MEMOIZED CALLBACK ====================

export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useMemo(
    () => ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
}

// ==================== USE RAF STATE ====================

export function useRafState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const rafRef = useRef<number | null>(null);

  const setRafState = useCallback((value: T | ((prev: T) => T)) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setState(value);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return [state, setRafState];
}

// ==================== USE PERFORMANCE MARK ====================

export function usePerformanceMark(markName: string, deps: React.DependencyList = []): void {
  useEffect(() => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${markName}_start`);
      
      return () => {
        performance.mark(`${markName}_end`);
        performance.measure(markName, `${markName}_start`, `${markName}_end`);
      };
    }
  }, [markName, ...deps]);
}
