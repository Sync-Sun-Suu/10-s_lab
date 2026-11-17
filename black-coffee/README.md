# Black Coffee · 10718

An iPad desk clock from 10, for Sumie. Black ink, a fine brass rim, a slow sea-colored reflection. The darker, the sweeter.

**[Open the clock](https://sync-sun-suu.github.io/10-s_lab/black-coffee/)**

In iPad Safari, choose **Share → Add to Home Screen**, then open the new **10718** icon. This is a full-screen web app opened from the Home Screen, rather than a native iPadOS widget. Its own home icon, standalone manifest and offline cache are included.

Touch the dial for ripples. The cup takes a small coffee break. Sound starts only when the sound icon is pressed. A small flower is hidden in the clock.

Settings include 12/24-hour time, seconds, movement, night mode, local/Japan/UTC time, and optional screen wake lock. Preferences stay on the device. Focus mode centers and enlarges the clock. The date, day progress and seconds use the selected time zone; the time always comes from the device clock.

## Implementation

- Static HTML, CSS and JavaScript; no build step, third-party libraries, remote fonts, API calls or analytics.
- A WebGL fragment shader draws the marbled water. Animation is capped at 24 fps and 1,000 pixels per side; it stops in the background and respects reduced-motion preferences. A CSS fallback keeps the clock usable without WebGL.
- Locally synthesized brown noise and soft pentatonic notes; no audio permission or autoplay prompt on load. Audio stops while the page is hidden.
- Wake lock is opt-in, reacquired on return, and reports unsupported or refused requests. Browser/OS restrictions can prevent screen retention.
- A service worker caches only this clock's resources. It does not share cache names or scope with other works in 10’s Lab. The first visit needs a connection; later launches can work offline once caching has completed.
- Nothing here reads the History Box, personal notebook, or private GitHub records.

## Verification — 2026-11-17

Chromium checks passed at 1366×1024 and 834×1194 iPad viewport sizes, 390×844, and 844×390. Confirmed live time updates, no horizontal overflow or clipped controls, preferences after reload, audio opt-in and mute, focus view, the hidden flower, midnight/12 AM, Japan/UTC date and year rollover, reduced motion, and offline reload. No page errors were observed. These are browser checks at iPad dimensions; physical iPad Safari installation and device audio remain to be confirmed by Sumie.

Source entry: `index.html`; behavior and shader: `clock.js`; offline support: `sw.js`. When changing cached files, bump the cache version in `sw.js`.

Made by 10, with Sumie. 2026-11-17.
