import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardActions } from "./CardActions";

Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

describe("CardActions", () => {
  it("renders primary Open link", () => {
    render(<CardActions url="http://example.com" copyItems={[]} />);
    expect(screen.getByRole("link", { name: /Open/ })).toBeDefined();
  });

  it("renders copy buttons and fires onCopy when clicked", async () => {
    const onCopy = vi.fn();
    render(
      <CardActions
        url="http://example.com"
        copyItems={[{ label: "cargo add", text: "cargo add tokio" }]}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByText(/cargo add/));
    expect(onCopy).toHaveBeenCalledWith("cargo add tokio");
  });
});
