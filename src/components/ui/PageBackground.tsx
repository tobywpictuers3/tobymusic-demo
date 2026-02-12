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

    {/* Full page: pianoflute — no fade, sharp cut */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${ASSETS.hero.pianoFlute})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
    />
  </div>
);

export default PageBackground;
