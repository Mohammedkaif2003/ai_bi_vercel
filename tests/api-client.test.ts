import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  },
}));

const fetchMock = vi.fn();

describe("api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("adds the bearer token when listing datasets", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ datasets: [] }),
    });

    const { listDatasets } = await import("@/lib/api");
    await listDatasets();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/datasets",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-123" },
      }),
    );
  });

  it("sends report payload fields including dataset key", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "token-456" } } });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ pdf_b64: "abc123" }),
    });

    const { generateReport } = await import("@/lib/api");
    await generateReport(
      [{ query: "Trend analysis" } as never],
      "sales.csv",
      "Analyst",
      "dataset-key-1",
      "Weekly Brief",
      "Summary intro",
      "dark",
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toContain("dataset-key-1");
    expect(options.body).toContain("Weekly Brief");
    expect(options.body).toContain("Summary intro");
  });

  it("encodes files to base64 payloads", async () => {
    const file = new File(["hello world"], "demo.csv", { type: "text/csv" });
    const readerResult = "data:text/csv;base64,aGVsbG8gd29ybGQ=";

    class FakeFileReader {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | ((event: ProgressEvent<FileReader>) => void) = null;
      readAsDataURL() {
        this.result = readerResult;
        this.onload?.();
      }
    }

    const originalFileReader = globalThis.FileReader;
    globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;

    try {
      const { fileToBase64 } = await import("@/lib/api");
      await expect(fileToBase64(file)).resolves.toBe("aGVsbG8gd29ybGQ=");
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });
});