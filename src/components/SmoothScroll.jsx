import { useEffect } from 'react'
import Lenis from 'lenis'

export default function SmoothScroll({ children }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.075,
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      smoothTouch: false,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      infinite: false,
    })
    window.__lenis = lenis
    return () => {
      lenis.destroy()
      delete window.__lenis
    }
  }, [])

  return children
}
