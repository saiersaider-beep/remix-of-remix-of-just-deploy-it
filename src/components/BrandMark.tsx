import { useSiteLogo } from "@/hooks/use-site-logo";

interface BrandMarkProps {
  className?: string;
  size?: number;
  alt?: string;
}

export function BrandMark({ className = "", size = 44, alt = "VinaSound" }: BrandMarkProps) {
  const { logoUrl } = useSiteLogo();
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />

  );
}
