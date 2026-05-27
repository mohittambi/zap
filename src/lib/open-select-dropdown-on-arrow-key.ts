import type { KeyboardEvent } from "react";

/** Open a custom select dropdown when the user presses ArrowDown or ArrowUp on the trigger. */
export function openSelectDropdownOnArrowKey(
  e: KeyboardEvent,
  setOpen: (open: boolean) => void,
  isOpen = false
): void {
  if (isOpen) return;
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  setOpen(true);
}
