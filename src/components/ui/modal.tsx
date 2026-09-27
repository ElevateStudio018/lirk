"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ open, onOpenChange, trigger, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl glass-panel p-6 focus:outline-none sm:p-8",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-heading font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 -mt-2 grid size-9 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink" aria-label="Stäng">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
