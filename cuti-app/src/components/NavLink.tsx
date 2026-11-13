"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, className, children }: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link href={href} prefetch aria-current={active ? "page" : undefined} className={`app-nav-link ${className}`}>
      {children}
    </Link>
  );
}
