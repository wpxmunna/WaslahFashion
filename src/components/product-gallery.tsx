"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: number; src: string; alt: string };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // Inline hover-zoom (desktop, mouse only).
  const [hovering, setHovering] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/5] place-items-center bg-muted">
        <span className="font-display text-6xl text-foreground/15">{name.charAt(0)}</span>
      </div>
    );
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Product images"
          className="flex gap-3 overflow-x-auto lg:flex-col lg:overflow-visible"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[3/4] w-16 shrink-0 overflow-hidden bg-muted transition-opacity lg:w-20",
                i === active ? "opacity-100 ring-1 ring-foreground" : "opacity-60 hover:opacity-90",
              )}
            >
              <SafeImage src={image.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="group relative flex-1">
        <div
          className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-muted"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={onMove}
          onClick={() => setLightbox(true)}
          role="button"
          tabIndex={0}
          aria-label="Zoom image"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLightbox(true);
            }
          }}
        >
          {images.map((image, i) => (
            <SafeImage
              key={image.id}
              src={image.src}
              alt={i === active ? image.alt : ""}
              aria-hidden={i !== active}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className={cn(
                "object-cover transition-[opacity,transform] duration-300 ease-out",
                i === active ? "opacity-100" : "opacity-0",
              )}
              style={
                i === active && hovering
                  ? { transform: "scale(1.9)", transformOrigin: `${origin.x}% ${origin.y}%` }
                  : undefined
              }
            />
          ))}
        </div>

        {/* Affordance hint */}
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-foreground/70 px-3 py-1.5 text-[0.7rem] font-medium text-background opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-3.5" strokeWidth={2} />
          Tap to zoom
        </span>
      </div>

      {lightbox && (
        <Lightbox
          images={images}
          index={active}
          setIndex={setActive}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  setIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const image = images[index];
  const many = images.length > 1;

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (dir: number) => {
      setIndex((index + dir + images.length) % images.length);
      reset();
    },
    [index, images.length, setIndex, reset],
  );

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)));
      if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard: Esc close, arrows navigate, +/- zoom.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) go(1);
      else if (e.key === "ArrowLeft" && many) go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(0.5);
      else if (e.key === "-") zoomBy(-0.5);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many, onClose, zoomBy]);

  function onPointerDown(e: React.PointerEvent) {
    if (zoom === 1) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  const btn =
    "grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 p-4">
        <span className="text-sm text-white/70 tabular-nums">
          {many ? `${index + 1} / ${images.length}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => zoomBy(-0.5)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" className={btn}>
            <ZoomOut className="size-5" strokeWidth={1.9} />
          </button>
          <button type="button" onClick={() => zoomBy(0.5)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" className={btn}>
            <ZoomIn className="size-5" strokeWidth={1.9} />
          </button>
          <button type="button" onClick={reset} disabled={zoom === 1} aria-label="Reset zoom" className={btn}>
            <RotateCcw className="size-5" strokeWidth={1.9} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className={btn}>
            <X className="size-5" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4"
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 0.3 : -0.3)}
        onDoubleClick={() => (zoom === 1 ? zoomBy(1) : reset())}
      >
        {many && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous image"
            className="absolute left-3 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-6" strokeWidth={1.8} />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution
            zoom/pan view; next/image's fill layout can't be freely transformed
            and would also downscale the detail we want when zoomed. */}
        <img
          src={image.src}
          alt={image.alt}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "max-h-full max-w-full select-none object-contain transition-transform duration-150",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          onClick={() => zoom === 1 && zoomBy(1)}
        />

        {many && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next image"
            className="absolute right-3 z-10 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-6" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {many && (
        <div className="flex justify-center gap-2 overflow-x-auto p-4">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setIndex(i);
                reset();
              }}
              aria-label={`View image ${i + 1}`}
              className={cn(
                "relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded transition-opacity",
                i === index ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
