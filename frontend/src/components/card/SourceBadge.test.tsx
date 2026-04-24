import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceBadge } from "./SourceBadge";

describe("SourceBadge", () => {
  it("renders github label and applies github class", () => {
    const { container } = render(<SourceBadge source="github" />);
    expect(screen.getByText(/GitHub/i)).toBeDefined();
    expect(container.querySelector(".ts-source-github")).toBeDefined();
  });

  it("renders hugging face label", () => {
    render(<SourceBadge source="huggingface" />);
    expect(screen.getByText(/Hugging Face/i)).toBeDefined();
  });

  it("renders arxiv label", () => {
    render(<SourceBadge source="arxiv" />);
    expect(screen.getByText(/arXiv/i)).toBeDefined();
  });
});
