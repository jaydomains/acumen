/**
 * attemptQueryKeys (FE-4 §C.5 + §D.1).
 *
 * Pattern matches FE-3 §B.5 / `pillQueryKeys`. The `inFlight` key is
 * intentionally distinct from `detail()` so invalidating one does not
 * trip the other (the inflight queryFn reads localStorage).
 */

import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { attemptQueryKeys, invalidateAttempt } from "@/lib/queries/attempts";

describe("attemptQueryKeys structure", () => {
  it("all is the domain root", () => {
    expect(attemptQueryKeys.all).toEqual(["attempts"]);
  });

  it("detail / result / inFlight nest under all", () => {
    expect(attemptQueryKeys.detail("A")).toEqual(["attempts", "A"]);
    expect(attemptQueryKeys.result("A")).toEqual(["attempts", "A", "result"]);
    expect(attemptQueryKeys.inFlight()).toEqual(["attempts", "__inflight"]);
  });

  it("detail(<uuid>) cannot collide with inFlight — `__inflight` is not a UUID", () => {
    // UUIDs match /^[0-9a-f-]+$/i; the leading underscore in the
    // inFlight tag is the safety net against accidental routing of
    // `["attempts", "__inflight"]` through detail().
    expect(attemptQueryKeys.detail("11111111-1111-1111-1111-111111111111")[1]).not.toBe(
      "__inflight",
    );
  });
});

describe("invalidateAttempt", () => {
  it("invalidates detail(id) which prefix-covers result(id)", () => {
    const qc = new QueryClient();
    qc.setQueryData(attemptQueryKeys.detail("X"), { ping: 1 });
    qc.setQueryData(attemptQueryKeys.result("X"), { ping: 2 });
    qc.setQueryData(attemptQueryKeys.detail("Y"), { ping: 3 });

    invalidateAttempt(qc, "X");

    expect(qc.getQueryState(attemptQueryKeys.detail("X"))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(attemptQueryKeys.result("X"))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(attemptQueryKeys.detail("Y"))?.isInvalidated).toBe(false);
  });
});
