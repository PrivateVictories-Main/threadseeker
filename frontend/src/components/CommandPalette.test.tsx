import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  CommandPalette,
  COMMAND_PALETTE_OPEN_EVENT,
} from "./CommandPalette";

// jsdom implements neither scrollIntoView (the palette calls it on every
// active-index change to keep the highlighted row visible) nor matchMedia
// (framer-motion probes prefers-reduced-motion). Stub both once.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

// RTL's automatic cleanup needs vitest `globals: true` (it registers via a
// global afterEach), which this repo doesn't enable — so clean up explicitly,
// otherwise each test's still-open palette leaks into the next one's queries.
afterEach(cleanup);

// Render with no-op handlers and open via the public custom event — the same
// hook app chrome uses — so tests exercise the real open path, not internals.
function renderOpenPalette() {
  const props = {
    onSearch: vi.fn(),
    onSortChange: vi.fn(),
    onSourceFilterChange: vi.fn(),
    onClearHistory: vi.fn(),
    onResetSources: vi.fn(),
    activeSourceFilter: null,
    sortMode: "relevance" as const,
    selectedSourcesCount: 28,
    totalSourcesCount: 28,
  };
  const view = render(<CommandPalette {...props} />);
  fireEvent(window, new Event(COMMAND_PALETTE_OPEN_EVENT));
  return { ...view, props };
}

describe("CommandPalette a11y wiring (combobox/listbox pattern)", () => {
  it("exposes the input as a combobox that controls the listbox", () => {
    renderOpenPalette();
    const input = screen.getByRole("combobox", { name: "Search commands" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    // aria-controls must reference the actual listbox element's id —
    // a dangling id would silently break the pairing for AT.
    const listbox = screen.getByRole("listbox", { name: "Available commands" });
    expect(listbox.id).not.toBe("");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
  });

  it("gives every option a unique id and tracks the highlight via aria-activedescendant", () => {
    renderOpenPalette();
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    // Unique non-empty ids — these are the aria-activedescendant targets.
    const ids = options.map((o) => o.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // Initial highlight = first option.
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    // ↓ moves both the visual highlight (aria-selected) and the announced
    // active descendant in lockstep, without DOM focus leaving the input.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("keeps listbox→option ownership intact through labelled section groups", () => {
    renderOpenPalette();
    const listbox = screen.getByRole("listbox");
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(listbox.contains(group)).toBe(true);
      // Each group carries the section name (e.g. "Quick searches").
      expect(group.getAttribute("aria-label")).toBeTruthy();
    }
    // Every option lives inside one of the labelled groups — no option is
    // a stray child of an unlabelled wrapper.
    for (const option of screen.getAllByRole("option")) {
      expect(groups.some((g) => g.contains(option))).toBe(true);
    }
  });

  it("narrows to the Search fallback as the sole option when nothing else matches", () => {
    const { props } = renderOpenPalette();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zzz no such command" } });
    // The 'Search for "<query>"' command's label always contains the typed
    // query, so the option list never actually empties for a non-blank
    // filter — the combobox stays expanded with exactly that one option,
    // and the active descendant must follow the shrunken list.
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Search for "zzz no such command"');
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSearch).toHaveBeenCalledWith("zzz no such command");
  });

  it("keeps the keyboard contract: Enter runs the highlighted command, Escape closes", async () => {
    const { props } = renderOpenPalette();
    const input = screen.getByRole("combobox");
    // First visible command with an empty filter is the first Quick search.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onSearch).toHaveBeenCalledWith("mcp server");
    // Enter also closes the palette (AnimatePresence exit is async).
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  });

  it("closes on Escape", async () => {
    renderOpenPalette();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  });

  it("uses theme tokens (not AA-failing slate-400) for hint/secondary text", () => {
    const { container } = renderOpenPalette();
    // slate-400 is 2.9:1 on white — every faint-text surface must run
    // through var(--ts-text-faint) instead (see tokens.css). The substring
    // match also catches variant forms like placeholder:text-slate-400.
    expect(container.querySelector('[class*="text-slate-400"]')).toBeNull();
  });
});
