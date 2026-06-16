# UI split

This directory contains extracted browser-thread modules from `index.html`.

As of v2.4 the UI split is still transitional:
- `index.html` owns the live workstation behavior.
- the extracted files exist so reviewers can inspect module seams before the full Vite cutover.
- scenario editing, terrain debugging, and the instance manager remain the primary near-term UI surfaces.
