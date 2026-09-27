"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Bottom sheet on mobile, right-side panel on larger screens. */
export function Sheet({ open, onOpenChange, trigger, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-lg focus:outline-none",
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl pb-safe",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-xl",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-sunken sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <Dialog.Title className="text-heading font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-ink" aria-label="Stäng">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
