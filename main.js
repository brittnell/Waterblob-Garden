import * as THREE from 'three';

// Configuration
const CONFIG = {
    backgroundColor: 0x000000,
    blobSize: 307.2, // 1.5x larger (was 204.8, increased by 50%)
    blobSpeed: 0.015,
    pathScale: 3200, // 128x larger (2x from previous)
    plantSpawnRate: 8, // Plants spawned per second (adjust this to control density)
    plantGrowTimeMin: 5000, // Minimum growth time (5 seconds with 20% variation)
    plantGrowTimeMax: 8000, // Maximum growth time (8 seconds with 20% variation)
    plantStableTimeMin: 15000, // Minimum time at full scale (15 seconds) - HOLD at 100%
    plantStableTimeMax: 20000, // Maximum time at full scale (20 seconds) - HOLD at 100%
    plantDecayTimeMin: 8000, // Minimum time to scale down to 0 (8 seconds - SLOW decay)
    plantDecayTimeMax: 10000, // Maximum time to scale down to 0 (10 seconds - SLOW decay)
    plantSpawnRandomness: 400, // Random offset range for plant spawn positions (±100 units)
    plantMaxScaleMin: 0.8, // Minimum max scale (80% of full size)
    plantMaxScaleMax: 1.0, // Maximum max scale (100% of full size)
    cameraWobbleAmount: 0.1 // Reduced camera rotation with mouse (was 0.3)
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.backgroundColor);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 16000);
camera.position.z = 5120; // 128x further back to see larger scene (2x from previous)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Device motion tracking for camera wobble
const targetCameraRotation = { x: 0, y: 0 };
const currentCameraRotation = { x: 0, y: 0 };

let gyroActive = false;
let mouseActive = false;

// Always set up mouse as fallback
document.addEventListener('mousemove', (event) => {
    if (!gyroActive) {
        mouseActive = true;
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

        targetCameraRotation.y = mouseX * CONFIG.cameraWobbleAmount;
        targetCameraRotation.x = mouseY * CONFIG.cameraWobbleAmount;
    }
});

// Try to set up gyroscope (works if available, regardless of device type)
function enableGyro() {
    console.log('Attempting to enable gyroscope...');

    window.addEventListener('deviceorientation', (event) => {
        // Check if we're actually getting orientation data
        if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
            if (!gyroActive) {
                gyroActive = true;
                mouseActive = false;
                console.log('✓ Gyroscope active! Tilt device to control camera.');
                updateInfoText('Gyroscope active - tilt device to control camera');
            }

            const beta = event.beta || 0;  // X axis (front/back tilt: -180 to 180)
            const gamma = event.gamma || 0; // Y axis (left/right tilt: -90 to 90)

            // Normalize and apply to camera rotation (2x sensitivity for mobile gyro)
            targetCameraRotation.x = (beta / 180) * CONFIG.cameraWobbleAmount * 2;
            targetCameraRotation.y = (gamma / 90) * CONFIG.cameraWobbleAmount * 2;
        }
    }, true);
}

// Helper to update info text
function updateInfoText(text) {
    const infoDiv = document.getElementById('info');
    if (infoDiv) {
        infoDiv.textContent = text;
        setTimeout(() => {
            infoDiv.style.opacity = '0';
        }, 3000);
    }
}

// Check if device has DeviceOrientationEvent
if (typeof DeviceOrientationEvent !== 'undefined') {
    console.log('DeviceOrientationEvent is available');

    // iOS 13+ requires permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        console.log('iOS detected - tap screen to grant gyro permission');
        updateInfoText('Tap screen to enable gyroscope');
        document.addEventListener('click', () => {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    console.log('Permission state:', permissionState);
                    if (permissionState === 'granted') {
                        enableGyro();
                    }
                })
                .catch(err => console.error('Permission error:', err));
        }, { once: true });
    } else {
        // Android, Firefox, or older iOS - try enabling directly
        console.log('Non-iOS device - enabling gyro directly');
        enableGyro();

        // Show message after a moment if gyro didn't activate
        setTimeout(() => {
            if (!gyroActive && !mouseActive) {
                console.log('Gyroscope not detected. Using mouse control.');
                updateInfoText('Move mouse to control camera');
            } else if (mouseActive) {
                console.log('Using mouse control');
                updateInfoText('Move mouse to control camera');
            }
        }, 2000);
    }
} else {
    console.log('DeviceOrientationEvent not available - using mouse only');
    updateInfoText('Move mouse to control camera');
}

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xffffff, 1, 12800); // 128x range (2x from previous)
pointLight1.position.set(1280, 1280, 1280); // 128x distance (2x from previous)
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4488ff, 0.5, 12800); // 128x range (2x from previous)
pointLight2.position.set(-1280, -1280, 640); // 128x distance (2x from previous)
scene.add(pointLight2);

// Add bright key light for specular highlights on blobs
const keyLight = new THREE.PointLight(0xffffff, 2.5, 10000);
keyLight.position.set(500, 1000, 4500); // Above and slightly offset from camera view
scene.add(keyLight);

// Add rim light for edge highlights
const rimLight = new THREE.PointLight(0xaaddff, 1.5, 10000);
rimLight.position.set(-500, -800, 4500); // Opposite side for depth
scene.add(rimLight);

// Add directional light from camera direction for strong specular highlights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 500, 5000); // From above-front
scene.add(directionalLight);

// Water blob with jiggly effect
class WaterBlob {
    constructor() {
        // Using SphereGeometry for smoother gradient appearance
        const geometry = new THREE.SphereGeometry(CONFIG.blobSize, 64, 64);

        // Store original positions for jiggle effect
        const positions = geometry.attributes.position.array;
        this.originalPositions = new Float32Array(positions);

        // Add subtle vertex color variation for watery appearance
        const colors = [];
        const color1 = new THREE.Color(0x66ccff); // Lighter blue (top/highlights)
        const color2 = new THREE.Color(0x2288dd); // Medium blue
        const color3 = new THREE.Color(0x1166cc); // Deeper blue (bottom/shadows)

        for (let i = 0; i < positions.length; i += 3) {
            const y = positions[i + 1]; // Get y position
            const normalizedY = (y / CONFIG.blobSize + 1) / 2; // Normalize to 0-1

            // Create gradient from lighter at top to darker at bottom
            let color;
            if (normalizedY > 0.5) {
                // Top half: blend from medium to light
                const t = (normalizedY - 0.5) * 2;
                color = new THREE.Color().lerpColors(color2, color1, t);
            } else {
                // Bottom half: blend from deep to medium
                const t = normalizedY * 2;
                color = new THREE.Color().lerpColors(color3, color2, t);
            }

            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshPhongMaterial({
            vertexColors: true, // Enable vertex colors for watery gradient
            transparent: true,
            opacity: 0.85, // Increased opacity for more visible highlights
            shininess: 300, // Much higher for tighter, brighter highlights
            specular: 0xffffff, // Pure white specular for crisp highlights
            reflectivity: 0.95,
            refractionRatio: 0.98,
            emissive: 0x002244, // Slightly stronger blue glow
            emissiveIntensity: 0.15
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.time = 0;
        this.pathProgress = 0;
        this.timeSinceLastPlantSpawn = 0; // Track time instead of distance
        this.hasSpawnedNext = false; // Track if this blob has spawned the next one

        // Generate path BEFORE adding to scene to avoid spawn flicker
        this.setNewPath();

        // Position blob at path start immediately to prevent center-screen flash
        if (this.path) {
            const startPoint = this.path.getPointAt(0);
            this.mesh.position.copy(startPoint);
        }

        scene.add(this.mesh);
    }

    update(delta) {
        this.time += delta;
        this.pathProgress += CONFIG.blobSpeed * delta;

        // Jiggle effect - large amplitude for visible wobble (scaled with blob size)
        const positions = this.mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const offset = i / 3;
            positions[i] = this.originalPositions[i] + Math.sin(this.time * 3 + offset) * 115.2;
            positions[i + 1] = this.originalPositions[i + 1] + Math.cos(this.time * 4 + offset) * 115.2;
            positions[i + 2] = this.originalPositions[i + 2] + Math.sin(this.time * 3.5 + offset) * 115.2;
        }
        this.mesh.geometry.attributes.position.needsUpdate = true;

        // CRITICAL: Recompute normals after deformation for proper 3D shading
        this.mesh.geometry.computeVertexNormals();

        // Update position along path
        if (this.path) {
            const point = this.path.getPointAt(this.pathProgress % 1);
            this.mesh.position.copy(point);

            // Spawn plants based on time (plants per second)
            this.timeSinceLastPlantSpawn += delta;
            const spawnInterval = 1 / CONFIG.plantSpawnRate; // Time between spawns
            if (this.timeSinceLastPlantSpawn >= spawnInterval) {
                this.timeSinceLastPlantSpawn -= spawnInterval;
                spawnPlant(this.mesh.position.clone());
            }

            // Spawn next blob when halfway through path
            if (this.pathProgress >= 0.5 && !this.hasSpawnedNext) {
                this.hasSpawnedNext = true;
                return { shouldSpawnNext: true, shouldRemove: false };
            }

            // Remove blob when path is complete
            if (this.pathProgress >= 1) {
                return { shouldSpawnNext: false, shouldRemove: true };
            }
        }

        return { shouldSpawnNext: false, shouldRemove: false };
    }

    setNewPath() {
        // Generate smooth random path using Catmull-Rom curve
        const points = [];
        const numPoints = 8;

        // Start from off-screen
        const startAngle = Math.random() * Math.PI * 2;
        const startRadius = CONFIG.pathScale * 1.5;
        points.push(new THREE.Vector3(
            Math.cos(startAngle) * startRadius,
            Math.sin(startAngle) * startRadius,
            (Math.random() - 0.5) * 640 // 128x z-depth variation (2x from previous)
        ));

        // Middle points with smooth curves
        for (let i = 0; i < numPoints; i++) {
            const angle = startAngle + (Math.PI * 2 * (i / numPoints)) + (Math.random() - 0.5) * 0.5;
            const radius = CONFIG.pathScale * (0.3 + Math.random() * 0.4);
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                (Math.random() - 0.5) * 640 // 128x z-depth variation (2x from previous)
            ));
        }

        // End off-screen
        const endAngle = startAngle + Math.PI + (Math.random() - 0.5);
        const endRadius = CONFIG.pathScale * 1.5;
        points.push(new THREE.Vector3(
            Math.cos(endAngle) * endRadius,
            Math.sin(endAngle) * endRadius,
            (Math.random() - 0.5) * 640 // 128x z-depth variation (2x from previous)
        ));

        this.path = new THREE.CatmullRomCurve3(points);
        this.path.closed = false;
    }

    destroy() {
        scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
    }
}

// Plant types with fantastical colors
// NOTE: Currently testing with only one type to debug flickering issue
const PLANT_TYPES = [
    {
        name: 'Spiral Bloom',
        colors: { base: 0x00ff00, tip: 0xff6b6b }, // Neon Green/Coral
        build: () => {
            const group = new THREE.Group();
            const numPetals = 8;
            for (let i = 0; i < numPetals; i++) {
                const angle = (i / numPetals) * Math.PI * 2;
                const geometry = new THREE.ConeGeometry(28.8, 153.6, 8); // 192x larger (4x from previous)
                // Vibrant gradient from neon green to coral
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0x00ff00), // Neon green
                        new THREE.Color(0xff6b6b), // Coral
                        i / numPetals
                    ),
                    shininess: 60,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0x00ff00),
                        new THREE.Color(0xff6b6b),
                        i / numPetals
                    ),
                    emissiveIntensity: 0.2,
                    transparent: true,
                    opacity: 0.75
                });
                const petal = new THREE.Mesh(geometry, material);
                petal.rotation.z = Math.PI / 2;
                petal.rotation.y = angle;
                petal.position.x = Math.cos(angle) * 57.6; // 192x larger (4x from previous)
                petal.position.y = Math.sin(angle) * 57.6 + 57.6; // 192x larger (4x from previous)
                group.add(petal);
            }
            return group;
        }
    },
    {
        name: 'Crystal Frond',
        colors: { base: 0xccff00, tip: 0x1a4d2e }, // Lime Green/Dark Forest
        build: () => {
            const group = new THREE.Group();
            const numSegments = 5;
            for (let i = 0; i < numSegments; i++) {
                const size = 57.6 - (i * 7.68); // 192x larger (4x from previous)
                const geometry = new THREE.SphereGeometry(size, 8, 8);
                // Gradient from bright lime green to dark forest green
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0xccff00), // Lime green
                        new THREE.Color(0x1a4d2e), // Dark forest green
                        i / numSegments
                    ),
                    shininess: 80,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0xccff00),
                        new THREE.Color(0x1a4d2e),
                        i / numSegments
                    ),
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.75
                });
                const segment = new THREE.Mesh(geometry, material);
                segment.position.y = i * 76.8 + 38.4; // 192x larger (4x from previous)
                segment.scale.x = 1.5;
                group.add(segment);
            }
            return group;
        }
    },
    {
        name: 'Bubble Cluster',
        colors: { base: 0x9bc400, tip: 0x6b5b3e }, // Sage Green/Olive Brown
        build: () => {
            const group = new THREE.Group();
            const numBubbles = 12;
            for (let i = 0; i < numBubbles; i++) {
                const radius = 19.2 + Math.random() * 28.8; // 192x larger (4x from previous)
                const geometry = new THREE.SphereGeometry(radius, 16, 16);
                // Gradient from sage green to olive brown
                const gradientPos = Math.random();
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0x9bc400), // Sage green
                        new THREE.Color(0x6b5b3e), // Olive brown
                        gradientPos
                    ),
                    transparent: true,
                    opacity: 0.75,
                    shininess: 100,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0x9bc400),
                        new THREE.Color(0x6b5b3e),
                        gradientPos
                    ),
                    emissiveIntensity: 0.25
                });
                const bubble = new THREE.Mesh(geometry, material);
                const angle = (i / numBubbles) * Math.PI * 2;
                const height = Math.random() * 230.4; // 192x larger (4x from previous)
                bubble.position.x = Math.cos(angle) * 57.6 * (1 - height / 230.4); // 192x larger (4x from previous)
                bubble.position.y = height;
                bubble.position.z = Math.sin(angle) * 57.6 * (1 - height / 230.4); // 192x larger (4x from previous)
                group.add(bubble);
            }
            return group;
        }
    },
    {
        name: 'Plasma Tendril',
        colors: { base: 0xff9900, tip: 0xff0066 }, // Orange/Hot Pink
        build: () => {
            const group = new THREE.Group();
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(96, 192, 0), // 192x larger (4x from previous)
                new THREE.Vector3(38.4, 345.6, 0) // 192x larger (4x from previous)
            );
            const points = curve.getPoints(20);
            const geometry = new THREE.TubeGeometry(
                new THREE.CatmullRomCurve3(points),
                20,
                15.36, // 192x larger (4x from previous)
                8,
                false
            );
            // Gradient along the tendril from yellow-green to chocolate brown
            const material = new THREE.MeshPhongMaterial({
                color: 0xb5e550, // Yellow-green base
                shininess: 70,
                emissive: 0x5c4033, // Chocolate brown emissive
                emissiveIntensity: 0.4,
                transparent: true,
                opacity: 0.75,
                vertexColors: false
            });
            const tendril = new THREE.Mesh(geometry, material);

            // Add gradient effect by varying color along the curve
            const colors = [];
            const positionAttribute = geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                const t = (i / positionAttribute.count);
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(0xb5e550), // Yellow-green start
                    new THREE.Color(0x5c4033), // Chocolate brown end
                    t
                );
                colors.push(color.r, color.g, color.b);
            }
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            material.vertexColors = true;

            group.add(tendril);
            return group;
        }
    },
    {
        name: 'Starburst Pod',
        colors: { base: 0x39ff14, tip: 0x3d2817 }, // Neon Green/Dark Brown gradient
        build: () => {
            const group = new THREE.Group();
            const centerGeometry = new THREE.SphereGeometry(48.0, 16, 16); // 192x larger (4x from previous)
            const centerMaterial = new THREE.MeshPhongMaterial({
                color: 0x39ff14, // Bright neon green
                shininess: 90,
                emissive: 0x39ff14,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.75
            });
            const center = new THREE.Mesh(centerGeometry, centerMaterial);
            center.position.y = 96.0; // 192x larger (4x from previous)
            group.add(center);

            const numSpikes = 16;
            for (let i = 0; i < numSpikes; i++) {
                const geometry = new THREE.CylinderGeometry(3.84, 15.36, 115.2, 8); // 192x larger (4x from previous)
                // Gradient from neon green to dark brown
                const gradientPos = Math.random();
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0x39ff14), // Neon green
                        new THREE.Color(0x3d2817), // Dark brown
                        gradientPos
                    ),
                    shininess: 80,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0x39ff14),
                        new THREE.Color(0x3d2817),
                        gradientPos
                    ),
                    emissiveIntensity: 0.25,
                    transparent: true,
                    opacity: 0.75
                });
                const spike = new THREE.Mesh(geometry, material);
                const phi = Math.acos(-1 + (2 * i) / numSpikes);
                const theta = Math.sqrt(numSpikes * Math.PI) * phi;
                spike.position.x = Math.cos(theta) * Math.sin(phi) * 76.8; // 192x larger (4x from previous)
                spike.position.y = 96.0 + Math.cos(phi) * 76.8; // 192x larger (4x from previous)
                spike.position.z = Math.sin(theta) * Math.sin(phi) * 76.8; // 192x larger (4x from previous)
                spike.lookAt(center.position);
                group.add(spike);
            }
            return group;
        }
    }
];

// Plant management
const plants = [];

class Plant {
    constructor(position, type) {
        this.type = type;
        this.mesh = type.build();
        this.mesh.position.copy(position);
        this.mesh.scale.set(0, 0, 0);

        this.birthTime = Date.now();
        this.swayOffset = Math.random() * Math.PI * 2;
        this.swaySpeed = 1 + Math.random();
        this.originalRotation = {
            x: (Math.random() - 0.5) * 0.5,
            z: (Math.random() - 0.5) * 0.5
        };

        // Random growth time with variation between plants
        this.growTime = CONFIG.plantGrowTimeMin +
            Math.random() * (CONFIG.plantGrowTimeMax - CONFIG.plantGrowTimeMin);

        // Random stable time between min and max
        this.stableTime = CONFIG.plantStableTimeMin +
            Math.random() * (CONFIG.plantStableTimeMax - CONFIG.plantStableTimeMin);

        // Random decay time with variation
        this.decayTime = CONFIG.plantDecayTimeMin +
            Math.random() * (CONFIG.plantDecayTimeMax - CONFIG.plantDecayTimeMin);

        // Random max scale between 80-100% for variety
        this.maxScale = CONFIG.plantMaxScaleMin +
            Math.random() * (CONFIG.plantMaxScaleMax - CONFIG.plantMaxScaleMin);

        // Calculate total lifespan
        this.totalLifespan = this.growTime + this.stableTime + this.decayTime;

        scene.add(this.mesh);
    }

    update(time) {
        const age = Date.now() - this.birthTime;

        // Growth phase - smooth cubic easing with varied duration to random maxScale
        if (age < this.growTime) {
            const growProgress = age / this.growTime;
            const scale = this.easeOutCubic(growProgress) * this.maxScale;
            this.mesh.scale.set(scale, scale, scale);
        }
        // Stable phase - maintain maxScale (80-100%)
        else if (age < this.growTime + this.stableTime) {
            this.mesh.scale.set(this.maxScale, this.maxScale, this.maxScale);
        }
        // Decay phase - smooth LINEAR scale from maxScale to 0%
        else if (age < this.totalLifespan) {
            const decayStart = this.growTime + this.stableTime;
            const decayProgress = (age - decayStart) / this.decayTime;
            // Linear decay - no easing, smooth consistent fade
            const scale = this.maxScale * (1 - decayProgress);
            this.mesh.scale.set(scale, scale, scale);
        }

        // Sway animation (throughout all phases)
        const sway = Math.sin(time * this.swaySpeed + this.swayOffset) * 0.1;
        this.mesh.rotation.x = this.originalRotation.x + sway;
        this.mesh.rotation.z = this.originalRotation.z + sway * 0.5;

        // Remove if lifespan exceeded
        return age < this.totalLifespan;
    }

    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }

    easeInCubic(x) {
        return x * x * x;
    }

    destroy() {
        scene.remove(this.mesh);
        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}

function spawnPlant(position) {
    // No maxPlants constraint - plants naturally remove themselves when lifecycle completes

    // Add random offset to spread plants out along the trail
    const randomOffset = new THREE.Vector3(
        (Math.random() - 0.5) * CONFIG.plantSpawnRandomness,
        (Math.random() - 0.5) * CONFIG.plantSpawnRandomness,
        (Math.random() - 0.5) * CONFIG.plantSpawnRandomness
    );
    const spawnPosition = position.clone().add(randomOffset);

    const plantType = PLANT_TYPES[Math.floor(Math.random() * PLANT_TYPES.length)];
    const plant = new Plant(spawnPosition, plantType);
    plants.push(plant);
}

// Initialize water blobs array
const waterBlobs = [];
waterBlobs.push(new WaterBlob());

// Animation loop
let lastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);

    const currentTime = Date.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update water blobs
    for (let i = waterBlobs.length - 1; i >= 0; i--) {
        const result = waterBlobs[i].update(delta);

        // Spawn new blob when this one is halfway through
        if (result.shouldSpawnNext) {
            waterBlobs.push(new WaterBlob());
        }

        // Remove blob when path is complete
        if (result.shouldRemove) {
            waterBlobs[i].destroy();
            waterBlobs.splice(i, 1);
        }
    }

    // Update plants
    for (let i = plants.length - 1; i >= 0; i--) {
        if (!plants[i].update(currentTime / 1000)) {
            plants[i].destroy();
            plants.splice(i, 1);
        }
    }

    // Camera wobble
    currentCameraRotation.x += (targetCameraRotation.x - currentCameraRotation.x) * 0.05;
    currentCameraRotation.y += (targetCameraRotation.y - currentCameraRotation.y) * 0.05;

    camera.rotation.x = currentCameraRotation.x;
    camera.rotation.y = currentCameraRotation.y;

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
