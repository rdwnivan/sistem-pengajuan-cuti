import { LABEL_STATUS } from "@/lib/cuti";

export function Badge({ status }: { status: string }) {
  const s = LABEL_STATUS[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-700 border-zinc-300" };
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function Banner() {
  return (
    <div className="rounded-xl border-2 border-green-600 bg-green-50 p-3 text-center text-sm font-bold text-green-800">
      Cuti baru sah jika berstatus DISETUJUI.
    </div>
  );
}

export function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{msg}</div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none";
export const btnCls = "w-full rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white active:bg-emerald-800";
