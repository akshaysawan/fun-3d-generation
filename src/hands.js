import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
    constructor(videoElement) {
        this.video = videoElement;
        this.landmarker = null;
        this.results = null;
        this.lastVideoTime = -1;
    }

    async start() {
        // 1. Load MediaPipe Vision tasks
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );

        // 2. Initialize HandLandmarker
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        // 3. Start Camera
        await this.setupCamera();
    }

    async setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Browser API navigator.mediaDevices.getUserMedia not available");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1920,
                height: 1080
            },
            audio: false
        });

        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    getResults() {
        if (!this.landmarker || this.video.paused || this.video.currentTime === this.lastVideoTime) {
            return this.results;
        }

        this.lastVideoTime = this.video.currentTime;

        // Detect hands
        const detection = this.landmarker.detectForVideo(this.video, performance.now());
        this.results = detection;

        return this.results;
    }
}
