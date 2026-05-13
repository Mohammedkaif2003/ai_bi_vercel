import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfirmModal from "@/components/ConfirmModal";
import LogoMark from "@/components/LogoMark";
import { useStore } from "@/hooks/useStore";

describe("frontend harness", () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState());
  });

  it("keeps the store defaults and supports common actions", () => {
    const state = useStore.getState();

    expect(state.activeTab).toBe("overview");
    expect(state.pinnedInsights).toEqual([]);

    state.setActiveTab("analyst");
    state.addPinnedInsight({ id: "insight-1", title: "Revenue spike" });
    state.removePinnedInsight("missing");

    expect(useStore.getState().activeTab).toBe("analyst");
    expect(useStore.getState().pinnedInsights).toHaveLength(1);
    expect(useStore.getState().pinnedInsights[0]).toMatchObject({ id: "insight-1" });

    state.setChatSessions((prev) => [...prev, { id: "session-1" } as never]);
    expect(useStore.getState().chatSessions).toHaveLength(1);
  });

  it("renders the LogoMark as an accessible image", () => {
    render(<LogoMark size={48} label="Nexlytics mark" className="brand-mark" />);

    const logo = screen.getByRole("img", { name: /nexlytics mark/i });
    expect(logo).toHaveAttribute("width", "48");
    expect(logo).toHaveClass("brand-mark");
  });

  it("confirms and closes the modal on Enter", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete item"
        message="This cannot be undone."
      />,
    );

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the modal on Escape", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete item"
        message="This cannot be undone."
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});