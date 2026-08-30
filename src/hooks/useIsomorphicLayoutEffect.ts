import { useEffect, useLayoutEffect } from "react";

// Avoids the "useLayoutEffect does nothing on the server" warning during SSR
// while still firing synchronously before paint on the client, which GSAP needs.
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
