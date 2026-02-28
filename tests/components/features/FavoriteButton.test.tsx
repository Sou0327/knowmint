import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock the server action
const mockToggleFavorite = vi.fn();
vi.mock("@/app/actions/social", () => ({
  toggleFavoriteAction: (...args: unknown[]) => mockToggleFavorite(...args),
}));

import FavoriteButton from "@/components/features/FavoriteButton";

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolves with no error
    mockToggleFavorite.mockResolvedValue({ favorited: true });
  });

  // --- Initial display ---

  it("renders with aria-pressed=true and removeFavorite label when initially favorited", () => {
    render(
      <FavoriteButton itemId="item-1" initialFavorited={true} />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAttribute("aria-label", "removeFavorite");
  });

  it("renders with aria-pressed=false and addFavorite label when initially not favorited", () => {
    render(
      <FavoriteButton itemId="item-1" initialFavorited={false} />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAttribute("aria-label", "addFavorite");
  });

  it("applies h-4 w-4 class to svg when size=sm", () => {
    render(
      <FavoriteButton itemId="item-1" initialFavorited={false} size="sm" />
    );
    const btn = screen.getByRole("button");
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.className).toContain("h-4");
    expect(svg?.className).toContain("w-4");
  });

  it("applies h-5 w-5 class to svg when size=md (default)", () => {
    render(
      <FavoriteButton itemId="item-1" initialFavorited={false} />
    );
    const btn = screen.getByRole("button");
    const svg = btn.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.className).toContain("h-5");
    expect(svg?.className).toContain("w-5");
  });

  // --- Favorite toggle (optimistic) ---

  it("optimistically toggles to favorited on click when not favorited, and calls toggleFavoriteAction", async () => {
    let resolveToggle!: (value: { favorited: boolean }) => void;
    mockToggleFavorite.mockReturnValue(
      new Promise((resolve) => { resolveToggle = resolve; })
    );
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");

    await user.click(btn);

    // Optimistic update: toggled before server response arrives
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(mockToggleFavorite).toHaveBeenCalledWith("item-1");

    // Resolve server response and verify settled state
    resolveToggle({ favorited: true });
    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("optimistically toggles to unfavorited on click when favorited, and calls toggleFavoriteAction", async () => {
    let resolveToggle!: (value: { favorited: boolean }) => void;
    mockToggleFavorite.mockReturnValue(
      new Promise((resolve) => { resolveToggle = resolve; })
    );
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={true} />);

    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");

    await user.click(btn);

    // Optimistic update: toggled before server response arrives
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(mockToggleFavorite).toHaveBeenCalledWith("item-1");

    // Resolve server response and verify settled state
    resolveToggle({ favorited: false });
    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    });
  });

  // --- Server action success ---

  it("stays favorited after server returns { favorited: true }", async () => {
    mockToggleFavorite.mockResolvedValue({ favorited: true });
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("stays unfavorited after server returns { favorited: false }", async () => {
    mockToggleFavorite.mockResolvedValue({ favorited: false });
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={true} />);
    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    });
  });

  // --- Error handling ---

  it("reverts to original state when server returns an error", async () => {
    mockToggleFavorite.mockResolvedValue({ favorited: false, error: "fail" });
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);

    const btn = screen.getByRole("button");
    await user.click(btn);

    // After server error, reverts back to original state (not favorited)
    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("reverts to original state when toggleFavoriteAction throws", async () => {
    mockToggleFavorite.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();

    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);

    const btn = screen.getByRole("button");
    await user.click(btn);

    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    });
  });

  // --- Accessibility ---

  it("has button role", () => {
    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has a non-empty aria-label", () => {
    render(<FavoriteButton itemId="item-1" initialFavorited={false} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toBeTruthy();
  });

  it("has aria-pressed attribute", () => {
    render(<FavoriteButton itemId="item-1" initialFavorited={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed");
  });
});
