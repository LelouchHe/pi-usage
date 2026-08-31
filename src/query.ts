export type TrendBucket = "day" | "week" | "month";

export type UsageQuery =
  | { kind: "session" }
  | { kind: "help" }
  | { kind: "show"; paths: string[] }
  | {
      kind: "summary";
      start: number | null;
      endExclusive: number | null;
      label: string;
    }
  | {
      kind: "trend";
      bucket: TrendBucket;
      start: number;
      endExclusive: number;
    };

const BUCKETS: Record<string, TrendBucket | undefined> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};
const MAX_TREND_BUCKETS = 366;

export function parseUsageQuery(args: string, now = new Date()): UsageQuery {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { kind: "session" };
  if (parts[0] === "help" && parts.length === 1) return { kind: "help" };
  if (parts[0] === "show") {
    if (parts.length < 2)
      throw new Error("Usage: /usage show <path> [path...]");
    return { kind: "show", paths: parts.slice(1) };
  }

  const bucket = BUCKETS[parts[0]];
  if (bucket) {
    if (parts.length === 1) throw new Error(`${parts[0]} requires a range`);
    const range = parseRange(parts.slice(1), now);
    if (range.start === null || range.endExclusive === null) {
      throw new Error(`${parts[0]} does not support an unbounded range`);
    }
    if (
      countBuckets(range.start, range.endExclusive, bucket) > MAX_TREND_BUCKETS
    ) {
      throw new Error(
        `Trend output cannot exceed ${MAX_TREND_BUCKETS} buckets`,
      );
    }
    return {
      kind: "trend",
      bucket,
      start: range.start,
      endExclusive: range.endExclusive,
    };
  }

  const rangeParts = parts[0] === "range" ? parts.slice(1) : parts;
  const range = parseRange(rangeParts, now);
  return { kind: "summary", ...range };
}

function parseRange(
  parts: string[],
  now: Date,
): { start: number | null; endExclusive: number | null; label: string } {
  if (parts.length === 1 && parts[0] === "today") {
    return {
      start: dayStart(now),
      endExclusive: nextDay(now),
      label: "Today",
    };
  }
  if (parts.length === 1 && parts[0] === "all") {
    return { start: null, endExclusive: null, label: "All time" };
  }
  if (parts.length === 1) return durationRange(parts[0], now);
  if (parts.length === 2) {
    const start = parseLocalDate(parts[0]);
    const end = parseLocalDate(parts[1]);
    if (start.getTime() > end.getTime()) {
      throw new Error("Start date must be before or equal to end date");
    }
    return {
      start: start.getTime(),
      endExclusive: nextDay(end),
      label: `${parts[0]} – ${parts[1]}`,
    };
  }
  throw new Error("Unknown usage range");
}

function durationRange(
  value: string,
  now: Date,
): { start: number; endExclusive: number; label: string } {
  const match = /^(\d+)([dwm])$/.exec(value);
  if (!match) throw new Error(`Unknown usage range: ${value}`);
  const count = Number(match[1]);
  if (!Number.isSafeInteger(count) || count <= 0)
    throw new Error("Range count must be positive");
  const unit = match[2];
  const start = new Date(
    bucketStart(now, unit === "d" ? "day" : unit === "w" ? "week" : "month"),
  );
  if (unit === "d") start.setDate(start.getDate() - (count - 1));
  else if (unit === "w") start.setDate(start.getDate() - 7 * (count - 1));
  else start.setMonth(start.getMonth() - (count - 1));
  return { start: start.getTime(), endExclusive: nextDay(now), label: value };
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

function countBuckets(
  start: number,
  endExclusive: number,
  bucket: TrendBucket,
): number {
  let count = 0;
  let cursor = bucketStart(new Date(start), bucket);
  while (cursor < endExclusive && count <= MAX_TREND_BUCKETS) {
    const date = new Date(cursor);
    if (bucket === "day") date.setDate(date.getDate() + 1);
    else if (bucket === "week") date.setDate(date.getDate() + 7);
    else date.setMonth(date.getMonth() + 1);
    cursor = date.getTime();
    count += 1;
  }
  return count;
}

function dayStart(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function nextDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
}

export function bucketStart(date: Date, bucket: TrendBucket): number {
  if (bucket === "day") return dayStart(date);
  if (bucket === "month")
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}
