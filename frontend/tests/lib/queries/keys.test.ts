import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  catalogueQueryKeys,
  pillQueryKeys,
  meQueryKeys,
} from "@/lib/queries";

describe("query-key conventions (FE-3 §B.5)", () => {
  it("catalogue.all is the domain root", () => {
    expect(catalogueQueryKeys.all).toEqual(["catalogue"]);
  });

  it("catalogue.pills nests under all and embeds params", () => {
    expect(catalogueQueryKeys.pills({ subject_id: "X" })).toEqual([
      "catalogue",
      "pills",
      { subject_id: "X" },
    ]);
    expect(catalogueQueryKeys.pills()).toEqual(["catalogue", "pills", {}]);
  });

  it("pill.detail nests under pills domain", () => {
    expect(pillQueryKeys.detail("P")).toEqual(["pills", "P"]);
  });

  it("pill.learningMaterial nests under detail (so invalidating detail covers material)", () => {
    expect(pillQueryKeys.learningMaterial("P")).toEqual([
      "pills",
      "P",
      "learning-material",
    ]);
  });

  it("me keys are domain-prefixed", () => {
    expect(meQueryKeys.competence()).toEqual(["me", "competence"]);
    expect(meQueryKeys.assignments()).toEqual(["me", "assignments"]);
    expect(meQueryKeys.attempts()).toEqual(["me", "attempts"]);
  });

  it("invalidating catalogue.all clears every catalogue cache entry but no other domains", () => {
    const qc = new QueryClient();
    qc.setQueryData(catalogueQueryKeys.pills({ search: "a" }), { ping: 1 });
    qc.setQueryData(catalogueQueryKeys.pills({ search: "b" }), { ping: 2 });
    qc.setQueryData(catalogueQueryKeys.subjects(), { ping: 3 });
    qc.setQueryData(pillQueryKeys.detail("X"), { ping: 4 });

    qc.invalidateQueries({ queryKey: catalogueQueryKeys.all });

    expect(
      qc.getQueryState(catalogueQueryKeys.pills({ search: "a" }))?.isInvalidated,
    ).toBe(true);
    expect(
      qc.getQueryState(catalogueQueryKeys.pills({ search: "b" }))?.isInvalidated,
    ).toBe(true);
    expect(
      qc.getQueryState(catalogueQueryKeys.subjects())?.isInvalidated,
    ).toBe(true);
    expect(qc.getQueryState(pillQueryKeys.detail("X"))?.isInvalidated).toBe(
      false,
    );
  });

  it("invalidating pill.detail(id) clears both detail AND learningMaterial for that pill", () => {
    const qc = new QueryClient();
    qc.setQueryData(pillQueryKeys.detail("X"), { ping: 1 });
    qc.setQueryData(pillQueryKeys.learningMaterial("X"), { ping: 2 });
    qc.setQueryData(pillQueryKeys.detail("Y"), { ping: 3 });

    qc.invalidateQueries({ queryKey: pillQueryKeys.detail("X") });

    expect(qc.getQueryState(pillQueryKeys.detail("X"))?.isInvalidated).toBe(true);
    expect(
      qc.getQueryState(pillQueryKeys.learningMaterial("X"))?.isInvalidated,
    ).toBe(true);
    expect(qc.getQueryState(pillQueryKeys.detail("Y"))?.isInvalidated).toBe(
      false,
    );
  });
});
