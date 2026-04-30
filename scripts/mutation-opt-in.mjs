const mode = process.argv[2] === "full" ? "full" : "smoke";

const nextCommand =
  mode === "full"
    ? "pnpm --filter @mortenbroesby/astrograph mutation:full"
    : "pnpm --filter @mortenbroesby/astrograph mutation:smoke";

process.stdout.write(
  [
    "Mutation testing is intentionally opt-in for astrograph.",
    "It is not part of the normal fast test loop yet.",
    `Run ${nextCommand} when you explicitly want the slower Stryker pass.`,
  ].join("\n") + "\n",
);
