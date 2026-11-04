export type SearchParams = Record<string, string | string[] | undefined>;

export function str(sp: SearchParams, key: string) {
  const v = sp[key];
  return typeof v === "string" ? v.slice(0, 100) : undefined;
}

export function pageNum(sp: SearchParams) {
  const n = Number(str(sp, "page") ?? 1);
  return Number.isInteger(n) && n > 0 && n < 10000 ? n : 1;
}

export const PAGE_SIZE = 25;
