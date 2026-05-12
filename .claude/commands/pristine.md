Make this codebase pristine. The single master rule is SIMPLICITY — it outranks cleverness, flexibility, performance micro-optimizations, and your own aesthetic preferences. When two options exist, pick the one a tired reader would understand faster.

Work in this order, and do not move on until the current pass is genuinely done:

1. **Delete first, edit second.** Hunt for dead code: unused functions, unreferenced exports, unreachable branches, commented-out blocks, leftover scaffolding, `TODO`s that have rotted, feature flags whose other side is gone, "just in case" abstractions with one caller. Delete them. If you hesitate, grep for usages — if zero, it goes.

2. **Collapse duplication, but only real duplication.** Three lines that *look* similar but mean different things are not duplication; leave them. Two functions that do the same thing with different names — pick the better name, delete the other. Repeated literal strings/magic numbers used as the same concept → one named constant.

3. **Rename ruthlessly.** Every identifier should answer "what is this?" in one read. Kill abbreviations no one outside this file would recognize. Kill `data`, `info`, `obj`, `tmp`, `handleStuff`, `doProcess`. Booleans read as questions (`isReady`, `hasAccess`). Functions are verbs; values are nouns. Names match the domain language, not the implementation detail.

4. **Flatten.** Early returns over nested `if`s. Guard clauses at the top. One level of indentation is great, two is fine, three is a smell, four means extract or invert. Replace clever ternaries and chained `&&`/`||` with the boring `if` when the boring one reads faster.

5. **Right-size abstractions.** Inline single-use helpers that don't earn their name. Delete wrapper layers that just forward arguments. Delete interfaces with one implementation unless the seam is load-bearing. Premature generality is a bug — concrete code with three duplicates is better than an abstraction with one user and a hypothetical future.

6. **Remove defensive theater.** Strip try/catch blocks that swallow errors silently, null checks for values the type system already guarantees, fallback paths for impossible cases, validation at internal boundaries. Validate at the edges (user input, network, disk) — trust the interior.

7. **Comments earn their place.** Delete any comment that restates the code, narrates history ("added for X"), names callers, or could be a `git blame`. Keep comments that explain *why* something non-obvious is the way it is — a constraint, a workaround for a specific bug, a subtle invariant.

8. **Consistent over clever.** Match the surrounding code's style even if you'd write it differently from scratch. One way to do common things across the codebase.

**Constraints:**
- Do not introduce new dependencies, new files, or new abstractions during this pass. The goal is *less* code, not differently-arranged code.
- Do not "improve" working behavior. Equivalence is the contract — same inputs produce same outputs, same side effects, same errors.
- If you find a real bug, note it separately; don't fold the fix into the cleanup commit.
- After each meaningful chunk, run the build/tests. If they go red, you broke something — revert and retry smaller.

**When you finish, the diff should be mostly red.** If you added more lines than you removed, you misunderstood the assignment — go back to step 1.
