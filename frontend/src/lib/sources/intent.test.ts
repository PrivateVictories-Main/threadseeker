import { describe, it, expect } from "vitest";
import { classifyIntent } from "./intent";

describe("classifyIntent", () => {
  it("returns project_search for 'github clone' queries", () => {
    expect(classifyIntent("best github clone tool").intent).toBe("project_search");
  });
  it("returns model_search for 'llama model' queries", () => {
    expect(classifyIntent("llama 3 model").intent).toBe("model_search");
  });
  it("returns troubleshooting for 'error' queries", () => {
    expect(classifyIntent("react hydration error fix").intent).toBe("troubleshooting");
  });
  it("returns how_to for tutorial queries", () => {
    expect(classifyIntent("how to deploy next.js").intent).toBe("how_to");
  });
  it("returns general for plain noun queries", () => {
    expect(classifyIntent("pandas").intent).toBe("general");
  });
  it("returns source weights that sum to ~1.0", () => {
    const { weights } = classifyIntent("redis");
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });
});
