/**
 * Token discipline (AC-CD23 / FE-2 §C.3 + §D.4). Component and app code
 * must consume design tokens through bare-name Tailwind utilities only —
 * no literal hex values, no arbitrary-value brackets like
 * `className="bg-[#fafafa]"`. The single source of token truth is
 * `app/globals.css`; this test catches drift.
 *
 * Scope: every `.ts` / `.tsx` under `src/components/` and `src/app/`.
 * `globals.css` is the only documented exception and is not a `.ts`/`.tsx`
 * file. There is NO `components/ui/` exclusion: Slice 2's shadcn
 * post-install sweep must remove every literal hex from the vendor source
 * copies. If the sweep misses something, this test fails — by design.
 */

import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOTS = ["src/components", "src/app"];
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const ARBITRARY_HEX_RE =
  /className\s*=\s*(?:"[^"]*\[#[^"]*"|'[^']*\[#[^']*'|`[^`]*\[#[^`]*`|\{[^}]*\[#[^}]*\})/;

async function walk(dir: string): Promise<string[]> {
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

async function collectViolations(re: RegExp): Promise<string[]> {
  const cwd = path.resolve(__dirname, "..", "..");
  const offenders: string[] = [];
  for (const root of ROOTS) {
    const files = await walk(path.join(cwd, root));
    for (const file of files) {
      const text = await fs.readFile(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (re.test(line)) {
          offenders.push(`${path.relative(cwd, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return offenders;
}

describe("token discipline (no literal hex in components / app)", () => {
  it("contains no literal hex values in .ts / .tsx under src/components or src/app", async () => {
    const offenders = await collectViolations(HEX_RE);
    expect(
      offenders,
      `Literal hex values found — route them through design tokens in globals.css:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("contains no arbitrary-value Tailwind hex brackets (e.g. bg-[#fafafa])", async () => {
    const offenders = await collectViolations(ARBITRARY_HEX_RE);
    expect(
      offenders,
      `Arbitrary-value Tailwind hex brackets found — use a token utility instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
