"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-triggered reveal animation for a single element.
 * Fades in + slides up from below.
 */
export function useScrollReveal<T extends HTMLElement>(
  options?: { y?: number; duration?: number; delay?: number; once?: boolean }
) {
  const ref = useRef<T>(null);
  const { y = 40, duration = 0.7, delay = 0, once = true } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, y });

    const tween = gsap.to(el, {
      opacity: 1,
      y: 0,
      duration,
      delay,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: once ? "play none none none" : "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [y, duration, delay, once]);

  return ref;
}

/**
 * Stagger-animate children of a container on scroll.
 */
export function useStaggerReveal<T extends HTMLElement>(
  options?: {
    y?: number;
    duration?: number;
    stagger?: number;
    childSelector?: string;
  }
) {
  const ref = useRef<T>(null);
  const {
    y = 30,
    duration = 0.6,
    stagger = 0.08,
    childSelector = ":scope > *",
  } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = el.querySelectorAll(childSelector);
    if (!children.length) return;

    gsap.set(children, { opacity: 0, y });

    const tween = gsap.to(children, {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [y, duration, stagger, childSelector]);

  return ref;
}

/**
 * Animate a number counting up from 0 to target.
 */
export function useCountUp(
  target: number,
  options?: { duration?: number; delay?: number; enabled?: boolean }
) {
  const ref = useRef<HTMLElement>(null);
  const { duration = 1.2, delay = 0, enabled = true } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const obj = { value: 0 };
    const tween = gsap.to(obj, {
      value: target,
      duration,
      delay,
      ease: "power2.out",
      onUpdate() {
        el.textContent = Math.round(obj.value).toLocaleString();
      },
    });

    return () => {
      tween.kill();
    };
  }, [target, duration, delay, enabled]);

  return ref;
}

/**
 * Hero text split-reveal animation — word by word.
 */
export function useTextReveal<T extends HTMLElement>(
  options?: { duration?: number; stagger?: number; delay?: number }
) {
  const ref = useRef<T>(null);
  const { duration = 0.6, stagger = 0.05, delay = 0.1 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const text = el.textContent || "";
    const words = text.split(" ");

    el.innerHTML = words
      .map(
        (w) =>
          `<span style="display:inline-block;overflow:hidden"><span class="gsap-word" style="display:inline-block">${w}</span></span>`
      )
      .join(" ");

    const wordEls = el.querySelectorAll(".gsap-word");
    gsap.set(wordEls, { y: "110%", opacity: 0 });

    const tween = gsap.to(wordEls, {
      y: "0%",
      opacity: 1,
      duration,
      stagger,
      delay,
      ease: "power3.out",
    });

    return () => {
      tween.kill();
      el.textContent = text;
    };
  }, [duration, stagger, delay]);

  return ref;
}

/**
 * Magnetic hover effect — element subtly follows cursor.
 */
export function useMagneticHover<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    function handleLeave() {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    }

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [strength]);

  return ref;
}

/**
 * Animated progress bar fill on scroll.
 */
export function useProgressFill<T extends HTMLElement>(
  percent: number,
  options?: { duration?: number; delay?: number }
) {
  const ref = useRef<T>(null);
  const { duration = 1, delay = 0 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { width: "0%" });

    const tween = gsap.to(el, {
      width: `${percent}%`,
      duration,
      delay,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 95%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [percent, duration, delay]);

  return ref;
}

/**
 * Parallax float effect on scroll.
 */
export function useParallax<T extends HTMLElement>(speed = 0.5) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tween = gsap.to(el, {
      y: () => speed * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [speed]);

  return ref;
}

/**
 * Scale-pop entrance animation.
 */
export function usePopIn<T extends HTMLElement>(
  options?: { delay?: number; duration?: number }
) {
  const ref = useRef<T>(null);
  const { delay = 0, duration = 0.5 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { scale: 0.8, opacity: 0 });

    const tween = gsap.to(el, {
      scale: 1,
      opacity: 1,
      duration,
      delay,
      ease: "back.out(1.7)",
      scrollTrigger: {
        trigger: el,
        start: "top 92%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, duration]);

  return ref;
}

// Re-export gsap for direct use
export { gsap, ScrollTrigger };
