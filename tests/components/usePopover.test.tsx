import { describe, it, expect } from "vitest";
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePopover } from "@/hooks/usePopover";

function Popover() {
  const { open, toggle, close, triggerRef, panelRef } = usePopover();
  return (
    <div>
      <button
        type="button"
        ref={triggerRef}
        data-testid="trigger"
        onClick={toggle}
        aria-expanded={open}
      >
        open
      </button>
      <button type="button" data-testid="outside">
        outside
      </button>
      {open && (
        <div ref={panelRef} data-testid="panel" role="menu">
          <button type="button" data-testid="inside" onClick={close}>
            inside
          </button>
        </div>
      )}
    </div>
  );
}

describe("usePopover", () => {
  it("toggles open state on trigger click", async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = render(<Popover />);

    const trigger = getByTestId("trigger");
    expect(queryByTestId("panel")).toBeNull();

    await user.click(trigger);
    expect(getByTestId("panel")).toBeInTheDocument();

    await user.click(trigger);
    expect(queryByTestId("panel")).toBeNull();
  });

  it("closes when clicking outside the panel and trigger", async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = render(<Popover />);

    await user.click(getByTestId("trigger"));
    expect(getByTestId("panel")).toBeInTheDocument();

    await user.click(getByTestId("outside"));
    expect(queryByTestId("panel")).toBeNull();
  });

  it("does not close when clicking inside the panel", async () => {
    const user = userEvent.setup();
    const { getByTestId } = render(<Popover />);

    await user.click(getByTestId("trigger"));

    // Clicking "inside" calls close() explicitly, so we target a non-interactive area.
    // Instead, simulate mousedown inside the panel and ensure it stays open.
    act(() => {
      const panel = getByTestId("panel");
      const mouseDown = new MouseEvent("mousedown", { bubbles: true });
      panel.dispatchEvent(mouseDown);
    });

    expect(getByTestId("panel")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = render(<Popover />);

    const trigger = getByTestId("trigger") as HTMLButtonElement;
    await user.click(trigger);
    expect(getByTestId("panel")).toBeInTheDocument();

    // Move focus somewhere inside the panel first
    const inside = getByTestId("inside") as HTMLButtonElement;
    act(() => {
      inside.focus();
    });
    expect(document.activeElement).toBe(inside);

    await user.keyboard("{Escape}");

    expect(queryByTestId("panel")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("exposes a stable close() callback that dismisses the panel", async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByTestId } = render(<Popover />);

    await user.click(getByTestId("trigger"));
    expect(getByTestId("panel")).toBeInTheDocument();

    await user.click(getByTestId("inside"));
    expect(queryByTestId("panel")).toBeNull();
  });
});
