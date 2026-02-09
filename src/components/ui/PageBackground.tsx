import { ASSETS } from "@/brand/assets";

const PageBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
    {/* Top: wine-burgundy tinted gradient */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(350 40% 18% / 0.25) 0%, transparent 50%)",
      }}
    />

    {/* Bottom: pianoflute with fade-in from top */}
    <div
      className="absolute inset-x-0 bottom-0 h-[55%]"
      style={{
        backgroundImage: `url(${ASSETS.hero.pianoFlute})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
      }}
    />
  </div>
);

export default PageBackground;
