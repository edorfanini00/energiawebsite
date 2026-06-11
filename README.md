# Energia AI — Marketing Site

A scroll-driven marketing site for Energia AI, inspired by vectrfl.com.
The hero is a 3D isometric commercial building cutaway showing its HVAC
system (rooftop units, cooling tower, chiller plant, duct risers, VAV
zones) with an animated supply-air stream. Scrolling pans the camera
through the building while a 4-step narrative advances.

## Stack

- Plain HTML / CSS / JS (no build step)
- [Three.js](https://threejs.org) (CDN) — 3D scene
- [GSAP ScrollTrigger](https://gsap.com/scrolltrigger/) (CDN) — scroll choreography
- Google Fonts: Archivo (display), Inter (body)

## Run

Any static server works:

```bash
cd energia-ai-website
python3 -m http.server 8080
```

Then open http://localhost:8080
