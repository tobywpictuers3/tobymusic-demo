import { ASSETS } from "@/brand/assets";

const PageBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
    {/* Full page: pianoflute background */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `url(${ASSETS.hero.pianoFlute})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
      }}
    />

    {/* Overlay: inset with feathered edges */}
    <div
      className="absolute"
      style={{
        inset: "12px",
        borderRadius: "18px",
        maskImage:
          "radial-gradient(ellipse at center, black 85%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 85%, transparent 100%)",
      }}
    >
      {/* Light mode: golden-white overlay */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,248,230,0.85) 0%, rgba(230,182,92,0.85) 100%)",
        }}
      />
      {/* Dark mode: black overlay */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: "rgba(0,0,0,0.85)",
        }}
      />
    </div>
  </div>
);

export default PageBackground;
