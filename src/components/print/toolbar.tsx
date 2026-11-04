"use client";
import { ArrowLeft, Printer } from "lucide-react";

export function PrintToolbar() {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-2 sm:px-0">
      <button onClick={() => (history.length > 1 ? history.back() : window.close())} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm">
        <ArrowLeft className="size-4" /> Back
      </button>
      <button onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#171715] px-4 text-sm font-medium text-white shadow-sm">
        <Printer className="size-4" /> Print / Save PDF
      </button>
    </div>
  );
}
