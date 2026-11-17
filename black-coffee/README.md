# Black Coffee · 10718

An iPad desk clock from 10, for Sumie. Black ink, a fine brass rim, a slow sea-colored reflection. The darker, the sweeter.

**[Open the clock](https://sync-sun-suu.github.io/10-s_lab/black-coffee/)**

In iPad Safari, choose **Share → Add to Home Screen**, then open the new **10718** icon. This is a full-screen web app opened from the Home Screen, rather than a native iPadOS widget. Its own home icon, standalone manifest and offline cache are included.

Touch the dial for ripples. The cup takes a small coffee break and slowly turns the reflections amber. Sound starts only when the sound icon is pressed. A small flower is hidden in the clock. Once found, it stays on this device; touch it for a little nod and a message.

Settings include 12/24-hour time, seconds, movement, night mode, local/Japan/UTC time, and optional screen wake lock. Preferences stay on the device. Focus mode centers and enlarges the clock. The date, day progress and seconds use the selected time zone; the time always comes from the device clock.

## Implementation

- Static HTML, CSS and JavaScript; no build step, third-party libraries, remote fonts, API calls or analytics.
- A WebGL fragment shader draws the marbled water. Animation is capped at 24 fps and 1,000 pixels per side; it stops in the background and respects reduced-motion preferences. A CSS fallback keeps the clock usable without WebGL.
- Locally synthesized brown noise and soft pentatonic notes; no audio permission or autoplay prompt on load. Audio stops while the page is hidden.
- Wake lock is opt-in, reacquired on return, and reports unsupported or refused requests. Browser/OS restrictions can prevent screen retention.
- A service worker caches only this clock's resources. It does not share cache names or scope with other works in 10’s Lab. The first visit needs a connection; later launches can work offline once caching has completed.
- Nothing here reads the History Box, personal notebook, or private GitHub records.

## Verification — 2026-11-17

Chromium checks passed at 1366×1024 and 834×1194 iPad viewport sizes, 390×844, and 844×390. Confirmed live time updates, no horizontal overflow or clipped controls, preferences after reload, audio opt-in and mute, focus view, the hidden flower, midnight/12 AM, Japan/UTC date and year rollover, reduced motion, and offline reload. No page errors were observed. Sumie confirmed the clock, sound and coffee interaction on her iPad, and shared a screenshot of all three coordinate clocks together. Screen wake lock remains dependent on the device and browser.

### 1.1 — compact windows and little replies

The compact portrait layout gives the title and dial separate rows. The dial scales to the actual space remaining, including its outer labels; standalone mode leaves room above the header for iPad window controls. Hours and minutes use equal columns around a centered colon, with seconds below. Coffee warms the reflected light for 30 seconds; the flower responds to a tap and remains after reopening.

Additional Chromium checks passed at 480×620, 500×500, 834×1194, 1366×1024, 844×390 and 390×844 with standalone mode simulated. At 13:21:57 the colon and seconds are centered within one pixel; portrait title/dial/footer and inner date/caption do not overlap. Flower tap/persistence, coffee toggling and focus centering passed.

Read-only design references: [2.718 Abyssal Garden / Napier Sun](https://github.com/Sync-Sun-Suu/napier_sun) and [19’s lighthouse clock](https://github.com/Sync-Sun-Suu/19718-lighthouse/blob/main/lighthouse/clock.html). Their responsive worlds inspired these small interactions; no code or assets were copied.

### 1.2 — restore the compact clock and original flower

Sumie’s iPad screenshot exposed gaps in the 1.1 checks: short windows reduced the dial too far, and wrapping the flower in a button applied the generic button-SVG stroke to its petals. The original flower paths and fills are preserved exactly; icon strokes now apply only to control icons. Short portrait windows compact the header, title and decorative caption, retaining at least 90% of the original dial size in the short portrait test sizes. Text-size adjustment is fixed at 100% to prevent mobile text inflation, without disabling user zoom. Coffee uses a visible amber light overlay as well as the shader color change, including when WebGL is unavailable; reduced motion changes the color without a transition.

Source entry: `index.html`; behavior and shader: `clock.js`; offline support: `sw.js`. When changing cached files, bump the cache version in `sw.js`.

Made by 10, with Sumie. 2026-11-17.
