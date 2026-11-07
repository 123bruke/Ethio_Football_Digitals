import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameEngine } from '../game/GameEngine';
import { AWAY_KIT, HOME_KIT } from '../game/Team';
import { CameraMode, MatchPhase, PitchConfig } from '../types/game';
import { Ball3DMesh } from './Ball3DMesh';
import { ConfettiFX } from './ConfettiFX';
import { Player3DMesh } from './Player3DMesh';
import { StadiumRenderer } from './StadiumRenderer';
import { VolumetricLighting } from './VolumetricLighting';

export interface ScreenProjection {
  x: number;
  y: number;
  scale: number;
}

export class ThreeScene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer | null = null;
  public readonly isSoftwareGl: boolean;
  public readonly stadium: StadiumRenderer | null = null;

  public readonly playerMeshes = new Map<string, Player3DMesh>();
  public readonly ball3D: Ball3DMesh;
  public readonly confetti: ConfettiFX;
  public readonly volumetric: VolumetricLighting;

  private mainFloodLight: THREE.DirectionalLight | null = null;
  private rimFloodLight: THREE.DirectionalLight | null = null;
  private sideFillLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private towerSprites: THREE.Sprite[] = [];
  private skyMesh: THREE.Mesh | null = null;
  private floodlightsOn = true;
  private timeOfDay: 'night' | 'dusk' | 'day' = 'night';

  private width = 1280;
  private height = 720;
  private camCurrentX = 0;
  private camCurrentY = 38;
  private camCurrentZ = 48;
  private camLookX = 0;
  private camLookY = 0;
  private camLookZ = 1.5;
  private elapsedTime = 0;
  private lastPhase: MatchPhase = 'MENU';

  // Reusable projection vector (zero GC in loop)
  private readonly projVec = new THREE.Vector3();

  constructor(container: HTMLElement, pitch: PitchConfig) {
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.FogExp2(0x070b12, 0.0052);

    this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 1, 320);
    this.camera.position.set(0, 40, 48);
    this.camera.lookAt(0, 0, 1.5);

    this.isSoftwareGl = ThreeScene.detectSoftwareWebGL();

    // 1. Initialize 3D Ball
    this.ball3D = new Ball3DMesh(pitch.goalHeight * 0.18);
    this.scene.add(this.ball3D.group);

    // 2. Initialize 3D Confetti Cannon
    this.confetti = new ConfettiFX(pitch);
    this.scene.add(this.confetti.group);

    // 3. Initialize Volumetric Floodlight Beams
    this.volumetric = new VolumetricLighting(pitch);
    this.scene.add(this.volumetric.group);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      );
      this.renderer.setSize(this.width, this.height);
      this.renderer.shadowMap.enabled = !this.isSoftwareGl;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.innerHTML = '';
      container.appendChild(this.renderer.domElement);

      // Studio PBR Environment reflection
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();

      // Atmospheric Sky Dome with Twilight Horizon
      const skyGeo = new THREE.SphereGeometry(220, 24, 16);
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 16;
      skyCanvas.height = 256;
      const skyCtx = skyCanvas.getContext('2d');
      if (skyCtx) {
        const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
        skyGrad.addColorStop(0, '#030712'); // Deep night zenith
        skyGrad.addColorStop(0.65, '#0b1626');
        skyGrad.addColorStop(0.85, '#1e293b'); // Stadium haze twilight horizon
        skyGrad.addColorStop(1, '#0f172a');
        skyCtx.fillStyle = skyGrad;
        skyCtx.fillRect(0, 0, 16, 256);
      }
      const skyTex = new THREE.CanvasTexture(skyCanvas);
      skyTex.colorSpace = THREE.SRGBColorSpace;
      const skyMat = new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const skyMesh = new THREE.Mesh(skyGeo, skyMat);
      skyMesh.rotation.y = Math.PI;
      this.skyMesh = skyMesh;
      this.scene.add(skyMesh);

      // Balanced 4-Point Stadium Floodlight Rig
      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x064e3b, 0.92);
      this.hemiLight = hemiLight;
      this.scene.add(hemiLight);

      // Main Primary Pitch Floodlight
      const mainFloodLight = new THREE.DirectionalLight(0xfffbeb, 2.15);
      mainFloodLight.position.set(28, 54, 38);
      if (!this.isSoftwareGl) {
        mainFloodLight.castShadow = true;
        mainFloodLight.shadow.mapSize.width = 2048;
        mainFloodLight.shadow.mapSize.height = 2048;
        mainFloodLight.shadow.camera.near = 10;
        mainFloodLight.shadow.camera.far = 160;
        const d = 52;
        mainFloodLight.shadow.camera.left = -d;
        mainFloodLight.shadow.camera.right = d;
        mainFloodLight.shadow.camera.top = d;
        mainFloodLight.shadow.camera.bottom = -d;
        mainFloodLight.shadow.bias = -0.0003;
      }
      this.mainFloodLight = mainFloodLight;
      this.scene.add(mainFloodLight);

      // Counter Rim Floodlight from North-West
      const rimFloodLight = new THREE.DirectionalLight(0x93c5fd, 0.95);
      rimFloodLight.position.set(-32, 46, -36);
      this.rimFloodLight = rimFloodLight;
      this.scene.add(rimFloodLight);

      // Warm Side Pitch Fill from North-East
      const sideFillLight = new THREE.DirectionalLight(0xfef08a, 0.55);
      sideFillLight.position.set(34, 42, -32);
      this.sideFillLight = sideFillLight;
      this.scene.add(sideFillLight);

      // Optical Floodlight Glow Sprites on the 4 Stadium Towers
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = 128;
      glowCanvas.height = 128;
      const gctx = glowCanvas.getContext('2d');
      if (gctx) {
        const radGrad = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        radGrad.addColorStop(0, 'rgba(254, 240, 138, 1)');
        radGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.55)');
        radGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        gctx.fillStyle = radGrad;
        gctx.fillRect(0, 0, 128, 128);
      }
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const towerCorners = [
        [-(pitch.halfW + 14), 28.5, -(pitch.halfH + 12)],
        [pitch.halfW + 14, 28.5, -(pitch.halfH + 12)],
        [-(pitch.halfW + 14), 28.5, pitch.halfH + 12],
        [pitch.halfW + 14, 28.5, pitch.halfH + 12],
      ];
      this.towerSprites = [];
      for (const [tx, ty, tz] of towerCorners) {
        const sprite = new THREE.Sprite(glowMat);
        sprite.position.set(tx, ty, tz);
        sprite.scale.set(9.5, 9.5, 1);
        this.towerSprites.push(sprite);
        this.scene.add(sprite);
      }

      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.stadium = new StadiumRenderer(pitch, maxAniso);
      this.scene.add(this.stadium.stadiumGroup);

      if (!this.isSoftwareGl) {
        this.renderer.compile(this.scene, this.camera);
      }
    } catch {
      this.renderer = null;
    }
  }

  private static detectSoftwareWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  /**
   * Synchronize 3D player meshes with the current game engine state.
   */
  public syncPlayers(engine: GameEngine): void {
    const players = engine.allPlayers;
    for (const player of players) {
      if (!this.playerMeshes.has(player.state.id)) {
        const kit = player.state.team === 'home' ? HOME_KIT : AWAY_KIT;
        const mesh = new Player3DMesh(player.state, kit);
        this.playerMeshes.set(player.state.id, mesh);
        this.scene.add(mesh.root);
      }
    }
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;

    // Automatically adjust FOV on portrait or narrow screens
    const aspect = this.width / this.height;
    this.camera.fov = aspect < 1.2 ? Math.min(54, 44 / Math.max(0.65, aspect * 0.85)) : 37;
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height);
    }
  }

  /**
   * Updates 3D camera tracking, 3D players, 3D ball, and confetti FX.
   */
  public updateAndRender(dt: number, engine: GameEngine): void {
    this.elapsedTime += dt;
    this.syncPlayers(engine);

    const phase = engine.phase;
    const ball = engine.ball.state;
    const controlled = engine.getControlledPlayer();
    const cameraMode: CameraMode = engine.settings.cameraMode || 'broadcast';

    // 1. Goal Celebration trigger
    if (phase === 'GOAL_CELEBRATION' && this.lastPhase !== 'GOAL_CELEBRATION') {
      const goalX = ball.x > 0 ? engine.pitch.halfW : -engine.pitch.halfW;
      const scoringTeam = ball.x > 0 ? 'home' : 'away';
      this.confetti.triggerGoal(scoringTeam, goalX);
    } else if (phase !== 'GOAL_CELEBRATION' && this.lastPhase === 'GOAL_CELEBRATION') {
      this.confetti.reset();
    }
    this.lastPhase = phase;

    // 2. Multi-Perspective Cinematic Camera Tracking ("4D Views")
    if (phase === 'MENU') {
      // Gentle cinematic broadcast sweep in menu
      const targetX = Math.sin(this.elapsedTime * 0.25) * 9;
      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetX, 2.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, 36, 2.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, 46, 2.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetX * 0.65, 2.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 0, 2.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, 0, 2.5, dt);
    } else if (phase === 'GOAL_CELEBRATION') {
      // Cinematic slow-motion orbit around the goalscorer celebrating!
      const orbitAngle = this.elapsedTime * 0.8;
      const targetCamX = ball.x + Math.cos(orbitAngle) * 14;
      const targetCamY = 9 + Math.sin(this.elapsedTime * 0.5) * 2;
      const targetCamZ = ball.y + Math.sin(orbitAngle) * 14;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, ball.x, 5.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 1.8, 5.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, ball.y, 5.0, dt);
    } else if (cameraMode === 'action') {
      // Action Cam (3rd person dynamic follow cam behind user player!)
      const px = controlled.state.x;
      const py = controlled.state.y;
      const facingAngle = controlled.state.angle;

      // Position camera behind player facing direction with height
      const camDist = 16.5;
      const targetCamX = px - Math.cos(facingAngle) * camDist;
      const targetCamY = 12.5;
      const targetCamZ = py - Math.sin(facingAngle) * camDist * 0.7 + 6;

      const targetLookX = px + Math.cos(facingAngle) * 8 + ball.x * 0.2;
      const targetLookY = 1.6;
      const targetLookZ = py + Math.sin(facingAngle) * 6 + ball.y * 0.2;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 5.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 5.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 5.5, dt);
    } else if (cameraMode === 'endline') {
      // Behind-the-goal perspective looking downfield
      const targetCamX = -engine.pitch.halfW - 14;
      const targetCamY = 18;
      const targetCamZ = ball.y * 0.35;

      const targetLookX = ball.x * 0.65;
      const targetLookY = 1.5;
      const targetLookZ = ball.y * 0.55;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 5.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 5.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 5.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 6.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 6.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 6.0, dt);
    } else if (cameraMode === 'tactical') {
      // 4D Panoramic Tactical High-Angle View
      const targetCamX = 0;
      const targetCamY = 56;
      const targetCamZ = 58;

      const targetLookX = ball.x * 0.32;
      const targetLookY = 0;
      const targetLookZ = ball.y * 0.22;

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 4.0, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, targetCamY, 4.0, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 4.0, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 5.0, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, targetLookY, 5.0, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 5.0, dt);
    } else {
      // Default Broadcast TV Camera
      const isWide = engine.settings.cameraZoom === 'wide';
      const baseHeight = isWide ? 44 : 37.5;
      const baseZ = isWide ? 51 : 45.5;

      const targetCamX = THREE.MathUtils.clamp(ball.x * 0.46, -15, 15);
      const targetCamZ = baseZ + THREE.MathUtils.clamp(ball.y * 0.22, -4, 5);
      const targetLookX = THREE.MathUtils.clamp(ball.x * 0.58, -19, 19);
      const targetLookZ = THREE.MathUtils.clamp(ball.y * 0.35 + 1.2, -6, 8);

      this.camCurrentX = THREE.MathUtils.damp(this.camCurrentX, targetCamX, 5.5, dt);
      this.camCurrentY = THREE.MathUtils.damp(this.camCurrentY, baseHeight, 5.5, dt);
      this.camCurrentZ = THREE.MathUtils.damp(this.camCurrentZ, targetCamZ, 5.5, dt);
      this.camLookX = THREE.MathUtils.damp(this.camLookX, targetLookX, 6.5, dt);
      this.camLookY = THREE.MathUtils.damp(this.camLookY, 0, 6.5, dt);
      this.camLookZ = THREE.MathUtils.damp(this.camLookZ, targetLookZ, 6.5, dt);
    }

    this.camera.position.set(this.camCurrentX, this.camCurrentY, this.camCurrentZ);
    this.camera.lookAt(this.camLookX, this.camLookY, this.camLookZ);
    this.camera.updateMatrixWorld();

    // 3. Update 3D Players
    for (const player of engine.allPlayers) {
      const mesh = this.playerMeshes.get(player.state.id);
      if (mesh) {
        mesh.update(
          player.state,
          player.state.id === engine.controlledPlayerId,
          dt,
          phase,
          this.elapsedTime
        );
      }
    }

    // 4. Update 3D Ball
    this.ball3D.update(engine.ball.state, dt);

    // 5. Update Confetti & Stadium
    this.confetti.update(dt);

    if (this.stadium) {
      this.stadium.update(this.elapsedTime, phase);
    }

    // 6. Render WebGL Frame
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Projects a 3D world coordinate into exact 2D canvas pixel coordinates and perspective scale.
   */
  public worldToScreen(
    pitchX: number,
    pitchY: number,
    heightZ: number,
    out: ScreenProjection
  ): void {
    this.projVec.set(pitchX, heightZ, pitchY);
    this.projVec.project(this.camera);

    out.x = (this.projVec.x * 0.5 + 0.5) * this.width;
    out.y = (-this.projVec.y * 0.5 + 0.5) * this.height;

    const dx = pitchX - this.camera.position.x;
    const dy = heightZ - this.camera.position.y;
    const dz = pitchY - this.camera.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const fovScale = 37 / this.camera.fov;
    out.scale = (this.height / Math.max(20, dist)) * 0.78 * fovScale;
  }

  public toggleFloodlights(): boolean {
    this.setFloodlights(!this.floodlightsOn);
    return this.floodlightsOn;
  }

  public setFloodlights(enabled: boolean): void {
    this.floodlightsOn = enabled;
    const mult = enabled ? 1 : 0.12;
    if (this.mainFloodLight) this.mainFloodLight.intensity = (this.timeOfDay === 'day' ? 2.8 : 2.15) * mult;
    if (this.rimFloodLight) this.rimFloodLight.intensity = (this.timeOfDay === 'day' ? 1.2 : 0.95) * mult;
    if (this.sideFillLight) this.sideFillLight.intensity = (this.timeOfDay === 'day' ? 0.8 : 0.55) * mult;
    if (this.hemiLight) this.hemiLight.intensity = this.timeOfDay === 'day' ? 1.4 : (enabled ? 0.92 : 0.28);
    for (const sprite of this.towerSprites) {
      sprite.visible = enabled;
    }
    this.volumetric.group.visible = enabled && this.timeOfDay !== 'day';
  }

  public setTimeOfDay(mode: 'night' | 'dusk' | 'day'): void {
    this.timeOfDay = mode;
    if (mode === 'day') {
      this.scene.background = new THREE.Color(0x38bdf8);
      this.scene.fog = new THREE.FogExp2(0x93c5fd, 0.002);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xffffff);
        this.hemiLight.groundColor.setHex(0x15803d);
        this.hemiLight.intensity = 1.4;
      }
      if (this.mainFloodLight) {
        this.mainFloodLight.color.setHex(0xffffff);
        this.mainFloodLight.intensity = 2.8;
      }
      this.volumetric.group.visible = false;
      for (const sprite of this.towerSprites) sprite.visible = false;
    } else if (mode === 'dusk') {
      this.scene.background = new THREE.Color(0x1e1b4b);
      this.scene.fog = new THREE.FogExp2(0x311042, 0.004);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xfda4af);
        this.hemiLight.groundColor.setHex(0x064e3b);
        this.hemiLight.intensity = 0.85;
      }
      if (this.mainFloodLight) {
        this.mainFloodLight.color.setHex(0xfef08a);
        this.mainFloodLight.intensity = this.floodlightsOn ? 2.2 : 0.3;
      }
      this.volumetric.group.visible = this.floodlightsOn;
      for (const sprite of this.towerSprites) sprite.visible = this.floodlightsOn;
    } else {
      // Night
      this.scene.background = new THREE.Color(0x070b12);
      this.scene.fog = new THREE.FogExp2(0x070b12, 0.0052);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xdbeafe);
        this.hemiLight.groundColor.setHex(0x064e3b);
        this.hemiLight.intensity = this.floodlightsOn ? 0.92 : 0.28;
      }
      if (this.mainFloodLight) {
        this.mainFloodLight.color.setHex(0xfffbeb);
        this.mainFloodLight.intensity = this.floodlightsOn ? 2.15 : 0.25;
      }
      this.volumetric.group.visible = this.floodlightsOn;
      for (const sprite of this.towerSprites) sprite.visible = this.floodlightsOn;
    }
  }

  public getFloodlightsState(): boolean {
    return this.floodlightsOn;
  }

  public getTimeOfDay(): 'night' | 'dusk' | 'day' {
    return this.timeOfDay;
  }

  public getGlContext(): WebGL2RenderingContext | WebGLRenderingContext | null {
    return this.renderer ? this.renderer.getContext() : null;
  }

  public dispose(): void {
    this.stadium?.dispose();
    this.ball3D.dispose();
    this.confetti.dispose();
    this.volumetric.dispose();
    for (const mesh of this.playerMeshes.values()) {
      mesh.dispose();
    }
    this.playerMeshes.clear();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
