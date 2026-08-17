import { useEffect, useState } from 'react';

/**
 * True once the window has scrolled past `threshold` pixels. Shared by the
 * floating FABs (back-to-top, application-details jump) so they appear/hide in
 * sync. Watches the window scroller (the app's real scroll container).
 */
export function useScrolledPast(threshold = 400): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setPast(y > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return past;
}
