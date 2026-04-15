import { describe, it, expect } from "vitest";
import { useRef, useState } from "react";
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * Test harness: a minimal dialog-like component controlled by `isActive`.
 * When active, the focus trap moves focus into the first button and wraps
 * Tab / Shift+Tab. When deactivated, focus returns to the trigger.
 */
function TestDialog({
  initiallyActive = false,
}: {
  initiallyActive?: boolean;
}) {
  const [active, setActive] = useState(initiallyActive);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, active);

  return (
    <div>
      <button
        type="button"
        data-testid="opener"
        onClick={() => setActive(true)}
      >
        open
      </button>
      <button
        type="button"
        data-testid="close"
        onClick={() => setActive(false)}
      >
        close-outside
      </button>
      {active && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          data-testid="dialog"
        >
          <button type="button" data-testid="first">
            first
          </button>
          <button type="button" data-testid="middle">
            middle
          </button>
          <button type="button" data-testid="last">
            last
          </button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to the first tabbable element when activated", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<TestDialog />);

    const opener = getByTestId("opener") as HTMLButtonElement;
    opener.focus();
    expect(document.activeElement).toBe(opener);

    await user.click(opener);

    const first = getByTestId("first");
    expect(document.activeElement).toBe(first);
  });

  it("wraps Tab from the last element back to the first", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<TestDialog initiallyActive />);

    const first = getByTestId("first") as HTMLButtonElement;
    const last = getByTestId("last") as HTMLButtonElement;

    act(() => {
      last.focus();
    });
    expect(document.activeElement).toBe(last);

    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first element back to the last", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<TestDialog initiallyActive />);

    const first = getByTestId("first") as HTMLButtonElement;
    const last = getByTestId("last") as HTMLButtonElement;

    act(() => {
      first.focus();
    });
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it("returns focus to the previously focused element when deactivated", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<TestDialog />);

    const opener = getByTestId("opener") as HTMLButtonElement;
    opener.focus();

    await user.click(opener);

    // Now focus is trapped inside the dialog
    expect(document.activeElement).not.toBe(opener);

    // Close via an outside button (simulates programmatic close).
    // The close button becomes the activeElement first, but the hook
    // restores focus to the previously focused opener.
    const closeOutside = getByTestId("close") as HTMLButtonElement;
    await user.click(closeOutside);

    expect(document.activeElement).toBe(opener);
  });

  it("does not act when isActive=false on mount", () => {
    const { getByTestId } = render(<TestDialog />);
    const opener = getByTestId("opener") as HTMLButtonElement;
    opener.focus();
    // Dialog is not rendered yet; focus stays on opener
    expect(document.activeElement).toBe(opener);
  });
});
