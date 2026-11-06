import * as THREE from 'three';
import { MatchPhase, PitchConfig, TeamId } from '../types/game';
import { PitchRenderer } from './PitchRenderer';

export class StadiumRenderer {
  public readonly stadiumGroup = new THREE.Group();
  private crowdInstanced: THREE.InstancedMesh | null = null;
  private crowdBaseMatrices: THREE.Matrix4[] = [];
  private pitchTexture: THREE.CanvasTexture | null = null;
  private netTexture: THREE.CanvasTexture | null = null;
  private adTexture: THREE.CanvasTexture | null = null;
  private scoreboardTexture: THREE.CanvasTexture | null = null;
  private scoreboardMesh: THREE.Mesh | null = null;
  private cornerFlags: THREE.Mesh[] = [];
  private readonly dummyObj = new THREE.Object3D();

  // Animation parameters
  private adScrollOffset = 0;
  private lastScoreText = '0 - 0';

  constructor(pitch: PitchConfig, maxAnisotropy: number) {
    this.buildPitchAndSurround(pitch, maxAnisotropy);
    this.buildGoals(pitch);
    this.buildCornerFlags(pitch);
    this.buildPerimeterAndBenches(pitch, maxAnisotropy);
    this.buildPitchsidePersonnelAndCameras(pitch);
    this.buildPlayerTunnel(pitch);
    this.buildGrandstandsAndCrowd(pitch);
    this.buildFloodlightTowers(pitch);
    this.buildGiantJumbotron(pitch);
  }

  private buildPitchAndSurround(pitch: PitchConfig, maxAnisotropy: number): void {
    // 1. Dark stadium outer bowl floor
    const outerGeo = new THREE.PlaneGeometry(280, 210);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      roughness: 0.94,
      metalness: 0.04,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.rotation.x = -Math.PI * 0.5;
    outerMesh.position.y = -0.08;
    outerMesh.receiveShadow = true;
    this.stadiumGroup.add(outerMesh);

    // 2. Athletic Tartan Track / Technical surround apron
    const trackGeo = new THREE.PlaneGeometry(pitch.width + 26, pitch.height + 22);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.08,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI * 0.5;
    trackMesh.position.y = -0.03;
    trackMesh.receiveShadow = true;
    this.stadiumGroup.add(trackMesh);

    // 3. Main Football Pitch with high-resolution procedural CanvasTexture
    const pitchCanvas = PitchRenderer.createPitchCanvas(pitch);
    this.pitchTexture = new THREE.CanvasTexture(pitchCanvas);
    this.pitchTexture.colorSpace = THREE.SRGBColorSpace;
    this.pitchTexture.anisotropy = maxAnisotropy;

    const totalWorldW = pitch.width + 16;
    const totalWorldH = pitch.height + 14;
    const pitchGeo = new THREE.PlaneGeometry(totalWorldW, totalWorldH);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: this.pitchTexture,
      roughness: 0.72,
      metalness: 0.02,
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI * 0.5;
    pitchMesh.position.y = 0;
    pitchMesh.receiveShadow = true;
    this.stadiumGroup.add(pitchMesh);
  }

  private createNetTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
      ctx.lineWidth = 2.5;

      // Hexagonal / diamond weave netting
      const step = 16;
      for (let i = -128; i <= 256; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 128, 128);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(i, 128);
        ctx.lineTo(i + 128, 0);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    return tex;
  }

  private buildGoals(pitch: PitchConfig): void {
    this.netTexture = this.createNetTexture();

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.45,
    });
    const stanchionMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.45,
      metalness: 0.75,
    });
    const netMat = new THREE.MeshStandardMaterial({
      map: this.netTexture,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      roughness: 0.6,
      depthWrite: false,
    });

    const halfGoalZ = pitch.goalWidth * 0.5;
    const gh = pitch.goalHeight;
    const gd = pitch.goalDepth;
    const r = 0.12;

    const createGoalGroup = (side: -1 | 1): THREE.Group => {
      const group = new THREE.Group();
      const goalX = side * pitch.halfW;
      const backX = side * (pitch.halfW + gd);

      // Left & right upright posts
      const postGeo = new THREE.CylinderGeometry(r, r, gh, 14);
      const post1 = new THREE.Mesh(postGeo, postMat);
      post1.position.set(goalX, gh * 0.5, -halfGoalZ);
      post1.castShadow = true;
      group.add(post1);

      const post2 = new THREE.Mesh(postGeo, postMat);
      post2.position.set(goalX, gh * 0.5, halfGoalZ);
      post2.castShadow = true;
      group.add(post2);

      // Crossbar
      const crossbarGeo = new THREE.CylinderGeometry(r, r, pitch.goalWidth + r * 2, 14);
      const crossbar = new THREE.Mesh(crossbarGeo, postMat);
      crossbar.rotation.x = Math.PI * 0.5;
      crossbar.position.set(goalX, gh, 0);
      crossbar.castShadow = true;
      group.add(crossbar);

      // Stanchions (angled net tension supports)
      const stanchionGeo = new THREE.CylinderGeometry(0.06, 0.06, gd * 1.35, 8);
      const stanch1 = new THREE.Mesh(stanchionGeo, stanchionMat);
      stanch1.position.set(goalX + side * gd * 0.5, gh * 0.92, -halfGoalZ);
      stanch1.rotation.z = side * 0.28;
      group.add(stanch1);

      const stanch2 = new THREE.Mesh(stanchionGeo, stanchionMat);
      stanch2.position.set(goalX + side * gd * 0.5, gh * 0.92, halfGoalZ);
      stanch2.rotation.z = side * 0.28;
      group.add(stanch2);

      // Back base frame
      const backBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, pitch.goalWidth, 8),
        stanchionMat
      );
      backBar.rotation.x = Math.PI * 0.5;
      backBar.position.set(backX, 0.08, 0);
      group.add(backBar);

      // Net panels (Back, Top, and 2 Sides with natural sag)
      const backNet = new THREE.Mesh(new THREE.PlaneGeometry(pitch.goalWidth, gh), netMat);
      backNet.rotation.y = Math.PI * 0.5;
      backNet.position.set(backX, gh * 0.5, 0);
      group.add(backNet);

      const topNet = new THREE.Mesh(new THREE.PlaneGeometry(gd, pitch.goalWidth), netMat);
      topNet.rotation.x = Math.PI * 0.5;
      topNet.position.set(goalX + side * gd * 0.5, gh, 0);
      group.add(topNet);

      const sideNetGeo = new THREE.PlaneGeometry(gd, gh);
      const sideNet1 = new THREE.Mesh(sideNetGeo, netMat);
      sideNet1.position.set(goalX + side * gd * 0.5, gh * 0.5, -halfGoalZ);
      group.add(sideNet1);

      const sideNet2 = new THREE.Mesh(sideNetGeo, netMat);
      sideNet2.position.set(goalX + side * gd * 0.5, gh * 0.5, halfGoalZ);
      group.add(sideNet2);

      return group;
    };

    this.stadiumGroup.add(createGoalGroup(-1));
    this.stadiumGroup.add(createGoalGroup(1));
  }

  /**
   * Builds realistic 3D corner flagpoles with flexible spring bases
   * and waving cloth flags at all 4 corners of the pitch.
   */
  private buildCornerFlags(pitch: PitchConfig): void {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.4,
    });
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    const corners = [
      [-pitch.halfW, -pitch.halfH],
      [pitch.halfW, -pitch.halfH],
      [-pitch.halfW, pitch.halfH],
      [pitch.halfW, pitch.halfH],
    ];

    for (const [cx, cz] of corners) {
      const cornerGroup = new THREE.Group();
      cornerGroup.position.set(cx, 0, cz);

      // Spring rubber base
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.12, 10),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 })
      );
      baseMesh.position.y = 0.06;
      cornerGroup.add(baseMesh);

      // Flexible white pole (1.5m tall)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), poleMat);
      pole.position.y = 0.81;
      pole.castShadow = true;
      cornerGroup.add(pole);

      // Triangular fabric flag
      const flagShape = new THREE.Shape();
      flagShape.moveTo(0, 0);
      flagShape.lineTo(0.48, 0.16);
      flagShape.lineTo(0, 0.32);
      flagShape.closePath();

      const flagGeo = new THREE.ShapeGeometry(flagShape);
      const flagMesh = new THREE.Mesh(flagGeo, flagMat);
      flagMesh.position.set(0, 1.25, 0);
      flagMesh.castShadow = true;
      cornerGroup.add(flagMesh);
      this.cornerFlags.push(flagMesh);

      this.stadiumGroup.add(cornerGroup);
    }
  }

  private buildPerimeterAndBenches(pitch: PitchConfig, maxAnisotropy: number): void {
    // Ultra-crisp procedural LED digital ribbon board texture
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, 2048, 128);

      const banners = [
        { bg: '#0284c7', sub: '#0369a1', text: '★ PITCHSIDE 5V5 ARENA ★', tag: 'OFFICIAL MATCH' },
        { bg: '#0f172a', sub: '#1e293b', text: 'CHAMPIONS LEAGUE SERIES', tag: 'LIVE WORLDWIDE' },
        { bg: '#e11d48', sub: '#be123c', text: 'SPEED • PRECISION • GLORY', tag: 'NEXT-GEN AI' },
        { bg: '#059669', sub: '#047857', text: 'ETHIO FOOTBALL DIGITALS', tag: 'SEASON 2026' },
      ];

      const segW = 2048 / banners.length;
      ctx.font = 'bold 44px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      banners.forEach((b, i) => {
        // Glowing LED gradient panel
        const grad = ctx.createLinearGradient(i * segW, 0, i * segW + segW, 0);
        grad.addColorStop(0, b.sub);
        grad.addColorStop(0.5, b.bg);
        grad.addColorStop(1, b.sub);

        ctx.fillStyle = grad;
        ctx.fillRect(i * segW + 6, 8, segW - 12, 112);

        // LED dot matrix glow effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        for (let dy = 12; dy < 116; dy += 6) {
          ctx.fillRect(i * segW + 8, dy, segW - 16, 2);
        }

        // Subtitle tag
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(b.tag, i * segW + segW * 0.5, 34);

        // Main billboard slogan
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px "Barlow Condensed", sans-serif';
        ctx.fillText(b.text, i * segW + segW * 0.5, 78);
      });
    }

    this.adTexture = new THREE.CanvasTexture(canvas);
    this.adTexture.colorSpace = THREE.SRGBColorSpace;
    this.adTexture.anisotropy = maxAnisotropy;
    this.adTexture.wrapS = THREE.RepeatWrapping;
    this.adTexture.repeat.set(2, 1);

    const adMat = new THREE.MeshStandardMaterial({
      map: this.adTexture,
      roughness: 0.35,
      metalness: 0.15,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.35,
    });

    const boardH = 1.18;
    const northBoard = new THREE.Mesh(new THREE.BoxGeometry(pitch.width + 8, boardH, 0.25), adMat);
    northBoard.position.set(0, boardH * 0.5, -(pitch.halfH + 3.4));
    northBoard.castShadow = true;
    this.stadiumGroup.add(northBoard);

    // East & West boards split around goalmouths
    const sideSegmentLen = (pitch.height - pitch.goalWidth - 3) * 0.5;
    const sideBoardGeo = new THREE.BoxGeometry(0.25, boardH, sideSegmentLen);
    const zOffset = pitch.goalWidth * 0.5 + 1.5 + sideSegmentLen * 0.5;

    for (const sideX of [-(pitch.halfW + 3.8), pitch.halfW + 3.8]) {
      for (const sideZ of [-zOffset, zOffset]) {
        const bMesh = new THREE.Mesh(sideBoardGeo, adMat);
        bMesh.position.set(sideX, boardH * 0.5, sideZ);
        bMesh.castShadow = true;
        this.stadiumGroup.add(bMesh);
      }
    }

    // Modern Curved Team Dugouts with tinted glass and bucket racing seats
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
    });

    const benchFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.8,
    });

    for (const benchX of [-12, 12]) {
      const dugout = new THREE.Group();
      dugout.position.set(benchX, 0, pitch.halfH + 4.5);

      // Curved tinted canopy
      const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 8.4, 16, 1, false, 0, Math.PI * 0.6), glassMat);
      canopy.rotation.z = Math.PI * 0.5;
      canopy.rotation.y = Math.PI * 0.5;
      canopy.position.set(0, 1.35, 0);
      dugout.add(canopy);

      // Metal base frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.25, 2.2), benchFrameMat);
      frame.position.set(0, 0.12, 0);
      dugout.add(frame);

      // 6 Individual Bucket Racing Seats
      const seatColor = benchX < 0 ? 0x0284c7 : 0xe11d48;
      const seatMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.5 });
      for (let s = -2.5; s <= 2.5; s += 1.0) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.65, 0.65), seatMat);
        seat.position.set(s, 0.55, -0.2);
        seat.castShadow = true;
        dugout.add(seat);
      }

      this.stadiumGroup.add(dugout);
    }
  }

  /**
   * Adds pitchside media broadcast cameras on tripods, photographers,
   * and high-visibility safety stewards stationed around the perimeter.
   */
  private buildPitchsidePersonnelAndCameras(pitch: PitchConfig): void {
    const tripodMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
    const camMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.7 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
    const stewardMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7, emissive: 0xea580c, emissiveIntensity: 0.25 });

    // 1. Heavy TV Broadcast Cameras at Midfield and Behind Goals
    const camPositions = [
      [0, -(pitch.halfH + 4.2), 0],
      [-(pitch.halfW + 4.8), 0, Math.PI * 0.5],
      [pitch.halfW + 4.8, 0, -Math.PI * 0.5],
    ];

    for (const [cx, cz, rotY] of camPositions) {
      const camRig = new THREE.Group();
      camRig.position.set(cx, 0, cz);
      camRig.rotation.y = rotY;

      // Tripod legs
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6);
      const l1 = new THREE.Mesh(legGeo, tripodMat);
      l1.position.set(0, 0.72, 0.3);
      l1.rotation.x = 0.22;
      camRig.add(l1);

      const l2 = new THREE.Mesh(legGeo, tripodMat);
      l2.position.set(-0.25, 0.72, -0.2);
      l2.rotation.z = -0.22;
      camRig.add(l2);

      const l3 = new THREE.Mesh(legGeo, tripodMat);
      l3.position.set(0.25, 0.72, -0.2);
      l3.rotation.z = 0.22;
      camRig.add(l3);

      // Camera body & Telephoto lens
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.65), camMat);
      body.position.set(0, 1.45, 0);
      camRig.add(body);

      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 12), lensMat);
      lens.rotation.x = Math.PI * 0.5;
      lens.position.set(0, 1.45, 0.5);
      camRig.add(lens);

      this.stadiumGroup.add(camRig);
    }

    // 2. High-Visibility Stewards along perimeter
    const stewardGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.95, 8);
    const stewardPositions = [
      [-pitch.halfW * 0.5, -(pitch.halfH + 3.8)],
      [pitch.halfW * 0.5, -(pitch.halfH + 3.8)],
      [-pitch.halfW * 0.5, pitch.halfH + 3.8],
      [pitch.halfW * 0.5, pitch.halfH + 3.8],
    ];

    for (const [sx, sz] of stewardPositions) {
      const steward = new THREE.Mesh(stewardGeo, stewardMat);
      steward.position.set(sx, 0.48, sz);
      steward.castShadow = true;
      this.stadiumGroup.add(steward);
    }
  }

  /**
   * Builds the stadium player tunnel entrance at the South touchline.
   */
  private buildPlayerTunnel(pitch: PitchConfig): void {
    const tunnelGroup = new THREE.Group();
    tunnelGroup.position.set(0, 0, pitch.halfH + 7.5);

    const archMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
      metalness: 0.6,
    });
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
    });

    const tunnelArch = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 5.5, 16, 1, false, 0, Math.PI),
      canopyMat
    );
    tunnelArch.rotation.z = Math.PI * 0.5;
    tunnelArch.rotation.y = Math.PI * 0.5;
    tunnelArch.position.set(0, 1.8, -1.8);
    tunnelGroup.add(tunnelArch);

    // Entrance arch rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 24, Math.PI), archMat);
    rim.position.set(0, 0, 0.95);
    tunnelGroup.add(rim);

    this.stadiumGroup.add(tunnelGroup);
  }

  private buildGrandstandsAndCrowd(pitch: PitchConfig): void {
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.15,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0b131e,
      roughness: 0.55,
      metalness: 0.55,
    });
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.75,
    });

    const tierCount = 7;
    const standLenX = pitch.width + 20;
    const standLenZ = pitch.height + 12;

    const standsConfig = [
      { dir: 'north', x: 0, z: -(pitch.halfH + 7.8), len: standLenX, rotY: 0, tiers: tierCount, hasRoof: true },
      { dir: 'west', x: -(pitch.halfW + 8.8), z: 0, len: standLenZ, rotY: Math.PI * 0.5, tiers: tierCount, hasRoof: true },
      { dir: 'east', x: pitch.halfW + 8.8, z: 0, len: standLenZ, rotY: -Math.PI * 0.5, tiers: tierCount, hasRoof: true },
      { dir: 'south', x: 0, z: pitch.halfH + 7.8, len: standLenX, rotY: Math.PI, tiers: 2, hasRoof: false },
    ];

    const crowdPositions: { x: number; y: number; z: number; color: number }[] = [];
    const palette = [0x0284c7, 0x38bdf8, 0xe11d48, 0xf43f5e, 0xf8fafc, 0xfacc15, 0x94a3b8, 0x10b981];

    for (const st of standsConfig) {
      const standGroup = new THREE.Group();
      standGroup.position.set(st.x, 0, st.z);
      standGroup.rotation.y = st.rotY;

      for (let t = 0; t < st.tiers; t++) {
        const stepH = 1.45;
        const stepD = 1.85;
        const tierY = (t + 0.5) * stepH;
        const tierZ = -t * stepD;

        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(st.len, stepH, stepD), concreteMat);
        stepMesh.position.set(0, tierY, tierZ);
        stepMesh.receiveShadow = true;
        stepMesh.castShadow = true;
        standGroup.add(stepMesh);

        // Populate spectators with team shirts & scarves
        const specSpacing = 1.75;
        const count = Math.floor((st.len - 4) / specSpacing);
        for (let s = 0; s < count; s++) {
          if (s % 12 === 0) continue; // aisles
          const localX = -((count - 1) * specSpacing) * 0.5 + s * specSpacing + (Math.random() - 0.5) * 0.3;
          const localY = (t + 1) * stepH + 0.45;
          const localZ = tierZ + 0.2;

          const cos = Math.cos(st.rotY);
          const sin = Math.sin(st.rotY);
          const wx = st.x + localX * cos + localZ * sin;
          const wz = st.z - localX * sin + localZ * cos;
          const color = palette[(s + t * 3) % palette.length];
          crowdPositions.push({ x: wx, y: localY, z: wz, color });
        }
      }

      if (st.hasRoof) {
        const topY = st.tiers * 1.45 + 4.6;
        const backZ = -(st.tiers - 1) * 1.85;

        // Back grandstand wall
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(st.len, topY, 0.8), concreteMat);
        backWall.position.set(0, topY * 0.5, backZ - 1.1);
        standGroup.add(backWall);

        // Cantilever Roof Canopy
        const roofDepth = st.tiers * 1.85 + 4.8;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(st.len + 2, 0.45, roofDepth), roofMat);
        roof.position.set(0, topY, backZ * 0.45);
        roof.rotation.x = 0.08;
        roof.castShadow = true;
        standGroup.add(roof);

        // Steel truss fascia
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(st.len + 2, 0.55, 0.25), trussMat);
        fascia.position.set(0, topY - 0.35, backZ * 0.45 + roofDepth * 0.5);
        standGroup.add(fascia);
      }

      this.stadiumGroup.add(standGroup);
    }

    // Instanced Crowd Mesh
    const specGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.72, 8);
    const specMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.crowdInstanced = new THREE.InstancedMesh(specGeo, specMat, crowdPositions.length);
    this.crowdInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tmpColor = new THREE.Color();
    for (let i = 0; i < crowdPositions.length; i++) {
      const cp = crowdPositions[i];
      this.dummyObj.position.set(cp.x, cp.y, cp.z);
      this.dummyObj.rotation.set(0, 0, 0);
      const scale = 0.88 + (i % 5) * 0.05;
      this.dummyObj.scale.set(scale, scale, scale);
      this.dummyObj.updateMatrix();
      this.crowdInstanced.setMatrixAt(i, this.dummyObj.matrix);
      this.crowdBaseMatrices.push(this.dummyObj.matrix.clone());
      tmpColor.setHex(cp.color);
      this.crowdInstanced.setColorAt(i, tmpColor);
    }
    this.crowdInstanced.computeBoundingSphere();
    this.stadiumGroup.add(this.crowdInstanced);
  }

  private buildFloodlightTowers(pitch: PitchConfig): void {
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.85,
    });
    const lampMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
    });

    const corners = [
      { x: -(pitch.halfW + 14), z: -(pitch.halfH + 12) },
      { x: pitch.halfW + 14, z: -(pitch.halfH + 12) },
      { x: -(pitch.halfW + 14), z: pitch.halfH + 12 },
      { x: pitch.halfW + 14, z: pitch.halfH + 12 },
    ];

    for (const c of corners) {
      const tower = new THREE.Group();
      tower.position.set(c.x, 0, c.z);

      // Steel lattice mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.95, 28, 8), pylonMat);
      mast.position.y = 14;
      tower.add(mast);

      // Floodlight head bank
      const headFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.2, 0.9), pylonMat);
      headFrame.position.y = 28.5;
      headFrame.lookAt(0, 0, 0);
      tower.add(headFrame);

      // Glowing multi-lamp bank
      const lampPanel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.6), lampMat);
      lampPanel.position.y = 28.4;
      lampPanel.lookAt(0, 0, 0);
      lampPanel.translateZ(0.5);
      tower.add(lampPanel);

      this.stadiumGroup.add(tower);
    }
  }

  /**
   * Builds a giant digital Jumbotron scoreboard suspended high above the North grandstand.
   */
  private buildGiantJumbotron(pitch: PitchConfig): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, 1024, 512);

      // Outer bezel header
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 1024, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PITCHSIDE ARENA • LIVE MATCHDAY', 512, 42);

      // Scoreboard Center Box
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, 90, 944, 380);

      // Team Names
      ctx.font = 'bold 54px "Barlow Condensed", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('HOME TEAM', 220, 210);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('AWAY TEAM', 804, 210);

      // Big Score
      ctx.font = 'bold 120px "Barlow Condensed", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('0 - 0', 512, 290);

      // Match Status Tag
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('● 1ST HALF • 5V5 ARCADE', 512, 410);
    }

    this.scoreboardTexture = new THREE.CanvasTexture(canvas);
    this.scoreboardTexture.colorSpace = THREE.SRGBColorSpace;

    const boardMat = new THREE.MeshStandardMaterial({
      map: this.scoreboardTexture,
      roughness: 0.3,
      metalness: 0.2,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.25,
    });

    const jumbotronGeo = new THREE.BoxGeometry(16, 8, 1.2);
    this.scoreboardMesh = new THREE.Mesh(jumbotronGeo, boardMat);
    this.scoreboardMesh.position.set(0, 22, -(pitch.halfH + 20));
    this.scoreboardMesh.castShadow = true;
    this.stadiumGroup.add(this.scoreboardMesh);
  }

  public update(elapsedTime: number, phase: MatchPhase, _scoringTeam?: TeamId): void {
    // 1. Animate corner flags in stadium wind
    const windAngle = Math.sin(elapsedTime * 4.5) * 0.22;
    for (const flag of this.cornerFlags) {
      flag.rotation.y = windAngle + Math.cos(elapsedTime * 3.2) * 0.12;
    }

    // 2. Animate digital LED perimeter ribbon banner scroll
    if (this.adTexture) {
      this.adScrollOffset = (elapsedTime * 0.05) % 1;
      this.adTexture.offset.x = this.adScrollOffset;
    }

    // 3. Crowd excitement animation
    if (!this.crowdInstanced) return;
    const isGoal = phase === 'GOAL_CELEBRATION';
    if (!isGoal && Math.floor(elapsedTime * 30) % 2 !== 0) return;

    const count = this.crowdBaseMatrices.length;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const baseMat = this.crowdBaseMatrices[i];
      baseMat.decompose(pos, quat, scale);
      if (isGoal) {
        pos.y += Math.abs(Math.sin(elapsedTime * 14 + i * 0.6)) * 0.62;
      } else {
        pos.y += Math.sin(elapsedTime * 3.2 + i * 0.5) * 0.08;
      }
      this.dummyObj.position.copy(pos);
      this.dummyObj.quaternion.copy(quat);
      this.dummyObj.scale.copy(scale);
      this.dummyObj.updateMatrix();
      this.crowdInstanced.setMatrixAt(i, this.dummyObj.matrix);
    }
    this.crowdInstanced.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.pitchTexture?.dispose();
    this.netTexture?.dispose();
    this.adTexture?.dispose();
    this.scoreboardTexture?.dispose();
    this.stadiumGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
