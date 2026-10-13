import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  if (process.env.NODE_ENV === "development") {
    // só pra inspecionar triggers pelo console/automação em dev
    (window as unknown as Record<string, unknown>).__ScrollTrigger = ScrollTrigger;
  }
}

export { gsap, ScrollTrigger };
