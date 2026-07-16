import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Background3D } from "../components/Background3D";

// Mock React Three Fiber Canvas since jsdom does not support WebGL API contexts
jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-r3f-canvas">{children}</div>
  ),
  useFrame: jest.fn(),
}));

jest.mock("@react-three/drei", () => ({
  MeshDistortMaterial: () => <div data-testid="mock-material" />,
  Float: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Three.js Background Overlay Tests", () => {
  it("should verify that the background container applies pointer-events: none", () => {
    const { container } = render(<Background3D />);

    // The container element should be the outer div of Background3D
    const backgroundWrapper = container.firstChild as HTMLElement;
    expect(backgroundWrapper).toBeInTheDocument();

    // Verify Tailwind class "pointer-events-none" is present
    expect(backgroundWrapper).toHaveClass("pointer-events-none");

    // Also assert using inline style calculation to verify pointer-events: none is computed correctly
    const computedStyles = window.getComputedStyle(backgroundWrapper);
    expect(computedStyles.pointerEvents).toBe("none");
  });
});
