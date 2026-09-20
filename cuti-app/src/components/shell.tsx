import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { userDariSesi } from "@/lib/auth";
import { aksiKeluar } from "@/app/actions";

export function Shell({ nama, role, isAtasan, children }: { nama: string; role: string; isAtasan: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 md:max-w-6xl">
      <header className="mb-4 flex items-center justify-between rounded-xl bg-emerald-700 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-bold">Cuti Anime Japan</div>
          <div className="text-xs opacity-80">{nama} · {role === "HR_ADMIN" ? "HR" : "Karyawan"}{isAtasan ? " · Atasan" : ""}</div>
        </div>
        <form action={aksiKeluar}>
          <button className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold">Keluar</button>
        </form>
      </header>
      <div className="hidden gap-6 md:flex">
        <nav className="w-52 shrink-0 space-y-1">
          <NavLinks role={role} isAtasan={isAtasan} />
        </nav>
        <main className="flex-1 space-y-4">{children}</main>
      </div>
      <main className="space-y-4 md:hidden">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t bg-white px-2 py-2 md:hidden">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto">
          <NavLinks role={role} isAtasan={isAtasan} mobile />
        </div>
      </nav>
    </div>
  );
}

function NavLinks({ role, isAtasan, mobile }: { role: string; isAtasan: boolean; mobile?: boolean }) {
  const items = [
    { href: "/", label: "Beranda" },
    { href: "/cuti/baru", label: "Ajukan" },
    ...(isAtasan || role === "HR_ADMIN" ? [{ href: "/persetujuan", label: "Setujui" }, { href: "/kalender", label: "Kalender" }, { href: "/delegasi", label: "Delegasi" }] : []),
    { href: "/notifikasi", label: "Notifikasi" },
    ...(role === "HR_ADMIN" ? [{ href: "/hr", label: "HR" }] : [{ href: "/riwayat", label: "Riwayat" }]),
    { href: "/profil", label: "Profil" },
  ];
  const cls = mobile
    ? "relative shrink-0 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
    : "block rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50";
  return (
    <>
      {items.map((i) =>
        i.href === "/notifikasi" ? (
          <Link key={i.href} href={i.href} className={cls}>
            {i.label}
            <Suspense fallback={null}>
              <NotifBadge mobile={mobile} />
            </Suspense>
          </Link>
        ) : (
          <Link key={i.href} href={i.href} className={cls}>{i.label}</Link>
        )
      )}
    </>
  );
}

async function NotifBadge({ mobile }: { mobile?: boolean }) {
  const user = await userDariSesi();
  if (!user) return null;
  const n = await prisma.notifikasi.count({ where: { userId: user.id, dibaca: false } });
  if (n === 0) return null;
  const label = n > 99 ? "99+" : String(n);
  return (
    <span
      className={
        mobile
          ? "absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-600 px-1 py-0.5 text-center text-[11px] font-bold leading-none text-white"
          : "ml-1.5 inline-block min-w-[1.25rem] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white"
      }
    >
      {label}
    </span>
  );
}
