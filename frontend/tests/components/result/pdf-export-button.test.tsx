/**
 * PdfExportButton state-matrix tests (FE-6 §B.7).
 *
 * The Blob URL synthetic-click pattern is delicate under jsdom — we
 * stub URL.createObjectURL + click + revoke so the test asserts on
 * the sequence of calls, not on a real download.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PdfExportButton } from "@/components/result/pdf-export-button";
import { setAccessToken } from "@/lib/auth/storage";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
  }),
}));

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";

function mountTree(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
}

const createUrlMock = vi.fn(() => "blob:test-url");
const revokeUrlMock = vi.fn();

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  createUrlMock.mockReset();
  createUrlMock.mockReturnValue("blob:test-url");
  revokeUrlMock.mockReset();
  setAccessToken("test-access-token");
  // jsdom's URL polyfill doesn't expose createObjectURL / revokeObjectURL
  // by default — install them as plain assignments before each test so
  // PdfExportButton's Blob → object URL flow works.
  (URL as unknown as { createObjectURL: typeof createUrlMock }).createObjectURL =
    createUrlMock;
  (URL as unknown as { revokeObjectURL: typeof revokeUrlMock }).revokeObjectURL =
    revokeUrlMock;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PdfExportButton · gated", () => {
  it("renders disabled with tooltip when isGated=true", () => {
    render(mountTree(<PdfExportButton attemptId={ATTEMPT_ID} isGated />));
    const btn = screen.getByTestId("pdf-export-button");
    expect(btn.getAttribute("data-state")).toBe("gated");
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });
});

describe("PdfExportButton · happy path", () => {
  it("fetch → blob → object URL → synthetic click → revoke → success toast", async () => {
    const blob = new Blob(["%PDF-1.4\n"], { type: "application/pdf" });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(blob, {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="acumen-attempt-abc.pdf"',
          "Content-Type": "application/pdf",
        },
      }),
    );

    const user = userEvent.setup();
    render(mountTree(<PdfExportButton attemptId={ATTEMPT_ID} isGated={false} />));

    await user.click(screen.getByTestId("pdf-export-button"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await waitFor(() => expect(createUrlMock).toHaveBeenCalled());
    await waitFor(() => expect(revokeUrlMock).toHaveBeenCalledWith("blob:test-url"));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("acumen-attempt-abc.pdf"),
      ),
    );

    // Authorization header attached.
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toEqual({ Authorization: "Bearer test-access-token" });
  });

  it("falls back to attempt-prefix filename when Content-Disposition is absent", async () => {
    const blob = new Blob(["%PDF-1.4\n"], { type: "application/pdf" });
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(blob, { status: 200, headers: { "Content-Type": "application/pdf" } }),
    );

    const user = userEvent.setup();
    render(mountTree(<PdfExportButton attemptId={ATTEMPT_ID} isGated={false} />));
    await user.click(screen.getByTestId("pdf-export-button"));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining(`attempt-${ATTEMPT_ID.slice(0, 5)}.pdf`),
      ),
    );
  });
});

describe("PdfExportButton · error path", () => {
  it("non-OK response → error toast with 'Try again →' action", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "attempt_not_submitted", message: "x" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    render(mountTree(<PdfExportButton attemptId={ATTEMPT_ID} isGated={false} />));
    await user.click(screen.getByTestId("pdf-export-button"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const opts = toastError.mock.calls[0]?.[1] as
      | { action?: { label: string; onClick: () => void } }
      | undefined;
    expect(opts?.action?.label).toBe("Try again →");
    expect(typeof opts?.action?.onClick).toBe("function");
  });
});
