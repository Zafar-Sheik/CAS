import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** South Africa has no daylight saving: SAST is always UTC+2. */
const SAST_MS = 2 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar dates (issue/due dates) are stored as UTC midnight, so read them in UTC. */
export const formatDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${pad(x.getUTCDate())} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

/** Timestamps are shown in Durban time, identically on server and phone. */
export const formatDateTime = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const x = new Date(new Date(d).getTime() + SAST_MS);
  return `${pad(x.getUTCDate())} ${MONTHS[x.getUTCMonth()]}, ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
};

/** yyyy-mm-dd for <input type="date"> */
export const toDateInput = (d: Date | string | null | undefined) => {
  const date = d ? new Date(d) : new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

export function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
