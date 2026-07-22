"use client";
import { SafeImage } from "@/components/safe-image";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  button2Text: string | null;
  button2Link: string | null;
  image: string | null;
  textPosition: "LEFT" | "CENTER" | "RIGHT";
  textColor: string;
  overlayOpacity: number;
};

const AUTOPLAY_MS = 6500;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;

    // Respect users who have asked for less motion — no autoplay for them.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative h-[78vh] min-h-[34rem] w-full overflow-hidden bg-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.id}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {slide.image && (
              <SafeImage
                src={slide.image}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                className={cn(
                  "object-cover transition-transform duration-[7000ms] ease-out",
                  active ? "scale-105" : "scale-100",
                )}
              />
            )}

            {/* Directional scrim keeps the text legible whatever the photo does. */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(${
                  slide.textPosition === "RIGHT" ? "270deg" : "90deg"
                }, rgba(12,10,8,${slide.overlayOpacity + 0.25}) 0%, rgba(12,10,8,${
                  slide.overlayOpacity
                }) 45%, rgba(12,10,8,0.15) 100%)`,
              }}
            />

            <div className="relative mx-auto flex h-full max-w-[1400px] items-center px-4 sm:px-6 lg:px-10">
              <div
                className={cn(
                  "max-w-xl",
                  slide.textPosition === "CENTER" && "mx-auto text-center",
                  slide.textPosition === "RIGHT" && "ml-auto text-right",
                )}
                style={{ color: slide.textColor }}
              >
                {slide.subtitle && (
                  <p
                    className={cn(
                      "flex items-center gap-3 opacity-0",
                      slide.textPosition === "CENTER" && "justify-center",
                      slide.textPosition === "RIGHT" && "justify-end",
                      active && "animate-rise",
                    )}
                    style={{ animationDelay: "120ms" }}
                  >
                    <span className="h-px w-8 bg-[var(--accent)]" />
                    <span className="kicker">{slide.subtitle}</span>
                  </p>
                )}

                <h1
                  className={cn(
                    "display-title mt-5 text-[clamp(2.9rem,8.5vw,6.25rem)] opacity-0",
                    active && "animate-rise",
                  )}
                  style={{ animationDelay: "220ms" }}
                >
                  {slide.title}
                </h1>

                {slide.description && (
                  <p
                    className={cn(
                      "mt-6 max-w-md text-[0.975rem] leading-relaxed opacity-0",
                      slide.textPosition === "CENTER" && "mx-auto",
                      slide.textPosition === "RIGHT" && "ml-auto",
                      active && "animate-rise",
                    )}
                    style={{ animationDelay: "320ms" }}
                  >
                    {slide.description}
                  </p>
                )}

                <div
                  className={cn(
                    "mt-9 flex flex-wrap gap-3 opacity-0",
                    slide.textPosition === "CENTER" && "justify-center",
                    slide.textPosition === "RIGHT" && "justify-end",
                    active && "animate-rise",
                  )}
                  style={{ animationDelay: "420ms" }}
                >
                  {slide.buttonText && slide.buttonLink && (
                    <Link href={slide.buttonLink} className="btn-accent">
                      {slide.buttonText}
                    </Link>
                  )}
                  {slide.button2Text && slide.button2Link && (
                    <Link href={slide.button2Link} className="btn-outline">
                      {slide.button2Text}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}: ${slide.title}`}
              aria-current={i === index}
              className="group py-3"
            >
              <span
                className={cn(
                  "block h-px transition-all duration-500",
                  i === index ? "w-12 bg-white" : "w-6 bg-white/45 group-hover:bg-white/80",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
