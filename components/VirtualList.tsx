/**
 * Virtual List Component
 * Efficiently renders large lists by only rendering visible items
 * Dramatically improves performance for lists with 100+ items
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  itemHeight: number | ((item: T, index: number) => number);
  containerHeight: number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  keyExtractor?: (item: T, index: number) => string;
  emptyComponent?: React.ReactNode;
  headerComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
}

interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  className = '',
  onScroll,
  keyExtractor,
  emptyComponent,
  headerComponent,
  footerComponent
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight;
    }
    
    return items.reduce((sum, item, index) => sum + itemHeight(item, index), 0);
  }, [items, itemHeight]);

  // Get item offset and height (for variable height)
  const getItemMetrics = useCallback((index: number): { offset: number; height: number } => {
    if (typeof itemHeight === 'number') {
      return { offset: index * itemHeight, height: itemHeight };
    }

    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += itemHeight(items[i], i);
    }
    return { offset, height: itemHeight(items[index], index) };
  }, [items, itemHeight]);

  // Calculate visible range
  const visibleRange = useMemo<VisibleRange>(() => {
    if (items.length === 0) return { startIndex: 0, endIndex: -1 };

    let startIndex = 0;
    let endIndex = items.length - 1;

    if (typeof itemHeight === 'number') {
      // Fixed height - simple calculation
      startIndex = Math.floor(scrollTop / itemHeight);
      endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight) - 1;
    } else {
      // Variable height - binary search for start
      let low = 0;
      let high = items.length - 1;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const { offset } = getItemMetrics(mid);
        
        if (offset < scrollTop) {
          startIndex = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // Find end index
      let currentOffset = getItemMetrics(startIndex).offset;
      endIndex = startIndex;
      
      while (endIndex < items.length && currentOffset < scrollTop + containerHeight) {
        currentOffset += itemHeight(items[endIndex], endIndex);
        endIndex++;
      }
      endIndex = Math.min(endIndex, items.length - 1);
    }

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(items.length - 1, endIndex + overscan);

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, items, itemHeight, overscan, getItemMetrics]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Get style for an item
  const getItemStyle = useCallback((index: number): React.CSSProperties => {
    const { offset, height } = getItemMetrics(index);
    return {
      position: 'absolute',
      top: offset,
      left: 0,
      right: 0,
      height: typeof itemHeight === 'number' ? itemHeight : height,
      boxSizing: 'border-box'
    };
  }, [getItemMetrics, itemHeight]);

  // Render visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    const result: React.ReactNode[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      const key = keyExtractor ? keyExtractor(item, i) : `item-${i}`;
      const style = getItemStyle(i);

      result.push(
        <div key={key} style={style} className="virtual-list-item">
          {renderItem(item, i, style)}
        </div>
      );
    }

    return result;
  }, [visibleRange, items, keyExtractor, getItemStyle, renderItem]);

  // Empty state
  if (items.length === 0 && emptyComponent) {
    return (
      <div 
        ref={containerRef}
        className={`virtual-list-empty ${className}`}
        style={{ height: containerHeight, overflow: 'auto' }}
      >
        {emptyComponent}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      {headerComponent}
      
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
      
      {footerComponent}
    </div>
  );
}

/**
 * Optimized virtual list for logs with auto-scroll
 */
interface VirtualLogListProps {
  logs: Array<{
    id: string;
    timestamp: Date;
    message: string;
    type?: string;
    source?: string;
  }>;
  containerHeight: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  autoScroll?: boolean;
}

export const VirtualLogList: React.FC<VirtualLogListProps> = ({
  logs,
  containerHeight,
  className = '',
  onScroll,
  autoScroll = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(autoScroll);
  const [userScrolled, setUserScrolled] = useState(false);

  const itemHeight = 24; // Fixed height for log items

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAutoScrolling && !userScrolled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, isAutoScrolling, userScrolled]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    setUserScrolled(!isAtBottom);
    setIsAutoScrolling(isAtBottom);
    onScroll?.(scrollTop);
  }, [onScroll]);

  const renderLogItem = useCallback((log: typeof logs[0], index: number, style: React.CSSProperties) => {
    const getTypeColor = (type?: string) => {
      switch (type) {
        case 'success': return 'text-green-400';
        case 'error': return 'text-red-400';
        case 'warning': return 'text-yellow-400';
        default: return 'text-cyan-400';
      }
    };

    return (
      <div 
        className="text-xs font-mono py-1 px-2 border-b border-cyan-900/10 flex items-start gap-2"
        style={style}
      >
        <span className="text-cyan-700 shrink-0">
          [{log.timestamp.toLocaleTimeString()}]
        </span>
        <span className={getTypeColor(log.type)}>
          {log.message}
        </span>
      </div>
    );
  }, []);

  return (
    <div className="relative">
      <VirtualList
        items={logs}
        renderItem={renderLogItem}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        className={className}
        onScroll={handleScroll}
        keyExtractor={(log) => log.id}
        overscan={10}
      />
      
      {!isAutoScrolling && logs.length > 0 && (
        <button
          onClick={() => {
            setIsAutoScrolling(true);
            setUserScrolled(false);
          }}
          className="absolute bottom-2 right-2 bg-cyan-900/80 text-cyan-300 text-xs px-2 py-1 rounded hover:bg-cyan-800 transition-colors"
        >
          Resume Auto-scroll
        </button>
      )}
    </div>
  );
};

/**
 * Virtual grid for memory items or other card-based lists
 */
interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  columns: number;
  containerHeight: number;
  gap?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  itemHeight,
  columns,
  containerHeight,
  gap = 16,
  className = '',
  keyExtractor
}: VirtualGridProps<T>): React.ReactElement {
  const rowHeight = itemHeight + gap;
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * rowHeight;

  return (
    <VirtualList
      items={Array.from({ length: totalRows }, (_, i) => i)}
      renderItem={(rowIndex) => {
        const startIdx = rowIndex * columns;
        const rowItems = items.slice(startIdx, startIdx + columns);

        return (
          <div 
            className="virtual-grid-row flex gap-4"
            style={{ height: itemHeight }}
          >
            {rowItems.map((item, colIndex) => {
              const index = startIdx + colIndex;
              return (
                <div 
                  key={keyExtractor ? keyExtractor(item, index) : `grid-${index}`}
                  className="flex-1"
                >
                  {renderItem(item, index)}
                </div>
              );
            })}
          </div>
        );
      }}
      itemHeight={rowHeight}
      containerHeight={containerHeight}
      className={className}
      keyExtractor={(rowIndex) => `row-${rowIndex}`}
    />
  );
}

export default VirtualList;
