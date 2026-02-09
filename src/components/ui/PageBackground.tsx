import { ASSETS } from "@/brand/assets";

/**
 * Global page background:
 * - Top: theme background with a subtle wine/burgundy tint
 * - Bottom: pianoflute image with a fade-in from top
 */
const PageBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
    {/* Wine/burgundy tint at the top */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--wine-main, 355 65% 32%) / 0.12) 0%, transparent 40%)",
      }}
    />

    {/* pianoflute at the bottom with fade-in from top */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${ASSETS.hero.pianoFlute})`,
        backgroundSize: "cover",
        backgroundPosition: "bottom center",
        backgroundRepeat: "no-repeat",
        maskImage: "linear-gradient(to bottom, transparent 30%, black 60%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 30%, black 60%)",
      }}
    />
  </div>
);

export default PageBackground;
