# Waterblob Garden

An interactive 3D web experience featuring a jiggly water blob that travels along smooth, random paths, leaving a trail of fantastical, colorful plants in its wake.

## Features

- **Jiggly Water Blob**: A translucent blue blob with realistic jiggle physics
- **Smooth Random Paths**: The blob follows smooth, curved paths using Catmull-Rom splines
- **5 Unique Plant Types**:
  - **Spiral Bloom**: Orange/pink petals arranged in a spiral pattern
  - **Crystal Frond**: Cyan/violet spherical segments stacked vertically
  - **Bubble Cluster**: Magenta/turquoise bubble-like spheres
  - **Plasma Tendril**: Orange/hot pink curved tendrils with emissive glow
  - **Starburst Pod**: Yellow/magenta central sphere with radiating spikes
- **Plant Lifecycle**: Plants grow with an elastic animation, sway gently, and fade out gracefully
- **Camera Wobble**: The view subtly rotates based on mouse position for an immersive effect
- **Continuous Animation**: As one blob exits, another can begin from a different point

## How to Run

1. Simply open `index.html` in a modern web browser (Chrome, Firefox, Safari, Edge)
2. Move your mouse around to wobble the camera
3. Watch as the water blob creates a beautiful garden!

No build process or server required - it uses Three.js from a CDN.

## Customization

All configuration values are in `main.js` at the top in the `CONFIG` object:

```javascript
const CONFIG = {
    backgroundColor: 0x000000,     // Black background (change to any hex color)
    blobSize: 0.8,                 // Size of the water blob
    blobSpeed: 0.015,              // How fast the blob moves
    pathScale: 25,                 // Size of the path (larger = bigger coverage)
    plantSpawnInterval: 0.15,      // Distance between plant spawns
    plantLifespan: 8000,           // How long plants live (milliseconds)
    plantGrowTime: 800,            // How long plants take to grow
    plantFadeTime: 1500,           // How long plants take to fade out
    cameraWobbleAmount: 0.3,       // How much the camera wobbles
    maxPlants: 200                 // Maximum plants on screen
};
```
