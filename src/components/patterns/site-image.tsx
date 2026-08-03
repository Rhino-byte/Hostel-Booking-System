"use client";

import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";
import { siteImages, type SiteImageKey } from "@/lib/site-content";

type SiteImageProps = Omit<ImageProps, "src" | "alt"> & {
  imageKey: SiteImageKey;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
};

/**
 * Swap-friendly marketing image. Replace files under public/images/marketing/
 * or update siteImages in site-content.ts — callers keep using imageKey.
 */
export function SiteImage({
  imageKey,
  alt,
  className,
  wrapperClassName,
  fill,
  ...props
}: SiteImageProps) {
  const asset = siteImages[imageKey];

  if (fill) {
    return (
      <div className={cn("relative overflow-hidden", wrapperClassName)}>
        <Image
          src={asset.src}
          alt={alt ?? asset.alt}
          fill
          className={cn("object-cover", className)}
          {...props}
        />
      </div>
    );
  }

  return (
    <Image
      src={asset.src}
      alt={alt ?? asset.alt}
      className={className}
      {...props}
    />
  );
}
