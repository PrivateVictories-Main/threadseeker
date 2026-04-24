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

  it("renders nothing when every pill is empty (sparse-aware)", () => {
    const { container } = render(
      <CardPills popularity={null} language={null} license={null} maintenance="unknown" />,
    );
    // Entire pill row collapses so the card doesn't carry a row of "—"s.
    expect(container.querySelector(".ts-pills")).toBeNull();
  });

  it("skips placeholder pills and only renders real data", () => {
    const { container } = render(
      <CardPills popularity="★ 1k" language={null} license={null} maintenance="unknown" />,
    );
    expect(screen.getByText("★ 1k")).toBeDefined();
    expect(screen.queryByText("—")).toBeNull();
    // Only one pill rendered; row exists but carries a single child.
    const row = container.querySelector(".ts-pills");
    expect(row).not.toBeNull();
    expect(row?.children.length).toBe(1);
  });

  it("drops license pill when value is 'Unknown' bucket", () => {
    render(
      <CardPills popularity="★ 1k" language="Rust" license="Unknown" maintenance="active" />,
    );
    // MIT/Apache/etc render as their raw bucket label; "Unknown" is the
    // licenseBucket fallback for empty/missing licenses and should collapse.
    expect(screen.queryByText("Unknown")).toBeNull();
  });

  it("maintenance variant class applied by state", () => {
    const { container } = render(
      <CardPills popularity="★ 1k" language="Rust" license="MIT" maintenance="abandoned" />
    );
    expect(container.querySelector(".pill-maint-abandoned")).toBeDefined();
  });
});
