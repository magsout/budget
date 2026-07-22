/** True when running as an installed PWA (home-screen / standalone window). */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes navigator.standalone when launched from the home screen.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
