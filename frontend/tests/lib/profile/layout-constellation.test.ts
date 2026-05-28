import { describe, expect, it } from "vitest";
import {
  layoutConstellation,
  type ConstellationSubject,
} from "@/lib/profile/layout-constellation";
import type { MeCompetencePill } from "@/lib/queries/me";

const subj = (id: string, name = `S-${id}`, color = "#000"): ConstellationSubject => ({
  id,
  name,
  color,
});

const pill = (input: {
  pill_id: string;
  subject_id: string;
  competence_estimate?: number;
  n?: number;
}): MeCompetencePill => ({
  pill_id: input.pill_id,
  pill_name: `Pill ${input.pill_id}`,
  subject_id: input.subject_id,
  competence_estimate: input.competence_estimate ?? 5.0,
  band: "working",
  n: input.n ?? 10,
  confidence: "preliminary",
  last_activity_at: null,
  related_pill_ids: [],
  safety_relevant: false,
});

describe("layoutConstellation", () => {
  it("places subject centres on a ring at r = 0.32 around (0.5, 0.5)", () => {
    const subjects = [subj("a"), subj("b"), subj("c"), subj("d")];
    const { subjectCentres } = layoutConstellation([], subjects);
    for (const id of ["a", "b", "c", "d"]) {
      const c = subjectCentres[id];
      if (!c) throw new Error(`missing centre for ${id}`);
      const dx = c.cx - 0.5;
      const dy = c.cy - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      expect(r).toBeCloseTo(0.32, 5);
    }
  });

  it("places pills within 0.06..0.118 of their subject centre (radial band step is 0.012)", () => {
    const subjects = [subj("a")];
    const pills = [
      pill({ pill_id: "p1", subject_id: "a", competence_estimate: 4 }),
      pill({ pill_id: "p2", subject_id: "a", competence_estimate: 6 }),
      pill({ pill_id: "p3", subject_id: "a", competence_estimate: 8 }),
    ];
    const { subjectCentres, positions } = layoutConstellation(pills, subjects);
    const c = subjectCentres.a;
    if (!c) throw new Error("missing subject centre");
    for (const p of pills) {
      const pos = positions[p.pill_id];
      if (!pos) throw new Error(`missing position for ${p.pill_id}`);
      const r = Math.sqrt((pos.x - c.cx) ** 2 + (pos.y - c.cy) ** 2);
      // 0.06 base + up to 4 steps of 0.012 → max 0.108; bake in float slack.
      expect(r).toBeGreaterThanOrEqual(0.06 - 1e-9);
      expect(r).toBeLessThanOrEqual(0.06 + 4 * 0.012 + 1e-9);
    }
  });

  it("is deterministic — same inputs produce the same positions", () => {
    const subjects = [subj("alpha"), subj("beta")];
    const pills = [
      pill({ pill_id: "p1", subject_id: "alpha" }),
      pill({ pill_id: "p2", subject_id: "beta" }),
      pill({ pill_id: "p3", subject_id: "alpha" }),
    ];
    const first = layoutConstellation(pills, subjects);
    const second = layoutConstellation(pills, subjects);
    expect(first.positions).toEqual(second.positions);
    expect(first.subjectCentres).toEqual(second.subjectCentres);
  });

  it("uses subject_id charCode as cluster phase seed (different subject ids → different ring rotation)", () => {
    const subjectA = subj("a");
    const subjectZ = subj("z");
    const pillA = pill({ pill_id: "p1", subject_id: "a" });
    const pillZ = pill({ pill_id: "p1", subject_id: "z" });
    const layoutA = layoutConstellation([pillA], [subjectA]);
    const layoutZ = layoutConstellation([pillZ], [subjectZ]);
    const posA = layoutA.positions.p1;
    const posZ = layoutZ.positions.p1;
    const centreA = layoutA.subjectCentres.a;
    const centreZ = layoutZ.subjectCentres.z;
    if (!posA || !posZ || !centreA || !centreZ) {
      throw new Error("missing position or centre");
    }
    // Same single-pill cluster but different phase seed should yield a
    // different relative position around its cluster centre.
    expect(posA.x - centreA.cx).not.toBeCloseTo(posZ.x - centreZ.cx, 6);
  });

  it("silently skips pills whose subject_id is not in the cluster ring", () => {
    const subjects = [subj("a")];
    const pills = [
      pill({ pill_id: "p1", subject_id: "a" }),
      pill({ pill_id: "p2", subject_id: "ghost" }),
    ];
    const { positions } = layoutConstellation(pills, subjects);
    expect(positions.p1).toBeDefined();
    expect(positions.p2).toBeUndefined();
  });

  it("handles an empty cluster ring without throwing (N falls back to 1)", () => {
    const { subjectCentres, positions } = layoutConstellation([], []);
    expect(subjectCentres).toEqual({});
    expect(positions).toEqual({});
  });
});
