# Operating guide — counterpart-change detector

Read this before first use in a new harness. It covers how to arm the watcher, the
mandatory on-wake protocol, platform-specific comment-read recipes, and each known
limitation with its mitigation.

---

## 1. Arming the watcher

The script (`scripts/watch-counterpart.sh`) is a plain loop that prints a line per change.
It only becomes a *wake* when run under a primitive that turns stdout lines into
notifications. Two common shapes:

### A. Persistent monitor (preferred for an open-ended loop)

Run the script under a long-lived background-notification primitive (e.g. the Monitor tool
with `persistent: true`). Pass config as env on the command line:

```bash
SELF_EXCLUDE='my-review-branch' WATCH_BRANCH='their-branch' \
  WATCH_INCLUDE='review|audit' POLL_SECONDS=90 \
  bash .claude/skills/counterpart-change-detector/scripts/watch-counterpart.sh
```

Each `START` / `MOVED` / `REF` line arrives as a notification. The task runs until killed
or until the harness's runtime cap (see §4) — **`persistent` mode does not exempt you from
the cap.** "Preferred" means *less ceremony per arming*, not *immortal*: empirically a
`persistent:true` monitor was still killed at ~30 min, three times in a row, despite the
primitive's docs claiming no timeout. Plan to re-arm regardless of mode.

**At arm time, do one manual scan** if the counterpart may have branched before you armed:

```bash
git ls-remote origin 'refs/heads/*'   # catch any pre-existing counterpart ref
```

The broad arm baselines whatever exists at `START` and only emits changes *after* that — so
a branch that already exists when you arm is invisible to the loop. The manual scan is the
only thing that catches it.

### B. One-shot "wake me when it first appears"

If you only need the *first* change (e.g. "tell me when the counterpart opens their
branch"), you don't need this script — a single backgrounded `until` poll is simpler and
self-terminates:

```bash
# exits (and notifies once) the moment any non-baseline ref appears
base=$(git ls-remote origin 'refs/heads/*' | grep -Ev 'my-branch' | sort)
until [ -n "$(comm -13 <(echo "$base") <(git ls-remote origin 'refs/heads/*' | grep -Ev 'my-branch' | sort))" ]; do sleep 60; done
```

Use the full skill script when the interaction is a *multi-round* loop.

---

## 2. The on-wake protocol (do this every time — it is the skill)

A `MOVED`/`REF` wake means "a ref changed." It does **not** mean "that's the only thing the
counterpart did," and silence does **not** mean "nothing happened" (comment-only replies
are invisible). So on **every** wake — and before ending any turn where you remain blocked
on the counterpart — run this checklist:

1. **Confirm ground truth.** `git ls-remote origin <ref>` (the watcher's MCP/local view may
   lag). Then `git fetch origin <ref>` and `git log/--diff` the new commits.
2. **Read comments + reviews** via your platform API (§3). The watcher cannot see these;
   the counterpart's protocol may be "reply, no commit."
3. **Verify, don't trust.** Read the cited code/lines yourself before agreeing — never
   write a claim and its verification in the same step.
4. **Filter your own echo.** If the wake was your own push that slipped the filter, ignore.
5. **Act:** respond / defend / fold / fold-in, then (if still looping) ensure the watcher is
   still armed (§4).

> Rule of thumb: **the cheap signal (a commit) and the invisible signal (a reply) need
> different instruments. The watcher is the first; you are the second.**

---

## 3. Platform comment-read recipes

The watcher is git-only and portable. Comment surfaces are platform-specific — pick the one
your harness has. The point is the *step*, not the tool.

- **GitHub via MCP:** `pull_request_read` with `method: get_comments` (PR conversation),
  `get_review_comments` (inline threads), `get_reviews` (review verdicts). Also
  `get_status`/`get_check_runs` for CI if you're babysitting a build.
- **GitHub via CLI:** `gh pr view <n> --comments`; `gh pr checks <n>`.
- **GitLab:** `glab mr notes <n>` / the MR discussions API.
- **No platform API (bare git):** there are no PR comments; the branch *is* the channel.
  The pairing collapses to "diff the branch" — but confirm there's truly no out-of-band
  channel (issue tracker, chat) the counterpart might use instead.

Keep your branch name distinct from the counterpart's so `SELF_EXCLUDE` cleanly separates
the two parties.

---

## 4. Re-arming and the runtime cap

Harness background tasks usually have a **maximum runtime** (commonly ~30 min) and emit a
stop/timeout notification when they hit it. Treat the watcher as having a finite lifetime:

- On a stop/timeout notification, **re-arm immediately** with a fresh invocation. Capture a
  fresh baseline at re-arm (the script does this at `START`).
- A change that lands in the gap between cap-kill and re-arm is not lost — it's simply
  detected on the *next* poll after re-arm, against the fresh baseline. (So re-arm
  promptly; don't leave a long unwatched window.)
- When the loop is genuinely over (e.g. both parties signed off), **stop the task** rather
  than leaving it emitting baseline/timeout noise.

The re-arm obligation lives in your working context, which **does not survive compaction or
a session boundary** — see §7 for how to anchor it so a re-arm isn't silently dropped.

---

## 5. Limitations and mitigations (full)

| Limitation | Why | Mitigation |
|---|---|---|
| **Comment-blind** | Watches refs only; comments/reviews change no SHA. | The §2 on-wake comment read. Non-negotiable — the skill is the pairing, not the loop. |
| **Broad-arm noise → silent death** | The broad arm wakes on *every* ref, not just the counterpart's; only `SELF_EXCLUDE` is removed. A busy repo floods the loop, and a harness may auto-stop a task that "produces too many events" — killing the watcher with no signal. | `WATCH_INCLUDE` positive regex to scope the broad arm to the counterpart's ref space; or run targeted-only once you know the branch. Leave the broad arm unscoped only on a quiet remote / for first-branch discovery. |
| **Pre-existing ref blindness** | The broad-arm baseline is captured at `START`; a counterpart branch that already exists is absorbed and never emitted. | One manual `git ls-remote $REMOTE $REF_GLOB` at arm time (§1.A). The loop reports only post-`START` changes. |
| **Runtime cap (incl. `persistent`)** | Background primitives are time-boxed — and `persistent` mode does **not** exempt you (confirmed: a `persistent:true` monitor capped at ~30 min, three runs in a row, despite "no timeout" in its docs). | §4 re-arm on every stop/timeout; assume finite life regardless of mode. Anchor the re-arm obligation per §7 so compaction doesn't drop it. |
| **Latency** | Up to `POLL_SECONDS` + harness scheduling. | Tune `POLL_SECONDS` down for tighter loops (≥30s for remote rate limits); accept it's not real-time. |
| **Transient remote failure** | `ls-remote` can fail (network/auth blip). | Script guards empty results (skips, never clobbers the baseline). No retry/backoff, so *sustained* failure = silent no-wake — sanity-check liveness if a wake is overdue. |
| **Self-echo** | Your own pushes change refs too. | `SELF_EXCLUDE` regex on your branch name. Coarse (name-based, not author) — keep names distinct. |
| **Branch rename / unknown name** | Targeted arm watches one fixed name. | The broad arm (`comm -13` over all refs) backstops it — that's why both arms exist. |
| **No-op / force-push to a seen SHA** | Edge cases in tip comparison. | Rare; the broad-arm snapshot catches genuine content changes. Verify on wake (§2.3) regardless. |
| **Polling cost** | Frequent `ls-remote` against a busy remote. | Keep `POLL_SECONDS` ≥30; the call is cheap but rate limits exist. |

---

## 6. Worked shape (generic two-party review loop)

1. You open work on `my-branch`; the counterpart will review on a branch whose name you
   don't yet know.
2. **Manual scan first** (`git ls-remote origin 'refs/heads/*'`) — if their branch already
   exists, the loop won't surface it. Then arm broad-only (no `WATCH_BRANCH`),
   `SELF_EXCLUDE='my-branch'`. The first `REF` line for a branch created *after* arming
   reveals the counterpart's branch.
3. Re-arm with `WATCH_BRANCH=<their-branch>` (faster targeted signal) and scope the broad
   arm with `WATCH_INCLUDE` to their ref space — otherwise, in a shared repo, every
   unrelated branch keeps waking you and may get the watcher auto-stopped.
4. On each `MOVED`/`REF`: run the §2 checklist — fetch+diff their commits **and** read their
   PR comments/reviews — then respond.
5. On a timeout notification mid-loop: re-arm (§4). After a compaction or new session:
   re-confirm the watcher is alive and re-establish the protocol (§7).
6. When both sides sign off: stop the task.

This is exactly the loop the skill was abstracted from; nothing in steps 1–6 is
project-specific — every name is a parameter.

---

## 7. Surviving compaction and session boundaries

A long counterpart loop outlives a single context window. Two things can silently break it,
and both are about *where the obligation lives*, not about the script:

- **The watcher is a background task; the discipline is in your context.** The script keeps
  running, but the rules that make it useful — re-arm on cap (§4), pair every wake with a
  comment read (§2) — live in working context that gets **summarized away on compaction.**
  After a compaction you can be left with a still-emitting monitor and no memory that a wake
  obligates a comment read, or that a timeout obligates a re-arm. The watcher firing into a
  context that has forgotten what to do with it is a silent failure.

- **Across a session/container boundary the watcher is gone entirely.** A `persistent`
  monitor dies with its session; nothing carries to the next one. A fresh session must
  re-arm from scratch — and must *know* to.

**Mitigation — anchor the obligation in the durable surface, not in working memory:**

1. **Put the standing rules in the role/system prompt, not just in a turn.** The calling
   role prompt must state, as a standing instruction: *"You are running a counterpart loop
   via the counterpart-change-detector skill. On every wake, do the on-wake pairing. On
   every stop/timeout, re-arm. These hold for the whole session."* A role prompt survives
   compaction; a mid-conversation note does not.
2. **Name the skill by path in that prompt** so a compacted or fresh session can reload
   `SKILL.md` + this guide and recover the full protocol from disk.
3. **On the first action after any compaction or session start, reconcile:** is a watcher
   armed? If not, re-arm (with the §1.A manual scan). Confirm the current baseline against
   `git ls-remote` before trusting silence.

The rule of thumb: **the script is disposable and re-creatable; the obligation to re-arm it
and to pair every wake is the part that must be written somewhere that compaction can't
erase.**
