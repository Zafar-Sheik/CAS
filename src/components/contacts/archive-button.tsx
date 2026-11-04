"use client";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCustomerActive, setSupplierActive, setItemActive } from "@/server/records";

export function ArchiveButton({ kind, id, active }: { kind: "customer" | "supplier" | "item"; id: string; active: boolean }) {
  const router = useRouter();
  const fn = kind === "customer" ? setCustomerActive : kind === "supplier" ? setSupplierActive : setItemActive;
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        const res = await fn(id, !active);
        if (!res.ok) return toast.error(res.error);
        toast.success(res.message ?? "Done");
        router.refresh();
      }}
    >
      {active ? <Archive /> : <ArchiveRestore />} {active ? "Archive" : "Restore"}
    </Button>
  );
}
