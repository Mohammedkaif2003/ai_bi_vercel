import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Sidebar from "@/components/Sidebar";
import { useStore } from "@/hooks/useStore";

describe("Sidebar", () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState());
  });

  it("switches to upload mode and triggers the file picker action", () => {
    const onLoadSelected = vi.fn();
    const onProcessFile = vi.fn();
    const onFileUpload = vi.fn();
    const onNewChat = vi.fn();
    const onLoadSession = vi.fn();
    const onDeleteSession = vi.fn();
    const onRenameSession = vi.fn();
    const onSignOut = vi.fn();

    useStore.setState({
      sidebarCollapsed: false,
      availableDatasets: [
        { key: "sales", label: "Sales Dataset" },
        { key: "finance", label: "Finance Dataset" },
      ],
      dataSource: "preloaded",
      selectedKeys: ["sales"],
      loadingDataset: false,
      datasetError: "",
      datasetPayload: null,
      chatSessions: [],
      activeSessionId: null,
      user: { id: "user-1", display_name: "Analyst One", role: "Pro Analyst" } as never,
    });

    render(
      <Sidebar
        onLoadSelected={onLoadSelected}
        onProcessFile={onProcessFile}
        onFileUpload={onFileUpload}
        onNewChat={onNewChat}
        onLoadSession={onLoadSession}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
        onSignOut={onSignOut}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /upload/i }));
    expect(screen.getByRole("button", { name: /choose csv file/i })).toBeInTheDocument();
  });

  it("loads the selected dataset from the library picker", async () => {
    const onLoadSelected = vi.fn().mockResolvedValue(undefined);

    useStore.setState({
      sidebarCollapsed: false,
      availableDatasets: [
        { key: "sales", label: "Sales Dataset" },
        { key: "finance", label: "Finance Dataset" },
      ],
      dataSource: "preloaded",
      selectedKeys: ["sales"],
      loadingDataset: false,
      datasetError: "",
      datasetPayload: null,
      chatSessions: [],
      activeSessionId: null,
      user: { id: "user-1", display_name: "Analyst One", role: "Pro Analyst" } as never,
    });

    render(
      <Sidebar
        onLoadSelected={onLoadSelected}
        onProcessFile={vi.fn()}
        onFileUpload={vi.fn()}
        onNewChat={vi.fn()}
        onLoadSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onRenameSession={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "finance" } });

    await waitFor(() => {
      expect(onLoadSelected).toHaveBeenCalledWith(["finance"]);
    });
    expect(useStore.getState().selectedKeys).toEqual(["finance"]);
  });
});