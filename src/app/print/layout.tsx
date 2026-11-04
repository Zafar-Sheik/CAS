import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { PrintToolbar } from "@/components/print/toolbar";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="min-h-dvh bg-neutral-200 py-4 print:bg-white print:py-0 sm:py-8">
      <PrintToolbar />
      <div className="mx-auto w-full max-w-[210mm] overflow-x-auto px-2 sm:px-0 print:max-w-none print:px-0">{children}</div>
    </div>
  );
}
