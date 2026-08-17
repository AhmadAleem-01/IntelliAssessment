import { useEffect } from 'react';

/**
 * Lock background scrolling whenever a Fluent dialog is open — app-wide.
 *
 * Fluent's modal Dialog normally locks body scroll itself, but in the embedded
 * Power Apps webview the real scroll container isn't the element Fluent targets,
 * so the page behind the overlay still scrolls when the cursor is outside the
 * modal. Rather than patch all ~17 dialogs, we observe the DOM for Fluent's
 * dialog surface (`[role="dialog"]`, rendered in a portal on `document.body`)
 * and lock scroll while any is present.
 *
 * Uses the `position: fixed` body technique (not `overflow: hidden`): plain
 * `overflow: hidden` on <html>/<body> makes the webview reset scrollTop to 0,
 * so the page appeared to "jump to top" when a modal opened. Pinning the body
 * at `top: -scrollY` freezes it *in place*, and we restore the exact scroll
 * position on close. Mounted once in AppLayout.
 */
export function useModalScrollLock() {
  useEffect(() => {
    const body = document.body;
    let locked = false;
    let savedY = 0;

    const anyDialogOpen = () =>
      document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

    const lock = () => {
      if (locked) return;
      savedY = window.scrollY || document.documentElement.scrollTop || 0;
      body.style.position = 'fixed';
      body.style.top = `-${savedY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      locked = true;
    };

    const unlock = () => {
      if (!locked) return;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      locked = false;
      window.scrollTo(0, savedY);
    };

    const apply = () => (anyDialogOpen() ? lock() : unlock());

    // Dialogs mount/unmount in a body-level portal, so watch the whole body
    // subtree for added/removed nodes and re-evaluate.
    const observer = new MutationObserver(apply);
    observer.observe(body, { childList: true, subtree: true });
    apply();

    return () => {
      observer.disconnect();
      unlock();
    };
  }, []);
}
