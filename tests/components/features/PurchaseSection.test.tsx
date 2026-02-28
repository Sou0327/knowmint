import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock the server action
const mockRecordPurchase = vi.fn();
vi.mock("@/app/actions/purchase", () => ({
  recordPurchase: (...args: unknown[]) => mockRecordPurchase(...args),
}));

// Mock PurchaseModal to avoid pulling in its complex dependencies.
// The modal catches errors from onPurchaseComplete to prevent unhandled rejections
// (mirroring how the real PurchaseModal handles errors via setError).
vi.mock("@/components/features/PurchaseModal", () => ({
  default: ({
    isOpen,
    onClose,
    onPurchaseComplete,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseComplete: (
      txHash: string,
      chain: string,
      token: string
    ) => Promise<void>;
    [key: string]: unknown;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="purchase-modal">
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-purchase"
          onClick={() => {
            // Real PurchaseModal catches errors via setError — replicate that here
            onPurchaseComplete("tx123", "solana", "SOL").catch((err) => {
              lastPurchaseError = err;
            });
          }}
        >
          Buy
        </button>
      </div>
    );
  },
}));

import { PurchaseSection } from "@/components/features/PurchaseSection";

let lastPurchaseError: unknown = null;

const defaultProps = {
  knowledgeId: "knowledge-uuid-1",
  title: "Test Knowledge",
  priceSol: 0.5,
  priceUsdc: 10,
  sellerWallet: "seller-wallet-address",
  isRequest: false,
};

describe("PurchaseSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastPurchaseError = null;
    mockRecordPurchase.mockResolvedValue({ success: true });
  });

  // --- isRequest=true ---

  it("renders disabled button with 'recruitmentListing' text when isRequest=true", () => {
    render(<PurchaseSection {...defaultProps} isRequest={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("recruitmentListing");
  });

  // --- sellerWallet=null ---

  it("renders disabled button with 'buy' text when sellerWallet is null", () => {
    render(<PurchaseSection {...defaultProps} sellerWallet={null} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("buy");
  });

  // --- Normal state ---

  it("renders an enabled 'buy' button when isRequest=false and sellerWallet is set", () => {
    render(<PurchaseSection {...defaultProps} />);
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent("buy");
  });

  it("opens the modal when the buy button is clicked", async () => {
    const user = userEvent.setup();
    render(<PurchaseSection {...defaultProps} />);

    expect(screen.queryByTestId("purchase-modal")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /buy/i }));

    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();
  });

  it("closes the modal when the close button inside the modal is clicked", async () => {
    const user = userEvent.setup();
    render(<PurchaseSection {...defaultProps} />);

    // Open modal
    await user.click(screen.getByRole("button", { name: /buy/i }));
    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();

    // Close via modal close button
    await user.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("purchase-modal")).not.toBeInTheDocument();
  });

  // --- Purchase success ---

  it("closes the modal after a successful purchase", async () => {
    mockRecordPurchase.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<PurchaseSection {...defaultProps} />);

    // Open modal
    await user.click(screen.getByRole("button", { name: /buy/i }));
    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();

    // Trigger purchase
    await user.click(screen.getByTestId("modal-purchase"));

    await waitFor(() => {
      expect(screen.queryByTestId("purchase-modal")).not.toBeInTheDocument();
    });

    expect(mockRecordPurchase).toHaveBeenCalledWith(
      "knowledge-uuid-1",
      "tx123",
      "solana",
      "SOL",
      true
    );
  });

  // --- Purchase failure ---

  it("throws when recordPurchase returns { success: false, error: 'fail' }", async () => {
    mockRecordPurchase.mockResolvedValue({ success: false, error: "fail" });
    const user = userEvent.setup();

    render(<PurchaseSection {...defaultProps} />);

    // Open modal
    await user.click(screen.getByRole("button", { name: /buy/i }));

    // The modal-purchase button calls onPurchaseComplete which calls handlePurchaseComplete.
    // When recordPurchase fails, handlePurchaseComplete throws — the mock modal's button
    // does NOT catch errors, so it propagates. We verify the modal remains open (no setIsOpen(false)).
    await user.click(screen.getByTestId("modal-purchase"));

    await waitFor(() => {
      // recordPurchase was called with the expected arguments
      expect(mockRecordPurchase).toHaveBeenCalledWith(
        "knowledge-uuid-1",
        "tx123",
        "solana",
        "SOL",
        true
      );
    });

    // Modal remains open because setIsOpen(false) was not reached
    expect(screen.getByTestId("purchase-modal")).toBeInTheDocument();

    // Verify the error was actually propagated to the modal
    await waitFor(() => {
      expect(lastPurchaseError).toBeInstanceOf(Error);
      expect((lastPurchaseError as Error).message).toBe("fail");
    });
  });
});
