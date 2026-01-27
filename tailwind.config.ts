import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        "זהב": "var(--זהב)",
        "זהב-כהה": "var(--זהב-כהה)",
        "זהב-בהיר": "var(--זהב-בהיר)",

        "בורדו": "var(--בורדו)",
        "בורדו-ביניים": "var(--בורדו-ביניים)",
        "בורדו-בהיר": "var(--בורדו-בהיר)",

        "שחור": "var(--שחור)",
        "שחור-רך": "var(--שחור-רך)",

        "לבן": "var(--לבן)",
        "אייבורי": "var(--אייבורי)"
      }
    }
  },
  plugins: []
};

export default config;
