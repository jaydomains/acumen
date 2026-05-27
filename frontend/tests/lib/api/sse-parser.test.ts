/**
 * ``parseSseFrames`` (FE-5 §D.1).
 *
 * Pure function; no network, no fakes. Verifies the WHATWG SSE parsing
 * nuances the adapter relies on: line-ending normalisation, the
 * comment / blank-line / colon-strip rules, ``data:`` concatenation,
 * and chunk-boundary handling (the production case where a single
 * frame straddles two ``TextDecoderStream`` reads).
 */

import { describe, expect, it } from "vitest";
import { parseSseFrames } from "@/lib/api/sse";

describe("parseSseFrames · single complete frame", () => {
  it("parses an ``id`` + ``data`` frame and returns no residual", () => {
    const buf = `id: 2\ndata: {"attempt_position":2}\n\n`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({
      id: "2",
      event: null,
      data: `{"attempt_position":2}`,
    });
    expect(residual).toBe("");
  });

  it("parses an ``event:`` terminal frame", () => {
    const buf = `event: done\ndata: {"completed_positions":[2,3]}\n\n`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({
      id: null,
      event: "done",
      data: `{"completed_positions":[2,3]}`,
    });
    expect(residual).toBe("");
  });
});

describe("parseSseFrames · multiple frames in one chunk", () => {
  it("parses back-to-back frames in arrival order", () => {
    const buf =
      `id: 2\ndata: {"attempt_position":2}\n\n` +
      `id: 3\ndata: {"attempt_position":3}\n\n`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toHaveLength(2);
    expect(frames[0]?.id).toBe("2");
    expect(frames[1]?.id).toBe("3");
    expect(residual).toBe("");
  });
});

describe("parseSseFrames · frame straddling chunk boundary", () => {
  it("returns residual when the second frame is unterminated", () => {
    const buf = `id: 2\ndata: {"attempt_position":2}\n\nid: 3\ndata: {"attemp`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.id).toBe("2");
    expect(residual).toBe(`id: 3\ndata: {"attemp`);
  });

  it("re-feeding ``residual + nextChunk`` completes the deferred frame", () => {
    const first = parseSseFrames(
      `id: 2\ndata: {"attempt_position":2}\n\nid: 3\ndata: {"attemp`,
    );
    const completed = parseSseFrames(first.residual + `t_position":3}\n\n`);
    expect(completed.frames).toHaveLength(1);
    expect(completed.frames[0]?.id).toBe("3");
    expect(completed.frames[0]?.data).toBe(`{"attempt_position":3}`);
    expect(completed.residual).toBe("");
  });

  it("handles a line itself splitting across chunks", () => {
    const first = parseSseFrames(`id: `);
    expect(first.frames).toHaveLength(0);
    expect(first.residual).toBe(`id: `);
    const second = parseSseFrames(first.residual + `2\ndata: {"attempt_position":2}\n\n`);
    expect(second.frames).toHaveLength(1);
    expect(second.frames[0]?.id).toBe("2");
  });
});

describe("parseSseFrames · comment + edge-case lines", () => {
  it("ignores ``:`` comment lines without emitting frames", () => {
    const buf = `: keep-alive\n: ping\n\n`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toEqual([]);
    expect(residual).toBe("");
  });

  it("strips a single leading space after the colon per spec", () => {
    const buf = `id:2\nevent: done\ndata: x\n\n`;
    const { frames } = parseSseFrames(buf);
    expect(frames[0]).toMatchObject({
      // ``id:2`` — no space → value is "2"
      id: "2",
      // ``event: done`` — single space stripped → "done"
      event: "done",
      // ``data: x`` — single space stripped → "x"
      data: "x",
    });
  });

  it("only strips the FIRST leading space, not subsequent ones", () => {
    const buf = `data:  trailing\n\n`;
    const { frames } = parseSseFrames(buf);
    expect(frames[0]?.data).toBe(" trailing");
  });

  it("concatenates multi-line ``data:`` with ``\\n``", () => {
    const buf = `data: line-1\ndata: line-2\n\n`;
    const { frames } = parseSseFrames(buf);
    expect(frames[0]?.data).toBe(`line-1\nline-2`);
  });

  it("ignores unknown fields without emitting frames", () => {
    const buf = `retry: 5000\nfoo: bar\n\n`;
    const { frames } = parseSseFrames(buf);
    expect(frames).toEqual([]);
  });

  it("does not emit empty frames from successive blank lines", () => {
    const buf = `\n\n\n\n`;
    const { frames, residual } = parseSseFrames(buf);
    expect(frames).toEqual([]);
    expect(residual).toBe("");
  });
});

describe("parseSseFrames · line-ending normalisation", () => {
  it("treats CRLF as LF", () => {
    const buf = `id: 2\r\ndata: x\r\n\r\n`;
    const { frames } = parseSseFrames(buf);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ id: "2", data: "x" });
  });

  it("treats bare CR as LF", () => {
    const buf = `id: 2\rdata: x\r\r`;
    const { frames } = parseSseFrames(buf);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ id: "2", data: "x" });
  });
});
