import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "@/components/catalogue/FilterBar";
import { SUBJECT_LIST } from "@/lib/catalogue/subjects";

describe("FilterBar", () => {
  it("renders the All button + one button per supplied subject", () => {
    render(
      <FilterBar
        subjects={[...SUBJECT_LIST]}
        value={{}}
        onChange={vi.fn()}
        searchInput=""
        onSearchInputChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("catalogue-subject-all")).toBeInTheDocument();
    SUBJECT_LIST.forEach((s) => {
      expect(screen.getByTestId(`catalogue-subject-${s.id}`)).toBeInTheDocument();
    });
  });

  it("marks the active subject via data-active=true", () => {
    render(
      <FilterBar
        subjects={[...SUBJECT_LIST]}
        value={{ subject_id: "marine" }}
        onChange={vi.fn()}
        searchInput=""
        onSearchInputChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("catalogue-subject-marine").getAttribute("data-active"),
    ).toBe("true");
    expect(screen.getByTestId("catalogue-subject-all").getAttribute("data-active")).toBe(
      "false",
    );
  });

  it("emits onChange with the subject_id when a subject is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar
        subjects={[...SUBJECT_LIST]}
        value={{}}
        onChange={onChange}
        searchInput=""
        onSearchInputChange={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("catalogue-subject-marine"));
    expect(onChange).toHaveBeenCalledWith({ subject_id: "marine" });
  });

  it("clears subject_id when All is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar
        subjects={[...SUBJECT_LIST]}
        value={{ subject_id: "marine", search: "anti" }}
        onChange={onChange}
        searchInput="anti"
        onSearchInputChange={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId("catalogue-subject-all"));
    // Search is preserved; subject_id is omitted entirely (rest-spread
    // drops the key — it's not present as `undefined`). Matters under
    // `exactOptionalPropertyTypes` and any Object.keys()-based check.
    expect(onChange).toHaveBeenCalledWith({ search: "anti" });
    const arg = onChange.mock.calls[0]![0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(arg, "subject_id")).toBe(false);
  });

  it("echoes search input via onSearchInputChange (no debounce inside FilterBar)", async () => {
    const user = userEvent.setup();
    const onSearchInputChange = vi.fn();
    render(
      <FilterBar
        subjects={[...SUBJECT_LIST]}
        value={{}}
        onChange={vi.fn()}
        searchInput=""
        onSearchInputChange={onSearchInputChange}
      />,
    );
    await user.type(screen.getByTestId("catalogue-search-input"), "ab");
    expect(onSearchInputChange).toHaveBeenCalledTimes(2);
    expect(onSearchInputChange).toHaveBeenLastCalledWith("ab");
  });
});
