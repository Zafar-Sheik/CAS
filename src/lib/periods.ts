export const PERIODS = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "fy", label: "This tax year" },
  { value: "12m", label: "Last 12 months" },
] as const;

/** SA tax year runs March to February. */
export function periodRange(value: string | undefined, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (value) {
    case "last-month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1), label: "Last month" };
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: new Date(y, q, 1), to: new Date(y, q + 3, 1), label: "This quarter" };
    }
    case "fy": {
      const start = m >= 2 ? new Date(y, 2, 1) : new Date(y - 1, 2, 1);
      return { from: start, to: new Date(start.getFullYear() + 1, 2, 1), label: "This tax year" };
    }
    case "12m":
      return { from: new Date(y, m - 11, 1), to: new Date(y, m + 1, 1), label: "Last 12 months" };
    default:
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), label: "This month" };
  }
}
