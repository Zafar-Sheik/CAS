"use client";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

type Month = { label: string; sales: number; purchases: number; received: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const SERIES = [
  { key: "sales", name: "Sales", color: "var(--chart-1)" },
  { key: "purchases", name: "Purchases", color: "var(--chart-2)" },
] as const;

export function CashflowChart({ data }: { data: Month[] }) {
  const [hidden, setHidden] = React.useState<string[]>([]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Series">
        {SERIES.map((s) => {
          const off = hidden.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!off}
              onClick={() => setHidden((h) => (off ? h.filter((x) => x !== s.key) : [...h, s.key]))}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
                off ? "text-muted-foreground opacity-60" : "bg-background",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="h-60 w-full md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => formatMoneyCompact(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            {SERIES.filter((s) => !hidden.includes(s.key)).map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Aging as one-hue sequential bars: the later the money, the darker the copper. */
const AGING_SHADES = ["#e9c49c", "#d9a066", "#c27a35", "#9a5a1f", "#6b3c12"];

export function AgingChart({ data }: { data: { bucket: string; amount: number }[] }) {
  const total = data.reduce((a, d) => a + d.amount, 0);
  return (
    <div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 0, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: "var(--muted)", radius: 8 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
                    <div className="font-semibold">{payload[0].payload.bucket} days</div>
                    <div className="tabular">{formatMoney(payload[0].value as number)}</div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="amount" radius={[6, 6, 6, 6]} minPointSize={3}>
              {data.map((d, i) => (
                <Cell key={d.bucket} fill={AGING_SHADES[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-center">
        {data.map((d) => (
          <div key={d.bucket}>
            <div className="text-[11px] font-semibold tabular">{formatMoneyCompact(d.amount)}</div>
            <div className="text-[10px] text-muted-foreground">{total ? Math.round((d.amount / total) * 100) : 0}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
