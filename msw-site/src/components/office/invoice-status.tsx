import { cn } from "@/lib/cn";

export const money = (v: string | number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(v));

export function InvoiceStatus({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[12.5px] font-semibold",
      status === "checked" ? "bg-ok-soft text-ok" : status === "query" ? "bg-danger-soft text-danger" : "bg-info-soft text-info")}>
      {status === "checked" ? "Checked" : status === "query" ? "Query" : "Waiting for check"}
    </span>
  );
}
