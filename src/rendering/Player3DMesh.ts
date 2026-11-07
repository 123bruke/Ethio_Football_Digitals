import * as THREE from 'three';
import { MatchPhase, PlayerRole, PlayerState, TeamKit } from '../types/game';

/**
 * High-fidelity, anatomically proportioned 3D human football player.
 * Features articulated multi-joint limbs (knee/elbow flexion), realistic facial textures,
 * styled modern haircut, athletic V-taper jersey with crest/sponsor/badges,
 * detailed goalkeeper gloves, ribbed socks with shin guards, and aerodynamic cleats with studs.
 */
export class Player3DMesh {
  public readonly root = new THREE.Group();
  public readonly id: string;

  // Body parts
  private readonly pelvisGroup = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();

  // Upper body
  private torsoMesh: THREE.Mesh;
  private neckMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private hairMesh: THREE.Mesh;
  private leftDeltoid: THREE.Mesh;
  private rightDeltoid: THREE.Mesh;

  // Left Arm (Shoulder -> Bicep -> Elbow -> Forearm -> Hand)
  private readonly leftShoulder = new THREE.Group();
  private readonly leftElbow = new THREE.Group();
  private leftUpperArm: THREE.Mesh;
  private leftForearm: THREE.Mesh;
  private leftHand: THREE.Mesh;

  // Right Arm (Shoulder -> Bicep -> Elbow -> Forearm -> Hand)
  private readonly rightShoulder = new THREE.Group();
  private readonly rightElbow = new THREE.Group();
  private rightUpperArm: THREE.Mesh;
  private rightForearm: THREE.Mesh;
  private rightHand: THREE.Mesh;

  // Lower body
  private shortsPelvis: THREE.Mesh;
  private leftShortsLeg: THREE.Mesh;
  private rightShortsLeg: THREE.Mesh;

  // Left Leg (Hip -> Thigh -> Knee -> Calf -> Boot)
  private readonly leftHip = new THREE.Group();
  private readonly leftKnee = new THREE.Group();
  private leftThigh: THREE.Mesh;
  private leftCalf: THREE.Mesh;
  private leftBoot: THREE.Group;

  // Right Leg (Hip -> Thigh -> Knee -> Calf -> Boot)
  private readonly rightHip = new THREE.Group();
  private readonly rightKnee = new THREE.Group();
  private rightThigh: THREE.Mesh;
  private rightCalf: THREE.Mesh;
  private rightBoot: THREE.Group;

  // Dynamic accessories & overlays
  private indicatorChevron: THREE.Mesh;
  private indicatorRing: THREE.Mesh;
  private shadowMesh: THREE.Mesh;
  private jerseyTexture: THREE.CanvasTexture;
  private faceTexture: THREE.CanvasTexture;
  private socksTexture: THREE.CanvasTexture;

  // Animation smoothing
  private currentSpineLean = 0;
  private currentHeadTurn = 0;

  constructor(player: PlayerState, kit: TeamKit) {
    this.id = player.id;
    const isGK = player.role === 'GK';
    const isCaptain = player.number === 10 || player.role === 'GK';
    const primaryColor = isGK ? kit.gkColor : kit.primaryColor;
    const accentColor = kit.accentColor;
    const secondaryColor = kit.secondaryColor;
    const shortsColor = kit.shortsColor;
    const socksColor = kit.socksColor;
    const skinTone = player.skinTone || '#e0ac69';
    const hairColor = player.hairColor || '#1c1917';

    // 1. Procedural High-Resolution Textures
    this.jerseyTexture = this.createDetailedJerseyTexture(
      primaryColor,
      accentColor,
      secondaryColor,
      player.number,
      player.name,
      kit.shortName,
      isGK
    );

    this.faceTexture = this.createRealisticFaceTexture(skinTone, hairColor, player.number);
    this.socksTexture = this.createRibbedSocksTexture(socksColor, accentColor);

    // 2. High-Quality PBR Materials
    const jerseyMat = new THREE.MeshStandardMaterial({
      map: this.jerseyTexture,
      roughness: 0.58,
      metalness: 0.08,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.faceTexture,
      roughness: 0.72,
      metalness: 0.04,
    });

    // Plain skin for limbs
    const bodySkinMat = new THREE.MeshStandardMaterial({
      color: skinTone,
      roughness: 0.75,
      metalness: 0.04,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.88,
      metalness: 0.05,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: shortsColor,
      roughness: 0.62,
      metalness: 0.06,
    });

    const socksMat = new THREE.MeshStandardMaterial({
      map: this.socksTexture,
      roughness: 0.65,
      metalness: 0.04,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: isGK ? 0x0284c7 : 0x0f172a,
      roughness: 0.32,
      metalness: 0.35,
    });

    const studMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.85,
    });

    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.45,
      metalness: 0.2,
    });

    const tapeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.8,
      metalness: 0.02,
    });

    const armbandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.1,
    });

    // 3. Pelvis & Core
    this.pelvisGroup.position.set(0, 0.96, 0);
    this.root.add(this.pelvisGroup);

    // Sculpted shorts pelvic core
    const pelvisGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.32, 14);
    this.shortsPelvis = new THREE.Mesh(pelvisGeo, shortsMat);
    this.shortsPelvis.castShadow = true;
    this.pelvisGroup.add(this.shortsPelvis);

    // Left & Right shorts leg flairs
    const shortsLegGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.34, 12);
    this.leftShortsLeg = new THREE.Mesh(shortsLegGeo, shortsMat);
    this.leftShortsLeg.position.set(-0.16, -0.16, 0);
    this.leftShortsLeg.rotation.z = -0.06;
    this.leftShortsLeg.castShadow = true;
    this.pelvisGroup.add(this.leftShortsLeg);

    this.rightShortsLeg = new THREE.Mesh(shortsLegGeo, shortsMat);
    this.rightShortsLeg.position.set(0.16, -0.16, 0);
    this.rightShortsLeg.rotation.z = 0.06;
    this.rightShortsLeg.castShadow = true;
    this.pelvisGroup.add(this.rightShortsLeg);

    // 4. Torso with Athletic V-Taper
    this.torsoGroup.position.set(0, 0.16, 0);
    this.pelvisGroup.add(this.torsoGroup);

    // Athletic V-tapered chest (wider at lats/shoulders, narrower at waist)
    const torsoGeo = new THREE.CylinderGeometry(0.44, 0.35, 0.68, 16);
    torsoGeo.scale(1.05, 1, 0.72); // Flatten front-to-back for human chest profile
    this.torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
    this.torsoMesh.position.set(0, 0.34, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.torsoGroup.add(this.torsoMesh);

    // 3D Ribbed V-Neck / Crew Collar
    const collarGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 16);
    collarGeo.scale(1, 1, 0.85);
    const collarMesh = new THREE.Mesh(collarGeo, jerseyMat);
    collarMesh.rotation.x = Math.PI * 0.5;
    collarMesh.position.set(0, 0.68, 0);
    this.torsoGroup.add(collarMesh);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.18, 12);
    this.neckMesh = new THREE.Mesh(neckGeo, bodySkinMat);
    this.neckMesh.position.set(0, 0.76, 0.02);
    this.neckMesh.castShadow = true;
    this.torsoGroup.add(this.neckMesh);

    // 5. Head & Styled 3D Hair
    this.headGroup.position.set(0, 0.94, 0.02);
    this.torsoGroup.add(this.headGroup);

    // Anatomical head profile (slightly elongated sphere with jaw taper)
    const headGeo = new THREE.SphereGeometry(0.24, 18, 16);
    headGeo.scale(0.92, 1.15, 1.04);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Ears
    const earHelixGeo = new THREE.TorusGeometry(0.042, 0.012, 8, 12, Math.PI * 1.15);
    const earLobeGeo = new THREE.SphereGeometry(0.02, 8, 8);
    earLobeGeo.scale(0.8, 1.2, 0.6);

    const leftEarGroup = new THREE.Group();
    leftEarGroup.position.set(-0.232, 0.01, -0.02);
    leftEarGroup.rotation.y = -Math.PI * 0.48;
    leftEarGroup.add(new THREE.Mesh(earHelixGeo, bodySkinMat));
    const leftLobe = new THREE.Mesh(earLobeGeo, bodySkinMat);
    leftLobe.position.set(0, -0.038, 0);
    leftEarGroup.add(leftLobe);
    this.headGroup.add(leftEarGroup);

    const rightEarGroup = new THREE.Group();
    rightEarGroup.position.set(0.232, 0.01, -0.02);
    rightEarGroup.rotation.y = Math.PI * 0.48;
    rightEarGroup.add(new THREE.Mesh(earHelixGeo, bodySkinMat));
    const rightLobe = new THREE.Mesh(earLobeGeo, bodySkinMat);
    rightLobe.position.set(0, -0.038, 0);
    rightEarGroup.add(rightLobe);
    this.headGroup.add(rightEarGroup);

    // Anatomical 3D Human Eyes (Sclera, Iris, Pupil, Specular Catchlight & Brow Ridges)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.08,
    });
    const eyeIrisMat = new THREE.MeshStandardMaterial({
      color: 0x451a03, // Rich hazel/brown iris
      roughness: 0.2,
      metalness: 0.15,
    });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const eyeSpecularMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0x9f564a,
      roughness: 0.52,
      metalness: 0.04,
    });
    const browMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.82,
    });

    const create3DEye = (isLeft: boolean) => {
      const eyeGroup = new THREE.Group();
      const scleraGeo = new THREE.SphereGeometry(0.026, 12, 10);
      scleraGeo.scale(1.2, 0.9, 1);
      const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      eyeGroup.add(sclera);

      // Iris disc
      const irisGeo = new THREE.CylinderGeometry(0.0135, 0.0135, 0.005, 12);
      irisGeo.rotateX(Math.PI * 0.5);
      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.position.set(0, 0, 0.018);
      eyeGroup.add(iris);

      // Pupil disc
      const pupilGeo = new THREE.CylinderGeometry(0.0068, 0.0068, 0.006, 10);
      pupilGeo.rotateX(Math.PI * 0.5);
      const pupil = new THREE.Mesh(pupilGeo, eyePupilMat);
      pupil.position.set(0, 0, 0.021);
      eyeGroup.add(pupil);

      // Specular life catchlight
      const specGeo = new THREE.SphereGeometry(0.0028, 6, 6);
      const spec = new THREE.Mesh(specGeo, eyeSpecularMat);
      spec.position.set(0.0035, 0.0035, 0.024);
      eyeGroup.add(spec);

      // Eyelid / Brow Arch
      const browGeo = new THREE.CylinderGeometry(0.006, 0.004, 0.068, 8);
      browGeo.rotateZ(isLeft ? 0.18 : -0.18);
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(0, 0.038, 0.018);
      eyeGroup.add(brow);

      return eyeGroup;
    };

    const leftEye = create3DEye(true);
    leftEye.position.set(-0.076, 0.036, 0.222);
    this.headGroup.add(leftEye);

    const rightEye = create3DEye(false);
    rightEye.position.set(0.076, 0.036, 0.222);
    this.headGroup.add(rightEye);

    // Sculpted 3D Human Nose (Nasal Bridge + Tip + Left/Right Nostril Flares)
    const noseBridgeGeo = new THREE.ConeGeometry(0.029, 0.092, 8);
    noseBridgeGeo.rotateX(-0.25);
    const noseBridge = new THREE.Mesh(noseBridgeGeo, bodySkinMat);
    noseBridge.position.set(0, -0.016, 0.246);
    this.headGroup.add(noseBridge);

    const nostrilGeo = new THREE.SphereGeometry(0.014, 8, 8);
    nostrilGeo.scale(0.8, 0.8, 1.2);
    const leftNostril = new THREE.Mesh(nostrilGeo, bodySkinMat);
    leftNostril.position.set(-0.024, -0.046, 0.234);
    this.headGroup.add(leftNostril);

    const rightNostril = new THREE.Mesh(nostrilGeo, bodySkinMat);
    rightNostril.position.set(0.024, -0.046, 0.234);
    this.headGroup.add(rightNostril);

    // Sculpted 3D Human Lips & Mouth
    const upperLipGeo = new THREE.TorusGeometry(0.038, 0.010, 8, 14, Math.PI * 0.95);
    upperLipGeo.rotateZ(Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
    upperLip.position.set(0, -0.082, 0.220);
    this.headGroup.add(upperLip);

    const lowerLipGeo = new THREE.TorusGeometry(0.034, 0.012, 8, 14, Math.PI * 0.9);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
    lowerLip.position.set(0, -0.102, 0.218);
    this.headGroup.add(lowerLip);

    // Modern athletic textured fade hairstyle with front pompadour & temple taper
    const hairGeo = new THREE.SphereGeometry(0.254, 18, 16);
    hairGeo.scale(0.95, 1.15, 1.06);
    this.hairMesh = new THREE.Mesh(hairGeo, hairMat);
    this.hairMesh.position.set(0, 0.055, -0.02);
    this.hairMesh.castShadow = true;
    this.headGroup.add(this.hairMesh);

    // Front textured athletic volume / pompadour fringe
    const pompadourGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.16, 12);
    pompadourGeo.rotateX(0.42);
    const pompadour = new THREE.Mesh(pompadourGeo, hairMat);
    pompadour.position.set(0, 0.185, 0.14);
    pompadour.castShadow = true;
    this.headGroup.add(pompadour);

    // Sideburns
    const sideburnGeo = new THREE.BoxGeometry(0.02, 0.08, 0.04);
    const leftSideburn = new THREE.Mesh(sideburnGeo, hairMat);
    leftSideburn.position.set(-0.22, 0.04, 0.04);
    this.headGroup.add(leftSideburn);
    const rightSideburn = new THREE.Mesh(sideburnGeo, hairMat);
    rightSideburn.position.set(0.22, 0.04, 0.04);
    this.headGroup.add(rightSideburn);

    // 6. Shoulders & Arms (Articulated at Shoulder and Elbow!)
    const deltoidGeo = new THREE.SphereGeometry(0.13, 12, 10);
    const upperArmGeo = new THREE.CylinderGeometry(0.105, 0.09, 0.34, 12);
    upperArmGeo.translate(0, -0.17, 0); // pivot at top of bicep

    const forearmGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.32, 12);
    forearmGeo.translate(0, -0.16, 0); // pivot at elbow

    // Hand geometry with natural fingers and thumb
    const handGeo = new THREE.BoxGeometry(0.09, 0.15, 0.06);
    handGeo.translate(0, -0.075, 0);

    // Left Arm
    this.leftShoulder.position.set(-0.46, 0.62, 0);
    this.torsoGroup.add(this.leftShoulder);

    this.leftDeltoid = new THREE.Mesh(deltoidGeo, jerseyMat);
    this.leftDeltoid.castShadow = true;
    this.leftShoulder.add(this.leftDeltoid);

    // Captain's Armband on left arm
    if (isCaptain) {
      const armbandGeo = new THREE.CylinderGeometry(0.11, 0.105, 0.12, 12);
      const armbandMesh = new THREE.Mesh(armbandGeo, armbandMat);
      armbandMesh.position.set(0, -0.11, 0);
      this.leftShoulder.add(armbandMesh);
    }

    this.leftUpperArm = new THREE.Mesh(upperArmGeo, isGK ? jerseyMat : bodySkinMat);
    this.leftUpperArm.castShadow = true;
    this.leftShoulder.add(this.leftUpperArm);

    // Left Elbow Pivot
    this.leftElbow.position.set(0, -0.34, 0);
    this.leftShoulder.add(this.leftElbow);

    this.leftForearm = new THREE.Mesh(forearmGeo, isGK ? jerseyMat : bodySkinMat);
    this.leftForearm.castShadow = true;
    this.leftElbow.add(this.leftForearm);

    // Athletic wristband / wrist tape
    const wristTapeGeo = new THREE.CylinderGeometry(0.076, 0.074, 0.08, 10);
    const leftTape = new THREE.Mesh(wristTapeGeo, tapeMat);
    leftTape.position.set(0, -0.26, 0);
    this.leftElbow.add(leftTape);

    this.leftHand = new THREE.Mesh(handGeo, isGK ? gloveMat : bodySkinMat);
    this.leftHand.position.set(0, -0.32, 0);
    this.leftHand.castShadow = true;
    this.leftElbow.add(this.leftHand);

    // Right Arm
    this.rightShoulder.position.set(0.46, 0.62, 0);
    this.torsoGroup.add(this.rightShoulder);

    this.rightDeltoid = new THREE.Mesh(deltoidGeo, jerseyMat);
    this.rightDeltoid.castShadow = true;
    this.rightShoulder.add(this.rightDeltoid);

    this.rightUpperArm = new THREE.Mesh(upperArmGeo, isGK ? jerseyMat : bodySkinMat);
    this.rightUpperArm.castShadow = true;
    this.rightShoulder.add(this.rightUpperArm);

    // Right Elbow Pivot
    this.rightElbow.position.set(0, -0.34, 0);
    this.rightShoulder.add(this.rightElbow);

    this.rightForearm = new THREE.Mesh(forearmGeo, isGK ? jerseyMat : bodySkinMat);
    this.rightForearm.castShadow = true;
    this.rightElbow.add(this.rightForearm);

    const rightTape = new THREE.Mesh(wristTapeGeo, tapeMat);
    rightTape.position.set(0, -0.26, 0);
    this.rightElbow.add(rightTape);

    this.rightHand = new THREE.Mesh(handGeo, isGK ? gloveMat : bodySkinMat);
    this.rightHand.position.set(0, -0.32, 0);
    this.rightHand.castShadow = true;
    this.rightElbow.add(this.rightHand);

    // 7. Legs (Articulated at Hip and Knee with Realistic Backward Flexion!)
    const thighGeo = new THREE.CylinderGeometry(0.165, 0.125, 0.44, 14);
    thighGeo.translate(0, -0.22, 0); // pivot at hip joint

    const calfGeo = new THREE.CylinderGeometry(0.132, 0.095, 0.46, 14);
    calfGeo.translate(0, -0.23, 0); // pivot at knee joint

    // Left Leg
    this.leftHip.position.set(-0.19, -0.06, 0);
    this.pelvisGroup.add(this.leftHip);

    this.leftThigh = new THREE.Mesh(thighGeo, bodySkinMat);
    this.leftThigh.castShadow = true;
    this.leftHip.add(this.leftThigh);

    // Left Knee Pivot
    this.leftKnee.position.set(0, -0.44, 0);
    this.leftHip.add(this.leftKnee);

    // Knee cap contour
    const kneeCapGeo = new THREE.SphereGeometry(0.09, 10, 8);
    kneeCapGeo.scale(1, 1.2, 0.8);
    const leftKneeCap = new THREE.Mesh(kneeCapGeo, socksMat);
    leftKneeCap.position.set(0, 0, 0.05);
    this.leftKnee.add(leftKneeCap);

    this.leftCalf = new THREE.Mesh(calfGeo, socksMat);
    this.leftCalf.castShadow = true;
    this.leftKnee.add(this.leftCalf);

    this.leftBoot = this.createFootballCleat(bootMat, studMat);
    this.leftBoot.position.set(0, -0.46, 0.04);
    this.leftKnee.add(this.leftBoot);

    // Right Leg
    this.rightHip.position.set(0.19, -0.06, 0);
    this.pelvisGroup.add(this.rightHip);

    this.rightThigh = new THREE.Mesh(thighGeo, bodySkinMat);
    this.rightThigh.castShadow = true;
    this.rightHip.add(this.rightThigh);

    // Right Knee Pivot
    this.rightKnee.position.set(0, -0.44, 0);
    this.rightHip.add(this.rightKnee);

    const rightKneeCap = new THREE.Mesh(kneeCapGeo, socksMat);
    rightKneeCap.position.set(0, 0, 0.05);
    this.rightKnee.add(rightKneeCap);

    this.rightCalf = new THREE.Mesh(calfGeo, socksMat);
    this.rightCalf.castShadow = true;
    this.rightKnee.add(this.rightCalf);

    this.rightBoot = this.createFootballCleat(bootMat, studMat);
    this.rightBoot.position.set(0, -0.46, 0.04);
    this.rightKnee.add(this.rightBoot);

    // 8. Player Selection Indicator (Futuristic Neon Chevron & Pulse Ring)
    const indGeo = new THREE.ConeGeometry(0.24, 0.48, 4);
    const indMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: false,
    });
    this.indicatorChevron = new THREE.Mesh(indGeo, indMat);
    this.indicatorChevron.rotation.x = Math.PI;
    this.indicatorChevron.position.y = 2.45;
    this.indicatorChevron.visible = false;
    this.root.add(this.indicatorChevron);

    const ringGeo = new THREE.RingGeometry(0.72, 0.86, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    this.indicatorRing = new THREE.Mesh(ringGeo, ringMat);
    this.indicatorRing.rotation.x = -Math.PI * 0.5;
    this.indicatorRing.position.y = 0.03;
    this.indicatorRing.visible = false;
    this.root.add(this.indicatorRing);

    // 9. Soft Elliptical Turf Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(1.4, 1.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050811,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI * 0.5;
    this.shadowMesh.position.y = 0.02;
    this.root.add(this.shadowMesh);
  }

  /**
   * Builds an aerodynamic modern football cleat with contoured toe box,
   * padded heel counter, laces, sole plate, and 3D studs.
   */
  private createFootballCleat(bootMat: THREE.Material, studMat: THREE.Material): THREE.Group {
    const boot = new THREE.Group();

    // Main boot upper (tapered towards toe)
    const upperGeo = new THREE.BoxGeometry(0.18, 0.14, 0.38);
    const upper = new THREE.Mesh(upperGeo, bootMat);
    upper.position.set(0, 0.04, 0.05);
    upper.castShadow = true;
    boot.add(upper);

    // Curved toe cap
    const toeGeo = new THREE.SphereGeometry(0.10, 10, 8);
    toeGeo.scale(0.88, 0.6, 1.1);
    const toe = new THREE.Mesh(toeGeo, bootMat);
    toe.position.set(0, 0.01, 0.22);
    toe.castShadow = true;
    boot.add(toe);

    // Outsole plate (metallic sheen)
    const soleGeo = new THREE.BoxGeometry(0.19, 0.03, 0.40);
    const sole = new THREE.Mesh(soleGeo, studMat);
    sole.position.set(0, -0.04, 0.06);
    boot.add(sole);

    // 4 Ground Cleat Studs
    const studGeo = new THREE.ConeGeometry(0.025, 0.05, 6);
    const studPositions = [
      [-0.06, -0.07, 0.18],
      [0.06, -0.07, 0.18],
      [-0.06, -0.07, -0.08],
      [0.06, -0.07, -0.08],
    ];
    for (const [sx, sy, sz] of studPositions) {
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.rotation.x = Math.PI;
      stud.position.set(sx, sy, sz);
      boot.add(stud);
    }

    return boot;
  }

  /**
   * Generates a high-definition jersey texture with authentic team crest shield,
   * modern geometric chest panels, sponsor lettering, sleeve badge, and athletic squad numbers.
   */
  private createDetailedJerseyTexture(
    primaryColor: string,
    accentColor: string,
    secondaryColor: string,
    number: number,
    playerName: string,
    clubName: string,
    isGK: boolean
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Rich sports fabric base
      ctx.fillStyle = primaryColor;
      ctx.fillRect(0, 0, 512, 512);

      // 2. Micro-mesh honeycomb fabric weave simulation
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let y = 0; y < 512; y += 4) {
        ctx.fillRect(0, y, 512, 1);
      }

      // 3. Modern athletic chest graphic (chevrons / speed diagonals)
      ctx.fillStyle = accentColor;
      if (isGK) {
        // High-vis GK geometric pattern
        ctx.beginPath();
        ctx.moveTo(0, 80);
        ctx.lineTo(256, 180);
        ctx.lineTo(512, 80);
        ctx.lineTo(512, 140);
        ctx.lineTo(256, 240);
        ctx.lineTo(0, 140);
        ctx.fill();
      } else {
        // Classic athletic chest stripes
        ctx.fillRect(40, 0, 60, 512);
        ctx.fillRect(412, 0, 60, 512);
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(100, 0, 16, 512);
        ctx.fillRect(396, 0, 16, 512);
      }

      // 4. Team Crest Shield on Left Chest
      ctx.save();
      ctx.translate(160, 160);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-24, -28);
      ctx.lineTo(24, -28);
      ctx.lineTo(24, 10);
      ctx.quadraticCurveTo(0, 36, 0, 36);
      ctx.quadraticCurveTo(0, 36, -24, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Shield crest star
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, -32);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(clubName.slice(0, 3).toUpperCase(), 0, 6);
      ctx.restore();

      // 5. Sponsor Logo Across Center Chest
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PITCHSIDE', 256, 250);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeText('PITCHSIDE', 256, 250);

      // 6. Player Name across upper back
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 32px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(playerName.toUpperCase(), 256, 340);

      // 7. Bold Athletic Squad Number on Back
      ctx.font = 'bold 130px "Barlow Condensed", sans-serif';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 14;
      ctx.strokeText(String(number), 256, 440);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(number), 256, 440);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a high-definition human face texture with detailed eyes (sclera/iris/pupil),
   * athletic eyebrows, nose contour, lips, skin tone shading, and athletic hairline fade.
   */
  private createRealisticFaceTexture(skinTone: string, hairColor: string, _seed: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Base skin tone
      ctx.fillStyle = skinTone;
      ctx.fillRect(0, 0, 512, 512);

      // Subtle cheekbone warmth & skin gradient
      const skinGrad = ctx.createRadialGradient(256, 250, 40, 256, 250, 240);
      skinGrad.addColorStop(0, 'rgba(255, 230, 210, 0.22)');
      skinGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.0)');
      skinGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
      ctx.fillStyle = skinGrad;
      ctx.fillRect(0, 0, 512, 512);

      // 2. Athletic Hairline & Side Fade
      ctx.fillStyle = hairColor;
      ctx.fillRect(0, 0, 512, 105);
      // Tapered sideburns
      ctx.fillRect(0, 100, 70, 160);
      ctx.fillRect(442, 100, 70, 160);

      // 3. Eyebrows (Strong athletic arch)
      ctx.fillStyle = hairColor;
      // Left brow
      ctx.beginPath();
      ctx.moveTo(145, 175);
      ctx.quadraticCurveTo(185, 162, 225, 170);
      ctx.quadraticCurveTo(185, 168, 145, 175);
      ctx.fill();
      // Right brow
      ctx.beginPath();
      ctx.moveTo(287, 170);
      ctx.quadraticCurveTo(327, 162, 367, 175);
      ctx.quadraticCurveTo(327, 168, 287, 170);
      ctx.fill();

      // 4. Expressive Eyes
      const drawEye = (cx: number, cy: number) => {
        // Eye socket shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 34, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // White sclera
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris (Deep hazel/brown)
        ctx.fillStyle = '#3b2416';
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // White specular catchlight (makes eyes look alive!)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Upper eyelid lash line
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 28, Math.PI * 0.95, Math.PI * 2.05);
        ctx.stroke();
      };
      drawEye(185, 205);
      drawEye(327, 205);

      // 5. Nose Bridge & Nostrils
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(250, 185);
      ctx.lineTo(248, 260);
      ctx.lineTo(242, 275);
      ctx.lineTo(270, 275);
      ctx.lineTo(264, 260);
      ctx.stroke();

      // Nostril shading
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(244, 274, 3.5, 0, Math.PI * 2);
      ctx.arc(268, 274, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 6. Mouth & Lips
      ctx.fillStyle = 'rgba(180, 80, 80, 0.45)';
      ctx.beginPath();
      ctx.ellipse(256, 325, 32, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Center lip line
      ctx.strokeStyle = 'rgba(60, 20, 20, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(226, 325);
      ctx.quadraticCurveTo(256, 328, 286, 325);
      ctx.stroke();

      // 7. Athletic 5-o'clock shadow / jawline definition
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.beginPath();
      ctx.arc(256, 360, 70, 0, Math.PI);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a realistic ribbed football socks texture with team ring stripes.
   */
  private createRibbedSocksTexture(socksColor: string, accentColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = socksColor;
      ctx.fillRect(0, 0, 128, 256);

      // Top cuff team accent rings
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 16, 128, 18);
      ctx.fillRect(0, 42, 128, 10);

      // Vertical ribbed knit texture
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      for (let x = 0; x < 128; x += 6) {
        ctx.fillRect(x, 0, 2, 256);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Updates multi-joint articulation, human running kinematics, and animations.
   */
  public update(player: PlayerState, isControlled: boolean, dt: number, phase: MatchPhase, elapsed: number): void {
    // 1. Position on Pitch (X, heightY, Z)
    const isCelebrating = player.animState === 'celebrate';
    const jumpY = isCelebrating ? Math.abs(Math.sin(player.animPhase * 1.8)) * 0.95 : 0;
    this.root.position.set(player.x, jumpY, player.y);

    // Smooth rotational facing
    this.root.rotation.y = -player.angle + Math.PI * 0.5;

    // 2. Active Player Indicator (Chevron & Pulse Ring)
    const showIndicator = isControlled && phase !== 'MENU';
    this.indicatorChevron.visible = showIndicator;
    this.indicatorRing.visible = showIndicator;

    if (showIndicator) {
      this.indicatorChevron.position.y = 2.45 + Math.sin(elapsed * 5.0) * 0.14;
      this.indicatorChevron.rotation.y += dt * 3.6;

      const ringPulse = 1.0 + Math.sin(elapsed * 4.0) * 0.12;
      this.indicatorRing.scale.set(ringPulse, ringPulse, 1);
    }

    // 3. Movement kinematics
    const speed = Math.hypot(player.vx, player.vy);
    const isMoving = speed > 0.6;
    const isSprinting = player.animState === 'sprint' || speed > player.maxSpeed * 0.8;
    const strideScale = isSprinting ? 0.92 : player.animState === 'run' ? 0.72 : 0.45;

    // 4. Anatomical Animation State Machine
    if (isCelebrating) {
      // Victory celebration: Arms raised high, jumping with excitement!
      this.leftShoulder.rotation.z = -2.6;
      this.rightShoulder.rotation.z = 2.6;
      this.leftShoulder.rotation.x = Math.sin(elapsed * 8) * 0.3;
      this.rightShoulder.rotation.x = -Math.sin(elapsed * 8) * 0.3;
      this.leftElbow.rotation.x = 0.5;
      this.rightElbow.rotation.x = 0.5;

      this.leftHip.rotation.x = 0.35;
      this.rightHip.rotation.x = -0.35;
      this.leftKnee.rotation.x = -0.65;
      this.rightKnee.rotation.x = -0.2;

      this.torsoGroup.rotation.x = -0.15; // chest out in triumph
      this.pelvisGroup.position.y = 0.96 + jumpY;
    } else if (player.animState === 'tackle') {
      // Pro slide tackle: Lead leg extended along pitch, trailing leg tucked, low center of gravity
      this.leftHip.rotation.x = -1.35;
      this.leftKnee.rotation.x = 0.15; // extended lead leg
      this.rightHip.rotation.x = 0.95;
      this.rightKnee.rotation.x = -1.45; // tucked trailing leg

      this.leftShoulder.rotation.x = 1.1;
      this.rightShoulder.rotation.x = -1.1;
      this.leftElbow.rotation.x = -0.8;
      this.rightElbow.rotation.x = -0.8;

      this.torsoGroup.rotation.x = 0.45;
      this.pelvisGroup.position.y = 0.45; // dropped low to the grass
    } else if (player.animState === 'shoot' || player.animState === 'pass') {
      // Dynamic kicking motion: Kicking leg winds up & snaps through, arms balance
      const kickPower = player.animState === 'shoot' ? 1.3 : 0.85;
      this.rightHip.rotation.x = -1.25 * kickPower;
      this.rightKnee.rotation.x = 0.35; // snap forward
      this.leftHip.rotation.x = 0.55;
      this.leftKnee.rotation.x = -0.4; // firmly planted support leg

      this.leftShoulder.rotation.x = -1.1;
      this.rightShoulder.rotation.x = 0.85;
      this.leftElbow.rotation.x = -0.6;
      this.rightElbow.rotation.x = -0.7;

      this.torsoGroup.rotation.x = 0.25;
      this.pelvisGroup.position.y = 0.92;
    } else if (isMoving) {
      // NATURAL HUMAN RUNNING CADENCE:
      // Includes true knee flexion (knee bends backwards on up-stride) & elbow pump!
      const cycle = player.animPhase;
      const legSwing = Math.sin(cycle) * strideScale;

      // Hips swing forward/back
      this.leftHip.rotation.x = legSwing;
      this.rightHip.rotation.x = -legSwing;

      // Realistic backward knee flexion!
      // When a leg swings backwards, the knee bends sharply backwards
      const leftKneeBend = legSwing < 0 ? Math.sin(-legSwing * Math.PI) * (isSprinting ? -1.35 : -0.95) : -0.15;
      const rightKneeBend = legSwing > 0 ? Math.sin(legSwing * Math.PI) * (isSprinting ? -1.35 : -0.95) : -0.15;
      this.leftKnee.rotation.x = leftKneeBend;
      this.rightKnee.rotation.x = rightKneeBend;

      // Opposite arm swings with natural ~70-90° bent elbows
      const armSwing = -legSwing * 0.9;
      this.leftShoulder.rotation.x = armSwing;
      this.rightShoulder.rotation.x = -armSwing;
      this.leftShoulder.rotation.z = -0.15;
      this.rightShoulder.rotation.z = 0.15;

      // Arms maintain bent athletic pump posture
      this.leftElbow.rotation.x = -0.95 + Math.cos(cycle) * 0.25;
      this.rightElbow.rotation.x = -0.95 - Math.cos(cycle) * 0.25;

      // Athletic forward torso lean (proportional to sprint intensity)
      const targetLean = isSprinting ? 0.28 : 0.16;
      this.currentSpineLean = THREE.MathUtils.lerp(this.currentSpineLean, targetLean, 0.15);
      this.torsoGroup.rotation.x = this.currentSpineLean;

      // Counter-rotation of shoulders relative to hips (spinal twist)
      this.torsoGroup.rotation.y = -legSwing * 0.22;

      // Natural vertical pelvic bounce per footfall
      const footfallBounce = Math.abs(Math.sin(cycle * 2)) * (isSprinting ? 0.08 : 0.04);
      this.pelvisGroup.position.y = 0.96 + footfallBounce;

      // Dynamic head stability
      this.headGroup.rotation.x = -this.currentSpineLean * 0.7; // keep head level
    } else {
      // IDLE ATHLETIC STANCE: Breathing, alert ready-pose, slight weight shifting
      const breath = Math.sin(elapsed * 2.2) * 0.02;

      this.leftHip.rotation.x = 0.05;
      this.rightHip.rotation.x = -0.05;
      this.leftKnee.rotation.x = -0.08;
      this.rightKnee.rotation.x = -0.08;

      this.leftShoulder.rotation.x = 0.08;
      this.rightShoulder.rotation.x = 0.08;
      this.leftShoulder.rotation.z = -0.18;
      this.rightShoulder.rotation.z = 0.18;

      // Relaxed arms at sides
      this.leftElbow.rotation.x = -0.32;
      this.rightElbow.rotation.x = -0.32;

      this.torsoGroup.rotation.x = 0.04 + breath;
      this.torsoGroup.rotation.y = 0;
      this.headGroup.rotation.x = -0.04;
      this.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.12; // observing pitch
      this.pelvisGroup.position.y = 0.96 + breath * 0.5;
    }
  }

  public dispose(): void {
    this.jerseyTexture.dispose();
    this.faceTexture.dispose();
    this.socksTexture.dispose();
    this.root.traverse((obj) => {
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
