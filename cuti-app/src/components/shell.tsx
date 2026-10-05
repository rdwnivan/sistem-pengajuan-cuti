import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { userDariSesi, isAtasan } from "@/lib/auth";
import { NotificationPermission } from "@/components/NotificationPermission";
import { LogoutButton } from "@/components/LogoutButton";
import { SubmitButton } from "@/components/SubmitButton";

export function Shell({ nama, role, isAtasan, children }: { nama: string; role: string; isAtasan: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 md:max-w-6xl">
      <header className="mb-4 flex items-center justify-between rounded-xl bg-emerald-700 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-bold">Cuti Anime Japan</div>
          <div className="text-xs opacity-80">{nama} · {role === "HR_ADMIN" ? "HR" : "Karyawan"}{isAtasan ? " · Atasan" : ""}</div>
        </div>
        <LogoutButton />
      </header>
      <div className="mb-4">
        <NotificationPermission />
      </div>
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
    { href: "/slip-gaji", label: "Slip Gaji" },
    ...(role !== "HR_ADMIN" && !isAtasan ? [{ href: "/laporan", label: "Laporan" }] : []),
      ...(isAtasan && role !== "HR_ADMIN" ? [{ href: "/persetujuan", label: "Setujui" }, { href: "/kalender", label: "Kalender" }, { href: "/delegasi", label: "Delegasi" }] : []),
      ...(role === "HR_ADMIN" ? [{ href: "/persetujuan", label: "Setujui" }, { href: "/delegasi", label: "Delegasi" }] : []),
    { href: "/notifikasi", label: "Notifikasi" },
    ...(role === "HR_ADMIN" ? [{ href: "/hr", label: "HR" }] : [{ href: "/riwayat", label: "Riwayat" }]),
    { href: "/profil", label: "Profil" },
  ];
  const cls = mobile
    ? "relative shrink-0 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
    : "block rounded-lg px-3 py-2 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 active:bg-emerald-100";
  return (
    <>
      {items.map((i) =>
        i.href === "/persetujuan" ? (
          <Link key={i.href} href={i.href} prefetch className={cls}>
            {i.label}
            <Suspense fallback={<BadgeSkeleton mobile={mobile} />}>
              <PersetujuanBadge mobile={mobile} />
            </Suspense>
          </Link>
        ) : i.href === "/notifikasi" ? (
          <Link key={i.href} href={i.href} prefetch className={cls}>
            {i.label}
            <Suspense fallback={<BadgeSkeleton mobile={mobile} />}>
              <NotifBadge mobile={mobile} />
            </Suspense>
          </Link>
        ) : (
          <Link key={i.href} href={i.href} prefetch className={cls}>{i.label}</Link>
        )
      )}
    </>
  );
}

function BadgeSkeleton({ mobile }: { mobile?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        mobile
          ? "absolute -right-1 -top-1 inline-block h-4 w-4 animate-pulse rounded-full bg-zinc-300"
          : "ml-1.5 inline-block h-4 w-4 animate-pulse rounded-full bg-zinc-300 align-middle"
      }
    />
  );
}

function BadgePill({ mobile, label }: { mobile?: boolean; label: string }) {
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

async function PersetujuanBadge({ mobile }: { mobile?: boolean }) {
  const user = await userDariSesi();
  if (!user) return null;
  let count = 0;
  if (user.role === "HR_ADMIN") {
    const gaji = await prisma.gajiPerubahan.count({ where: { approverId: user.id, status: "MENUNGGU" } });
    count += gaji;
    const cutiHR = await prisma.pengajuan.count({
      where: { status: { in: ["MENUNGGU_HR", "MENUNGGU_ATASAN"] } },
    });
    count += cutiHR;
  }
  if (await isAtasan(user.id)) {
    const cuti = await prisma.pengajuan.count({
      where: { status: "MENUNGGU_ATASAN", OR: [{ pemohon: { atasanId: user.id } }, { approverId: user.id }, { eskalasiKeId: user.id }] },
    });
    const laporan = await prisma.laporanLapangan.count({ where: { status: "MENUNGGU", OR: [{ approverId: user.id }, { pembuat: { atasanId: user.id } }] } });
    count += cuti + laporan;
  }
  if (count === 0) return null;
  return <BadgePill mobile={mobile} label={count > 99 ? "99+" : String(count)} />;
}

async function NotifBadge({ mobile }: { mobile?: boolean }) {
  const user = await userDariSesi();
  if (!user) return null;
  const n = await prisma.notifikasi.count({ where: { userId: user.id, dibaca: false } });
  if (n === 0) return null;
  return <BadgePill mobile={mobile} label={n > 99 ? "99+" : String(n)} />;
}
