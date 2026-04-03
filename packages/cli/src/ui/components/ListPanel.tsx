import { type BoxProps, Text, useInput, useStdout } from 'ink';
import { ScrollView, type ScrollViewRef } from 'ink-scroll-view';
import { useEffect, useRef, useState } from 'react';
import { Panel } from './Panel';

const FALLBACK_TERMINAL_ROWS = 24;
const MIN_VIEWPORT_HEIGHT = 5;

type ListPanelProps<Item> = {
  borderColor?: BoxProps['borderColor'];
  items: Item[];
  minRows: number;
  renderItem: (item: Item, index: number) => React.ReactNode;
  title: string;
  viewportHeight?: number;
};

export function ListPanel<Item>({
  borderColor,
  items,
  minRows,
  renderItem,
  title,
  viewportHeight,
}: ListPanelProps<Item>) {
  const scrollRef = useRef<ScrollViewRef>(null);
  const { stdout } = useStdout();
  const [contentHeight, setContentHeight] = useState(0);
  const [terminalRows, setTerminalRows] = useState(() =>
    getTerminalRows(stdout)
  );
  const calculatedViewportHeight =
    viewportHeight ?? getViewportHeight(terminalRows, minRows);
  const isScrollable = contentHeight > calculatedViewportHeight;

  useEffect(() => {
    const nextRows = getTerminalRows(stdout);
    setTerminalRows(nextRows);

    const handleResize = () => {
      setTerminalRows(getTerminalRows(stdout));
      scrollRef.current?.remeasure();
    };

    stdout?.on('resize', handleResize);

    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  useInput(
    (_input, key) => {
      if (!scrollRef.current) return;

      if (key.upArrow) {
        scrollByClamped(scrollRef, -1);
        return;
      }

      if (key.downArrow) {
        scrollByClamped(scrollRef, 1);
        return;
      }

      if (key.pageUp) {
        scrollByClamped(scrollRef, -scrollRef.current.getViewportHeight());
        return;
      }

      if (key.pageDown) {
        scrollByClamped(scrollRef, scrollRef.current.getViewportHeight());
        return;
      }

      if (key.home) {
        scrollToClamped(scrollRef, 0);
        return;
      }

      if (key.end) {
        scrollToClamped(scrollRef, scrollRef.current.getBottomOffset());
      }
    },
    { isActive: isScrollable }
  );

  return (
    <Panel title={title} borderColor={borderColor}>
      {isScrollable ? (
        <Text color="gray">Scroll: ↑ ↓ PgUp PgDn Home End</Text>
      ) : null}
      <ScrollView
        ref={scrollRef}
        flexDirection="column"
        height={calculatedViewportHeight}
        onContentHeightChange={(height) => {
          setContentHeight(height);
          scrollToClamped(scrollRef, scrollRef.current?.getScrollOffset() ?? 0);
        }}
        onViewportSizeChange={() => {
          scrollToClamped(scrollRef, scrollRef.current?.getScrollOffset() ?? 0);
        }}
      >
        {items.map((item, index) => renderItem(item, index))}
      </ScrollView>
    </Panel>
  );
}

function getViewportHeight(terminalRows: number, minRows: number): number {
  return Math.max(
    MIN_VIEWPORT_HEIGHT,
    Math.min(terminalRows, Math.max(minRows, MIN_VIEWPORT_HEIGHT))
  );
}

function getTerminalRows(
  stdout?: { rows?: number | undefined } | null
): number {
  return stdout?.rows ?? process.stdout.rows ?? FALLBACK_TERMINAL_ROWS;
}

function scrollByClamped(
  scrollRef: React.RefObject<ScrollViewRef | null>,
  delta: number
): void {
  const scrollView = scrollRef.current;
  if (!scrollView) return;

  scrollToClamped(scrollRef, scrollView.getScrollOffset() + delta);
}

function scrollToClamped(
  scrollRef: React.RefObject<ScrollViewRef | null>,
  offset: number
): void {
  const scrollView = scrollRef.current;
  if (!scrollView) return;

  const nextOffset = clamp(offset, 0, scrollView.getBottomOffset());
  scrollView.scrollTo(nextOffset);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
