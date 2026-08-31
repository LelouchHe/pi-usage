export type TrendBucket = "day" | "week" | "month";

export type UsageQuery =
  | { kind: "default" }
  | { kind: "help" }
  | { kind: "range"; start: number; endExclusive: number; label: string }
  | {
      kind: "trend";
      bucket: TrendBucket;
      start: number;
      endExclusive: number;
    };

const TREND_COMMANDS: Record<
  string,
  { bucket: TrendBucket; defaultCount: number; maxCount: number } | undefined
> = {
  daily: { bucket: "day", defaultCount: 7, maxCount: 365 },
  weekly: { bucket: "week", defaultCount: 8, maxCount: 104 },
  monthly: { bucket: "month", defaultCount: 12, maxCount: 60 },
} as const;

export function parseUsageQuery(args: string, now = new Date()): UsageQuery {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { kind: "default" };
  if (parts[0] === "help" && parts.length === 1) return { kind: "help" };

  if (parts[0] === "range") {
    if (parts.length !== 3)
      throw new Error("Usage: /usage range <YYYY-MM-DD> <YYYY-MM-DD>");
    const range = parseDateRange(parts[1], parts[2]);
    return { kind: "range", ...range, label: `${parts[1]} – ${parts[2]}` };
  }

  const trend = TREND_COMMANDS[parts[0]];
  if (!trend) throw new Error(`Unknown usage command: ${parts[0]}`);

  if (parts.length === 1)
    return countTrend(trend.bucket, trend.defaultCount, now);
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    const count = Number(parts[1]);
    if (count < 1 || count > trend.maxCount) {
      throw new Error(
        `${parts[0]} count must be between 1 and ${trend.maxCount}`,
      );
    }
    return countTrend(trend.bucket, count, now);
  }
  if (parts.length === 3) {
    const range = parseDateRange(parts[1], parts[2]);
    return { kind: "trend", bucket: trend.bucket, ...range };
  }

  throw new Error(
    `Usage: /usage ${parts[0]} [count] or /usage ${parts[0]} <start> <end>`,
  );
}

function countTrend(bucket: TrendBucket, count: number, now: Date): UsageQuery {
  const currentStart = bucketStart(now, bucket);
  const start = new Date(currentStart);
  if (bucket === "day") start.setDate(start.getDate() - (count - 1));
  else if (bucket === "week") start.setDate(start.getDate() - 7 * (count - 1));
  else start.setMonth(start.getMonth() - (count - 1));

  const endExclusive = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  return { kind: "trend", bucket, start: start.getTime(), endExclusive };
}

function parseDateRange(
  startText: string,
  endText: string,
): { start: number; endExclusive: number } {
  const start = parseLocalDate(startText);
  const end = parseLocalDate(endText);
  if (start.getTime() > end.getTime())
    throw new Error("Start date must be before or equal to end date");
  return {
    start: start.getTime(),
    endExclusive: new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate() + 1,
    ).getTime(),
  };
}

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function bucketStart(date: Date, bucket: TrendBucket): number {
  if (bucket === "day")
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
  if (bucket === "month")
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}
