import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  // "wide" is for modals holding a table rather than a form.
  size?: "default" | "wide";
  // false for modals holding unsaved work a stray click shouldn't throw away.
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

export function Modal({ open, onClose, title, size = "default", closeOnBackdrop = true, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800 ${
          size === "wide" ? "max-w-6xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
