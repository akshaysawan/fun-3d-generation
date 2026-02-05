import { ParticleSystem } from './particles.js';
import { HandTracker } from './hands.js';

class App {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.video = document.getElementById('webcam');
    this.status = document.getElementById('status');
    
    this.init();
  }

  async init() {
    try {
      // 1. Initialize Particles
      this.particles = new ParticleSystem(this.canvas);
      
      // 2. Initialize Hand Tracking
      this.hands = new HandTracker(this.video);
      await this.hands.start();
      
      this.updateStatus('System Ready. Show hands!');
      
      // 3. Start Loop
      this.animate();
      
    } catch (error) {
      console.error(error);
      this.updateStatus(`Error: ${error.message}`);
    }
  }

  updateStatus(msg) {
    this.status.textContent = msg;
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Update particles with hand data
    const handResults = this.hands.getResults();
    this.particles.update(handResults);
    
    // Render scene
    this.particles.render();
  }
}

// Start App when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
