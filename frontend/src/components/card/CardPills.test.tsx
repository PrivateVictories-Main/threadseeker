import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardPills } from "./CardPills";

describe("CardPills", () => {
  it("renders all four pills when all props provided", () => {
    render(
      <CardPills popularity="★ 45.2k" language="TypeScript" license="MIT" maintenance="active" />
    );
    expect(screen.getByText("★ 45.2k")).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.getByText("MIT")).toBeDefined();
    expect(screen.getByText(/Active/i)).toBeDefined();
  });

  it("renders fallbacks for missing values", () => {
    render(<CardPills popularity={null} language={null} license={null} maintenance="unknown" />);
    // All 3 nullable props fall back to "—"; switched from getByText → getAllByText (3 matches).
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("maintenance variant class applied by state", () => {
    const { container } = render(
      <CardPills popularity="★ 1k" language="Rust" license="MIT" maintenance="abandoned" />
    );
    expect(container.querySelector(".pill-maint-abandoned")).toBeDefined();
  });
});
