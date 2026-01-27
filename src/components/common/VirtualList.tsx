import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
    items: T[];
    height?: number | string;
    itemHeight?: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    className?: string;
    getItemKey?: (index: number) => number | string;
}

export function VirtualList<T>({
    items,
    height = '400px',
    itemHeight = 64,
    renderItem,
    className = '',
    getItemKey,
}: VirtualListProps<T>) {
    const parentRef = React.useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight,
        overscan: 5,
        getItemKey: getItemKey,
    });

    return (
        <div
            ref={parentRef}
            className={`overflow-auto ${className}`}
            style={{ height }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {renderItem(items[virtualItem.index], virtualItem.index)}
                    </div>
                ))}
            </div>
        </div>
    );
}
