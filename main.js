import * as THREE from 'three';

// Configuration
const CONFIG = {
    backgroundColor: 0x000000,
    blobSize: 204.8, // 256x larger than original (2x from previous)
    blobSpeed: 0.015,
    pathScale: 3200, // 128x larger (2x from previous)
    plantSpawnInterval: 24, // Reduced density by 25% to prevent flickering
    plantGrowTimeMin: 2500, // Minimum growth time with variation
    plantGrowTimeMax: 3500, // Maximum growth time with variation
    plantStableTimeMin: 15000, // Minimum time at full scale (15 seconds)
    plantStableTimeMax: 20000, // Maximum time at full scale (20 seconds)
    plantDecayTimeMin: 4000, // Minimum time to scale down to 0 (4 seconds, 20% below 5s)
    plantDecayTimeMax: 6000, // Maximum time to scale down to 0 (6 seconds, 20% above 5s)
    cameraWobbleAmount: 0.3,
    maxPlants: 200
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

// Mouse tracking for camera wobble
const mouse = { x: 0, y: 0 };
const targetCameraRotation = { x: 0, y: 0 };
const currentCameraRotation = { x: 0, y: 0 };

document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    targetCameraRotation.y = mouse.x * CONFIG.cameraWobbleAmount;
    targetCameraRotation.x = mouse.y * CONFIG.cameraWobbleAmount;
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xffffff, 1, 12800); // 128x range (2x from previous)
pointLight1.position.set(1280, 1280, 1280); // 128x distance (2x from previous)
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4488ff, 0.5, 12800); // 128x range (2x from previous)
pointLight2.position.set(-1280, -1280, 640); // 128x distance (2x from previous)
scene.add(pointLight2);

// Water blob with jiggly effect
class WaterBlob {
    constructor() {
        // Using SphereGeometry for smoother gradient appearance
        const geometry = new THREE.SphereGeometry(CONFIG.blobSize, 64, 64);

        // Store original positions for jiggle effect
        const positions = geometry.attributes.position.array;
        this.originalPositions = new Float32Array(positions);

        const material = new THREE.MeshPhongMaterial({
            color: 0x3399ff,
            transparent: true,
            opacity: 0.75, // More translucent for gradient effect
            shininess: 120,
            specular: 0xaaddff,
            reflectivity: 0.8,
            refractionRatio: 0.95
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.time = 0;
        this.pathProgress = 0;
        this.lastPlantSpawn = 0;
        this.hasSpawnedNext = false; // Track if this blob has spawned the next one

        scene.add(this.mesh);
        this.setNewPath();
    }

    update(delta) {
        this.time += delta;
        this.pathProgress += CONFIG.blobSpeed * delta;

        // Jiggle effect - large amplitude for visible wobble
        const positions = this.mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            const offset = i / 3;
            positions[i] = this.originalPositions[i] + Math.sin(this.time * 3 + offset) * 76.8;
            positions[i + 1] = this.originalPositions[i + 1] + Math.cos(this.time * 4 + offset) * 76.8;
            positions[i + 2] = this.originalPositions[i + 2] + Math.sin(this.time * 3.5 + offset) * 76.8;
        }
        this.mesh.geometry.attributes.position.needsUpdate = true;

        // Update position along path
        if (this.path) {
            const point = this.path.getPointAt(this.pathProgress % 1);
            this.mesh.position.copy(point);

            // Spawn plants along the trail
            const distanceTraveled = this.pathProgress * this.path.getLength();
            if (distanceTraveled - this.lastPlantSpawn > CONFIG.plantSpawnInterval) {
                this.lastPlantSpawn = distanceTraveled;
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
        colors: { base: 0xff4488, tip: 0xff8844 }, // Orange/Pink
        build: () => {
            const group = new THREE.Group();
            const numPetals = 8;
            for (let i = 0; i < numPetals; i++) {
                const angle = (i / numPetals) * Math.PI * 2;
                const geometry = new THREE.ConeGeometry(28.8, 153.6, 8); // 192x larger (4x from previous)
                // Enhanced gradient from hot pink to bright orange
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0xff1166), // Brighter hot pink
                        new THREE.Color(0xff9933), // Brighter orange
                        i / numPetals
                    ),
                    shininess: 60,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0xff1166),
                        new THREE.Color(0xff9933),
                        i / numPetals
                    ),
                    emissiveIntensity: 0.2
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
    }
    /* COMMENTED OUT FOR DEBUGGING FLICKERING - ADD BACK ONE BY ONE
    ,{
        name: 'Crystal Frond',
        colors: { base: 0x00ffff, tip: 0x8844ff }, // Cyan/Violet
        build: () => {
            const group = new THREE.Group();
            const numSegments = 5;
            for (let i = 0; i < numSegments; i++) {
                const size = 57.6 - (i * 7.68); // 192x larger (4x from previous)
                const geometry = new THREE.SphereGeometry(size, 8, 8);
                // Enhanced gradient from bright cyan to deep violet
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0x00ffff), // Bright cyan
                        new THREE.Color(0x9933ff), // Deeper violet
                        i / numSegments
                    ),
                    shininess: 80,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0x00ffff),
                        new THREE.Color(0x9933ff),
                        i / numSegments
                    ),
                    emissiveIntensity: 0.3
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
        colors: { base: 0xff00ff, tip: 0x00ffaa }, // Magenta/Turquoise
        build: () => {
            const group = new THREE.Group();
            const numBubbles = 12;
            for (let i = 0; i < numBubbles; i++) {
                const radius = 19.2 + Math.random() * 28.8; // 192x larger (4x from previous)
                const geometry = new THREE.SphereGeometry(radius, 16, 16);
                // Enhanced gradient from bright magenta to turquoise
                const gradientPos = Math.random();
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0xff00ff), // Bright magenta
                        new THREE.Color(0x00ffdd), // Bright turquoise
                        gradientPos
                    ),
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0xff00ff),
                        new THREE.Color(0x00ffdd),
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
            // Enhanced gradient along the tendril from orange to hot pink
            const material = new THREE.MeshPhongMaterial({
                color: 0xff6633, // Orange base
                shininess: 70,
                emissive: 0xff0066, // Hot pink emissive
                emissiveIntensity: 0.4,
                vertexColors: false
            });
            const tendril = new THREE.Mesh(geometry, material);

            // Add gradient effect by varying emissive along the curve
            const colors = [];
            const positionAttribute = geometry.attributes.position;
            for (let i = 0; i < positionAttribute.count; i++) {
                const t = (i / positionAttribute.count);
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(0xff9900), // Bright orange start
                    new THREE.Color(0xff0066), // Hot pink end
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
        colors: { base: 0xffdd00, tip: 0xff00dd }, // Aquamarine/Magenta gradient
        build: () => {
            const group = new THREE.Group();
            const centerGeometry = new THREE.SphereGeometry(48.0, 16, 16); // 192x larger (4x from previous)
            const centerMaterial = new THREE.MeshPhongMaterial({
                color: 0x7FFFD4, // Changed to aquamarine #7FFFD4
                shininess: 90,
                emissive: 0x7FFFD4,
                emissiveIntensity: 0.3
            });
            const center = new THREE.Mesh(centerGeometry, centerMaterial);
            center.position.y = 96.0; // 192x larger (4x from previous)
            group.add(center);

            const numSpikes = 16;
            for (let i = 0; i < numSpikes; i++) {
                const geometry = new THREE.CylinderGeometry(3.84, 15.36, 115.2, 8); // 192x larger (4x from previous)
                // Enhanced gradient from aquamarine to bright magenta
                const gradientPos = Math.random();
                const material = new THREE.MeshPhongMaterial({
                    color: new THREE.Color().lerpColors(
                        new THREE.Color(0x7FFFD4), // Aquamarine
                        new THREE.Color(0xff00ff), // Bright magenta
                        gradientPos
                    ),
                    shininess: 80,
                    emissive: new THREE.Color().lerpColors(
                        new THREE.Color(0x7FFFD4),
                        new THREE.Color(0xff00ff),
                        gradientPos
                    ),
                    emissiveIntensity: 0.25
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
    */
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

        // Calculate total lifespan
        this.totalLifespan = this.growTime + this.stableTime + this.decayTime;

        scene.add(this.mesh);
    }

    update(time) {
        const age = Date.now() - this.birthTime;

        // Growth phase - smooth cubic easing with varied duration
        if (age < this.growTime) {
            const growProgress = age / this.growTime;
            const scale = this.easeOutCubic(growProgress);
            this.mesh.scale.set(scale, scale, scale);
        }
        // Stable phase - maintain full scale
        else if (age < this.growTime + this.stableTime) {
            this.mesh.scale.set(1, 1, 1);
        }
        // Decay phase - scale down to 0
        else if (age < this.totalLifespan) {
            const decayStart = this.growTime + this.stableTime;
            const decayProgress = (age - decayStart) / this.decayTime;
            const scale = 1 - this.easeInCubic(decayProgress);
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
    if (plants.length >= CONFIG.maxPlants) {
        const oldPlant = plants.shift();
        oldPlant.destroy();
    }

    const plantType = PLANT_TYPES[Math.floor(Math.random() * PLANT_TYPES.length)];
    const plant = new Plant(position, plantType);
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
