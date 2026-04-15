"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Modal from "./Modal";
import Button from "./Button";

export type ConfirmVariant = "danger" | "default";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Called when the user confirms. Keep async work inside the parent's
   * `startTransition` — ConfirmDialog itself does not manage pending state.
   */
  onConfirm: () => void;
  onCancel: () => void;
  variant?: ConfirmVariant;
  /**
   * When true, confirm/cancel buttons are disabled and the modal cannot
   * be dismissed via Escape/backdrop (prevents double-submit).
   */
  pending?: boolean;
}

/**
 * WAI-ARIA Alert Dialog pattern replacement for `window.confirm()`.
 *
 * - role="alertdialog" + aria-modal + aria-describedby for the description
 * - Modal focus trap (via Modal) ensures Tab stays inside
 * - Escape/backdrop dismiss mapped to `onCancel` unless `pending`
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = "default",
  pending = false,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("Common");
  const reactId = useId();
  const descriptionId = description ? `confirm-desc-${reactId}` : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      disableClose={pending}
      describedById={descriptionId}
    >
      <div className="space-y-5">
        {description && (
          <div
            id={descriptionId}
            className="text-sm text-dq-text-sub"
          >
            {description}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel ?? tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel ?? tCommon("save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
