"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Props = Omit<ImageProps, "src" | "alt"> & {
  src: string | null | undefined;
  alt: string;
  /** Shown when there is no source, or the source fails to load. */
  fallbackLabel?: string;
  className?: string;
};

/**
 * `next/image` with a graceful failure path.
 *
 * Remote catalogue photography can disappear (a CDN 404s, an upload is
 * removed). Without this the tile renders as a broken image and the server
 * logs an `upstream image response failed` error on every request. Instead we
 * fall back to a branded monogram tile.
 */
export function SafeImage({ src, alt, fallbackLabel, className, ...props }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        aria-hidden={!fallbackLabel}
        className="absolute inset-0 grid place-items-center bg-secondary"
      >
        <span className="font-display text-3xl text-foreground/20">
          {(fallbackLabel ?? alt ?? "W").charAt(0).toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn(className)}
      {...props}
    />
  );
}
