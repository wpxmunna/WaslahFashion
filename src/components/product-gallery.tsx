"use client";
import { SafeImage } from "@/components/safe-image";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type GalleryImage = { id: number; src: string; alt: string };

export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/5] place-items-center bg-muted">
        <span className="font-display text-6xl text-foreground/15">{name.charAt(0)}</span>
      </div>
    );
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

      <div className="relative aspect-[4/5] flex-1 overflow-hidden bg-muted">
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
              "object-cover transition-opacity duration-500",
              i === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}
