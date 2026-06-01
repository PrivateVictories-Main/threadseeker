import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CardActions } from "./CardActions";

const writeText = vi.fn(() => Promise.resolve());
Object.assign(navigator, { clipboard: { writeText } });

beforeEach(() => writeText.mockReset().mockResolvedValue(undefined));

describe("CardActions", () => {
  it("renders primary Open link", () => {
    render(<CardActions url="http://example.com" copyItems={[]} />);
    expect(screen.getByRole("link", { name: /Open/ })).toBeDefined();
  });

  it("renders copy buttons and fires onCopy only after the clipboard write resolves", async () => {
    const onCopy = vi.fn();
    render(
      <CardActions
        url="http://example.com"
        copyItems={[{ label: "cargo add", text: "cargo add tokio" }]}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByText(/cargo add/));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("cargo add tokio"));
    // Inline success state replaces the label.
    await waitFor(() => expect(screen.getByText(/Copied/)).toBeDefined());
  });

  it("does NOT fire a false-success onCopy when the clipboard write rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    const onCopy = vi.fn();
    render(
      <CardActions
        url="http://example.com"
        copyItems={[{ label: "npm i", text: "npm i tokio" }]}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByText(/npm i/));
    await waitFor(() => expect(screen.getByText(/Couldn’t copy|Couldn't copy/)).toBeDefined());
    expect(onCopy).not.toHaveBeenCalled();
  });
});
