import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyze = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/api", () => ({
  analyze: mockAnalyze,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  },
}));

describe("useChat", () => {
  const buildQueryChain = () => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn();
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.range = vi.fn(() => Promise.resolve({ data: [] }));
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    return chain;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockAnalyze.mockResolvedValue({
      narration: "Revenue increased.",
      summary: "Revenue increased.",
      result: [{ label: "Revenue", value: 100 }],
      chart: { kind: "bar" },
      query_type: "analysis",
    });
  });

  it("creates a session, saves messages, and returns analysis results", async () => {
    const newSession = { id: "session-1", title: "Revenue review" };
    const chatSessionsChain = buildQueryChain();
    const chatMessagesChain = buildQueryChain();
    mockFrom.mockImplementation((table: string) => {
      if (table === "chat_sessions") {
        chatSessionsChain.single = vi.fn().mockResolvedValue({ data: newSession, error: null });
        return chatSessionsChain;
      }
      if (table === "chat_messages") {
        return chatMessagesChain;
      }
      return buildQueryChain();
    });

    const { useChat } = await import("@/hooks/useChat");
    const onSessionCreated = vi.fn();

    const { result } = renderHook(() =>
      useChat({
        user: { id: "user-1" } as never,
        datasetKey: "dataset-1",
        datasetName: "sales.csv",
        onSessionCreated,
      }),
    );

    await act(async () => {
      await result.current.sendMessage("Show revenue trend");
    });

    await waitFor(() => {
      expect(onSessionCreated).toHaveBeenCalledWith(newSession);
    });

    expect(mockAnalyze).toHaveBeenCalledWith("Show revenue trend", "dataset-1", "sales.csv");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "Show revenue trend" });
    expect(result.current.messages[1]).toMatchObject({ role: "assistant", content: "Revenue increased." });
  });

  it("ignores empty chat submissions", async () => {
    mockFrom.mockReturnValue(buildQueryChain());

    const { useChat } = await import("@/hooks/useChat");
    const { result } = renderHook(() =>
      useChat({
        user: { id: "user-1" } as never,
        datasetKey: "dataset-1",
      }),
    );

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});