"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Tampilkan spinner hanya pada tombol ini. Default true. */
  active?: boolean;
  /** Jika diisi, tampilkan window.confirm dengan pesan ini sebelum submit. Batal = tidak submit. */
  confirm?: string;
};

const RESET_MS = 4000;

export function SubmitButton({ children, className, active = true, confirm, onClick, ...rest }: Props) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), RESET_MS);
    return () => clearTimeout(t);
  }, [pending]);

  const show = pending && active;

  return (
    <button
      type="submit"
      aria-busy={show}
      className={className}
      onClick={(e) => {
        // Cek konfirmasi DULU sebelum setPending — kalau user batal,
        // preventDefault menghentikan submit dan tombol tetap normal.
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        setPending(true);
        onClick?.(e);
      }}
      {...rest}
    >
      {show ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Memproses…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
