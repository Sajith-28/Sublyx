import React from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";

// Mock Background3D since it uses WebGL/React Three Fiber which JSDOM does not support
jest.mock("../components/Background3D", () => ({
  Background3D: () => <div data-testid="mock-background-3d" style={{ pointerEvents: "none" }} />
}));

// Mock Framer Motion to bypass animation timelines but preserve mount/unmount behaviors
jest.mock("framer-motion", () => {
  const React = require("react");
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      div: React.forwardRef(({ children, whileHover, whileTap, transition, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
      button: React.forwardRef(({ children, whileHover, whileTap, transition, ...props }: any, ref: any) => (
        <button ref={ref} {...props}>{children}</button>
      )),
      h2: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <h2 ref={ref} {...props}>{children}</h2>
      )),
      p: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <p ref={ref} {...props}>{children}</p>
      )),
    }
  };
});

// Mock window.location for export testing
const originalLocation = window.location;
delete (window as any).location;
window.location = { ...originalLocation, href: "" } as any;

describe("App State Machine Transitions & Component Lifecycles", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    window.location = originalLocation;
  });

  it("should handle transition upload -> processing -> workspace correctly with mock delays and prevent leaks", async () => {
    // 1. Mock the initial fetch inside RecentJobs on mount
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { container, unmount } = render(<App />);

    // Check we start in the Upload phase
    expect(screen.getByText("AI Video Captions")).toBeInTheDocument();
    expect(screen.queryByText("Generating Captions...")).not.toBeInTheDocument();
    expect(screen.queryByText("Workspace Panel")).not.toBeInTheDocument();

    // 2. Select file to show ConfigPanel
    const file = new File(["dummy video data"], "my_vlog.mp4", { type: "video/mp4" });
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } });
    });

    // Config Panel should appear (showing "Audio Language" label)
    expect(screen.getByText("Audio Language")).toBeInTheDocument();

    // Setup mocks for the post and polling sequence
    const mockJobId = "test-job-id-xyz";
    mockFetch
      // POST /api/jobs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ job_id: mockJobId }),
      })
      // Poll 1 (2s in): Status is processing
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "processing", progress_pct: 40.0 }),
      })
      // Poll 2 (4s in): Status is done
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "done", progress_pct: 100.0 }),
      })
      // Segments load response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "seg-1", index: 0, start_ms: 15500, end_ms: 18000, caption_text: "Let's check the timing controls" }
        ],
      });

    // 3. Trigger generate captions
    const generateBtn = screen.getByText("Generate Captions");
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    // Wait for the POST response to resolve and update local state
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verify it entered processing phase (showing "Generating Captions...")
    expect(screen.getByText("Generating Captions...")).toBeInTheDocument();
    expect(screen.queryByText("AI Video Captions")).not.toBeInTheDocument();

    // 4. Test polling state progression
    // 2s polling delay. Advance timers by 2s to execute the first poll
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Generating Captions...")).toBeInTheDocument();

    // Advance by another 2s to execute the second poll (status done)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Upon status 'done', App schedules a 600ms transition timeout
    // Let's advance by 600ms to allow the workspace transition to trigger
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    // Verify Workspace state is entered
    await waitFor(() => {
      expect(screen.getByText("Workspace Panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Generating Captions...")).not.toBeInTheDocument();

    // 5. Verify cleanup / prevention of memory leaks
    // Spy on clearInterval to verify that unmounting the component properly cancels any pending intervals/timers
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
