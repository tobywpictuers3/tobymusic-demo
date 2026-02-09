import { ReactNode } from "react";

interface BrandSectionProps {
  backgroundUrl: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a section with a brand background image.
 * Dark mode: full saturation. Light mode: 40% saturation via white overlay.
 */
const BrandSection = ({ backgroundUrl, children, className = "" }: BrandSectionProps) => (
  <div className={`relative overflow-hidden rounded-xl ${className}`}>
    {/* Background image */}
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${backgroundUrl})` }}
    />
    {/* Light mode: white overlay at 60% to reduce saturation to ~40% */}
    <div className="absolute inset-0 bg-white/60 dark:bg-transparent transition-colors" />
    {/* Content */}
    <div className="relative z-10">{children}</div>
  </div>
);

export default BrandSection;
