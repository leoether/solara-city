// render.js — renderer, camera follow (third person on foot / behind the car) and resize.
import { clamp, angleLerp } from './config.js';

export class Render {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camDist = 10;
    this.camHeight = 4.5;
    this.smoothYaw = 0;
    this.smoothPitch = 0.32;
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  /** Follow the player; camYaw/camPitch are controlled by mouse drag. */
  follow(player, dt, snap = false) {
    const targetYaw = player.driving ? player.car.heading : player.camYaw;
    const targetPitch = player.driving ? 0.26 : player.camPitch;
    if (snap) {
      this.smoothYaw = targetYaw;
      this.smoothPitch = targetPitch;
    } else {
      this.smoothYaw = angleLerp(this.smoothYaw, targetYaw, Math.min(1, dt * (player.driving ? 3.2 : 10)));
      this.smoothPitch = angleLerp(this.smoothPitch, targetPitch, Math.min(1, dt * 10));
    }
    const dist = player.driving ? 13 : 9.5;
    const height = player.driving ? 5 : 4.2;
    const cx = player.x - Math.sin(this.smoothYaw) * Math.cos(this.smoothPitch) * dist;
    const cz = player.z - Math.cos(this.smoothYaw) * Math.cos(this.smoothPitch) * dist;
    const cy = height + Math.sin(this.smoothPitch) * dist * 0.7;
    this.camera.position.set(cx, Math.max(cy, 1.6), cz);
    this.camera.lookAt(player.x, player.driving ? 1.6 : 1.5, player.z);
    // keep the camera out of buildings: clamp inside the city shell
    this.camera.position.x = clamp(this.camera.position.x, -170, 170);
    this.camera.position.z = clamp(this.camera.position.z, -170, 260);
  }
  draw() {
    this.renderer.render(this.scene, this.camera);
  }
}
