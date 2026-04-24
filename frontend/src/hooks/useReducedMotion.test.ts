import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReducedMotion } from "./useReducedMotion";

describe("useReducedMotion", () => {
  it("returns true when prefers-reduced-motion is reduce", () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false otherwise", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
