import { createContext, useContext, useEffect, useRef, type PointerEvent, type ReactNode } from "react";

const MIN_COLUMN_WIDTH = 48;
const STORAGE_PREFIX = "bazaar-table-columns:";

// Set by <Table storageKey="..."> so its column headers know where to keep
// the widths the user dragged them to. Without it columns can still be
// resized, the widths just aren't remembered.
const TableStorageContext = createContext<string | undefined>(undefined);

type SavedWidths = Record<string, number>;

function readWidths(storageKey: string): SavedWidths {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as SavedWidths) : {};
  } catch {
    return {};
  }
}

function saveWidth(storageKey: string, columnIndex: number, width: number | null): void {
  try {
    const { [String(columnIndex)]: _previous, ...others } = readWidths(storageKey);
    const next = width === null ? others : { ...others, [columnIndex]: width };
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next));
  } catch {
    // Storage unavailable - the width just won't survive a reload.
  }
}

// width alone is only a hint to the browser's table layout; minWidth is
// what actually lets a column grow past the space the table would give it.
function applyWidth(cell: HTMLTableCellElement, width: number | null): void {
  cell.style.width = width === null ? "" : `${width}px`;
  cell.style.minWidth = width === null ? "" : `${width}px`;
}

export function Table({ children, storageKey }: { children: ReactNode; storageKey?: string }) {
  return (
    <TableStorageContext.Provider value={storageKey}>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">{children}</table>
      </div>
    </TableStorageContext.Provider>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {children}
    </thead>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">{children}</tbody>
  );
}

// Every header cell carries a drag handle on its right edge: drag to make
// the column wider or narrower, double-click to give it back its natural
// width. A column can't be dragged narrower than its content needs.
export function Th({ children }: { children: ReactNode }) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const storageKey = useContext(TableStorageContext);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const cell = cellRef.current;
    if (!cell || !storageKey) return;
    const saved = readWidths(storageKey)[String(cell.cellIndex)];
    if (typeof saved === "number" && saved >= MIN_COLUMN_WIDTH) applyWidth(cell, saved);
  }, [storageKey]);

  function handlePointerDown(e: PointerEvent<HTMLSpanElement>) {
    const cell = cellRef.current;
    if (!cell) return;
    // Keeps the drag from selecting text, and keeps receiving the pointer
    // even when it leaves the thin handle.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: cell.getBoundingClientRect().width };
  }

  function handlePointerMove(e: PointerEvent<HTMLSpanElement>) {
    const cell = cellRef.current;
    if (!cell || !drag.current) return;
    applyWidth(cell, Math.max(MIN_COLUMN_WIDTH, Math.round(drag.current.startWidth + e.clientX - drag.current.startX)));
  }

  function handlePointerUp() {
    const cell = cellRef.current;
    if (!cell || !drag.current) return;
    drag.current = null;
    // Store what the column really ended up at, not what was asked for.
    if (storageKey) saveWidth(storageKey, cell.cellIndex, Math.round(cell.getBoundingClientRect().width));
  }

  function handleReset() {
    const cell = cellRef.current;
    if (!cell) return;
    applyWidth(cell, null);
    if (storageKey) saveWidth(storageKey, cell.cellIndex, null);
  }

  return (
    <th ref={cellRef} className="relative px-4 py-2">
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleReset}
        className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none border-r border-gray-300/70 hover:border-brand-500 dark:border-gray-600/70 hover:bg-brand-500/20 active:border-brand-600 active:bg-brand-500/30"
      />
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-4 py-3 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
