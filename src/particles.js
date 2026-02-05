import * as THREE from 'three';

export class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.initThree();
        this.initParticles();

        window.addEventListener('resize', this.onResize.bind(this));
    }

    initThree() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 30;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    initParticles() {
        this.particleCount = 1050000;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.originalPositions = new Float32Array(this.particleCount * 3);

        const color = new THREE.Color();
        const colors = [];

        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 60;
            const z = (Math.random() - 0.5) * 50;

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this.originalPositions[i * 3] = x;
            this.originalPositions[i * 3 + 1] = y;
            this.originalPositions[i * 3 + 2] = z;

            this.velocities[i * 3] = 0;
            this.velocities[i * 3 + 1] = 0;
            this.velocities[i * 3 + 2] = 0;

            // Color gradient based on position
            color.setHSL(0.5 + Math.random() * 0.2, 0.8, 0.6);
            colors.push(color.r, color.g, color.b);
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.000001,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.7
        });

        this.points = new THREE.Points(this.geometry, material);
        this.scene.add(this.points);

        this.targetRotationY = 0;
        this.targetRotationX = 0;
    }

    update(handData) {
        if (!this.geometry) return;

        const positions = this.geometry.attributes.position.array;
        const time = Date.now() * 0.001;

        let handX = 9999, handY = 9999;
        let isHandPresent = false;
        let isPinching = false;

        // Process Hand Data
        if (handData && handData.landmarks && handData.landmarks.length > 0) {
            const hand = handData.landmarks[0];
            const indexTip = hand[8];
            const thumbTip = hand[4];

            // Convert to world space roughly
            // Center of screen is (0,0)
            // handX/Y will be used for forces
            handX = (indexTip.x - 0.5) * -120; // Flip X because webcam is mirrored
            handY = (indexTip.y - 0.5) * -80;
            isHandPresent = true;

            // Rotation Interaction:
            // Hand position relative to center controls rotation speed/tilt
            // Left/Right = Rotate Y
            // Up/Down = Tilt X
            const normalizeX = (indexTip.x - 0.5) * 2; // -1 to 1
            const normalizeY = (indexTip.y - 0.5) * 2; // -1 to 1

            // Smoothly interpolate rotation target
            // If hand is near edges, rotate. If near center, stabilize.
            if (Math.abs(normalizeX) > 0.2) {
                this.targetRotationY += normalizeX * 0.02;
            }
            if (Math.abs(normalizeY) > 0.2) {
                this.targetRotationX += normalizeY * 0.02;
            }

            // Pinch Detection (Distance between thumb and index)
            const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
            isPinching = pinchDist < 0.05;
        } else {
            // Auto-rotate if no hand
            this.targetRotationY += 0.002;
        }

        // Apply smooth rotation to the container
        this.points.rotation.y += (this.targetRotationY - this.points.rotation.y) * 0.1;
        this.points.rotation.x += (this.targetRotationX - this.points.rotation.x) * 0.1;

        for (let i = 0; i < this.particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            // Base movement: Gentle sine wave float
            const ox = this.originalPositions[ix];
            const oy = this.originalPositions[iy];
            const oz = this.originalPositions[iz];

            // Base Physics: Return to grid + Noise
            let fx = (ox - positions[ix]) * 0.015;
            let fy = (oy - positions[iy]) * 0.015;
            let fz = (oz - positions[iz]) * 0.015;

            // Hand Interaction Force
            if (isHandPresent) {
                // Calculate distance to hand in world space (roughly)
                // Note: The particles are rotating, so we need to account for that if we want precise touching
                // For now, let's keep it simple: The force source is in local space or we untransform.
                // Simpler: Just use raw position diff, creates a cool "magical" offset effect when rotated.

                const dx = positions[ix] - handX;
                const dy = positions[iy] - handY;
                const distSq = dx * dx + dy * dy + (positions[iz] * positions[iz] * 0.1); // Flatten sphere to cylinder roughly

                if (distSq < 1500) {
                    const forceFactor = (1500 - distSq) / 1500; // 0 to 1

                    if (isPinching) {
                        // implosion / black hole effect
                        fx -= dx * forceFactor * 0.08;
                        fy -= dy * forceFactor * 0.08;
                        fz -= positions[iz] * forceFactor * 0.08;
                    } else {
                        // gentle turbulence / repulsion
                        fx += dx * forceFactor * 0.02;
                        fy += dy * forceFactor * 0.02;
                        fz += (Math.random() - 0.5) * forceFactor * 1.5;
                    }
                }
            }

            this.velocities[ix] += fx;
            this.velocities[iy] += fy;
            this.velocities[iz] += fz;

            // Damping
            this.velocities[ix] *= 0.95;
            this.velocities[iy] *= 0.95;
            this.velocities[iz] *= 0.95;

            // Apply velocity
            positions[ix] += this.velocities[ix];
            positions[iy] += this.velocities[iy];
            positions[iz] += this.velocities[iz];
        }

        this.geometry.attributes.position.needsUpdate = true;
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }
}
