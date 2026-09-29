"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const DURATION = 1200;
const HIDE_DELAY = 250;

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    setActive(false);
    setWidth(0);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;
      if (href.startsWith("#") || /^[a-z]+:/i.test(href)) return;
      if (href === pathname) return;
      start();
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form || typeof form.getAttribute !== "function") return;
      const action = form.getAttribute("action") ?? "";
      if (action.startsWith("/api/")) return;
      start();
    }

    function start() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setActive(true);
      setWidth(12);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / DURATION, 1);
        setWidth(12 + p * 78);
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else setWidth(96);
      };
      raf.current = requestAnimationFrame(tick);
      hideTimer.current = setTimeout(() => {
        setWidth(100);
        setTimeout(() => {
          setActive(false);
          setWidth(0);
        }, HIDE_DELAY);
      }, DURATION + 400);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [pathname]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-emerald-100"
    >
      <div
        className="h-full rounded-r-full bg-emerald-600 transition-[width] duration-150 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
