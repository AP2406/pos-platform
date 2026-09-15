"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Progressive enhancement: content is visible before JS and after every animation. */
export function SiteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(".surge-site");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || !("IntersectionObserver" in window) || !Element.prototype.animate)
      return;

    const running = new Map<Element, Animation>();
    let observer: IntersectionObserver | undefined;

    function stop() {
      observer?.disconnect();
      running.forEach((animation) => animation.cancel());
      running.clear();
    }

    function start() {
      stop();
      if (preference.matches || !root) return;

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer?.unobserve(entry.target);
            // Never animate a control while someone is interacting with it.
            if (entry.target.contains(document.activeElement)) continue;
            const siblings = Array.from(entry.target.parentElement?.children ?? [])
              .filter((sibling) => sibling.hasAttribute("data-reveal"));
            const delay = Math.min(Math.max(siblings.indexOf(entry.target), 0), 3) * 65;
            const animation = entry.target.animate(
              [
                { opacity: 0.25, translate: "0 20px" },
                { opacity: 1, translate: "0 0" },
              ],
              { duration: 650, delay, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" },
            );
            running.set(entry.target, animation);
            animation.onfinish = () => running.delete(entry.target);
          }
        },
        { threshold: 0, rootMargin: "0px 0px -24px 0px" },
      );

      for (const element of root.querySelectorAll("[data-reveal]")) {
        // Already-visible content, restored scroll positions and anchor targets
        // stay steady. Only new content entering from below receives a reveal.
        if (element.getBoundingClientRect().top >= window.innerHeight)
          observer.observe(element);
      }
    }

    function finishFocused(event: FocusEvent) {
      if (!(event.target instanceof Node)) return;
      for (const [element, animation] of running) {
        if (element.contains(event.target)) {
          animation.cancel();
          running.delete(element);
        }
      }
    }

    start();
    preference.addEventListener("change", start);
    root.addEventListener("focusin", finishFocused as EventListener);
    return () => {
      stop();
      preference.removeEventListener("change", start);
      root.removeEventListener("focusin", finishFocused as EventListener);
    };
  }, [pathname]);

  return <div className="s-scroll-progress" aria-hidden="true" />;
}
