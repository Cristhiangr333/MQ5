import * as THREE from 'three';

/**
 * HIGH-DEFINITION REAL ANATOMICAL 3D CHARACTER BUILDER
 * Genuine anatomical skeletal hierarchies with articulated ball-and-socket
 * and hinge joints:
 * - Pelvis, Lumbar Spine & Thoracic Ribcage (breathing, twisting & posture)
 * - Shoulder Ball Joints (Deltoids) -> Biceps/Triceps Capsules
 * - Elbow Hinge Joints (Olecranon) -> Forearm Musculature
 * - Wrist Joints -> Sculpted Hands (Palm, Articulated Thumb & Fingers)
 * - Hip Ball-and-Socket Joints -> Quadriceps & Hamstrings Capsules
 * - Knee Hinge Joints (Patella & Condyles) -> Gastrocnemius Calves & Shins
 * - Ankle Malleolus Joints -> Articulated Feet (Heel, Arch & Toe Box)
 */

// Shared PBR skin and stylized hair materials
const skinToneMat = new THREE.MeshStandardMaterial({
  color: 0xfed7aa,
  roughness: 0.42,
  metalness: 0.04,
});

const darkHairMat = new THREE.MeshStandardMaterial({
  color: 0x18181b,
  roughness: 0.68,
});

const jointMat = new THREE.MeshStandardMaterial({
  color: 0xfbcfe8,
  roughness: 0.5,
  metalness: 0.02,
});

/**
 * Enables shadow casting and receiving for all meshes within a hierarchy
 */
export function enableShadows(group: THREE.Object3D): void {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Creates high-definition stylized face with expressive eyes, iris glints,
 * defined brows, nose bridge, lips and ears.
 */
export function attachDetailedFace(
  headGroup: THREE.Group,
  options: {
    eyeColor?: number;
    browColor?: number;
    headRadius?: number;
    hasSmile?: boolean;
    hasNose?: boolean;
    hasEars?: boolean;
  } = {}
): void {
  const {
    eyeColor = 0x0284c7,
    browColor = 0x1e293b,
    headRadius = 0.22,
    hasSmile = true,
    hasNose = true,
    hasEars = true,
  } = options;

  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15 });
  const irisMat = new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.1, emissive: eyeColor, emissiveIntensity: 0.25 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.7 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });

  const eyeZ = headRadius * 0.88;
  const eyeY = headRadius * 0.04;
  const eyeSpread = headRadius * 0.38;

  // Eyes with Fortnite-style expressive iris, pupil and dual catchlights
  [-eyeSpread, eyeSpread].forEach((ex) => {
    // Sclera (Eyeball)
    const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.22, 12, 10), scleraMat);
    eyeBase.position.set(ex, eyeY, eyeZ);
    eyeBase.scale.set(1.2, 0.9, 0.4);
    headGroup.add(eyeBase);

    // Colored Glowing Iris
    const iris = new THREE.Mesh(new THREE.CylinderGeometry(headRadius * 0.12, headRadius * 0.12, 0.02, 12), irisMat);
    iris.rotation.x = Math.PI / 2;
    iris.position.set(ex, eyeY, eyeZ + 0.04);
    headGroup.add(iris);

    // Dark Pupil
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(headRadius * 0.065, headRadius * 0.065, 0.025, 10), pupilMat);
    pupil.rotation.x = Math.PI / 2;
    pupil.position.set(ex, eyeY, eyeZ + 0.046);
    headGroup.add(pupil);

    // Specular Catchlight Glint
    const glint1 = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.035, 6, 6), glintMat);
    glint1.position.set(ex + headRadius * 0.04, eyeY + headRadius * 0.04, eyeZ + 0.055);
    headGroup.add(glint1);

    // Sculpted Hero Eyebrow
    const brow = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.38, headRadius * 0.07, headRadius * 0.08), browMat);
    brow.position.set(ex, eyeY + headRadius * 0.24, eyeZ + 0.02);
    brow.rotation.z = ex > 0 ? -0.15 : 0.15;
    headGroup.add(brow);
  });

  // Sculpted Nose with bridge
  if (hasNose) {
    const nose = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.18, headRadius * 0.3, headRadius * 0.22), skinToneMat);
    nose.position.set(0, -headRadius * 0.06, headRadius * 0.95);
    headGroup.add(nose);
  }

  // Sculpted Confident Mouth
  if (hasSmile) {
    const lips = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.36, headRadius * 0.06, headRadius * 0.08), lipMat);
    lips.position.set(0, -headRadius * 0.34, headRadius * 0.86);
    headGroup.add(lips);
  }

  // Sculpted Ears
  if (hasEars) {
    [-headRadius * 0.98, headRadius * 0.98].forEach((earX) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.22, 10, 8), skinToneMat);
      ear.scale.set(0.4, 1.2, 0.8);
      ear.position.set(earX, 0, 0);
      headGroup.add(ear);
    });
  }
}

/**
 * Creates an anatomical articulated human arm with Shoulder ball, Bicep capsule,
 * Elbow hinge, Forearm capsule, Wrist joint, and Hand with articulated fingers.
 */
export function buildAnatomicalArm(options: {
  isLeft: boolean;
  shoulderX: number;
  shoulderY: number;
  shoulderZ?: number;
  sleeveMat?: THREE.Material;
  skinMat?: THREE.Material;
  gloveMat?: THREE.Material;
  accentMat?: THREE.Material;
  armScale?: number;
}) {
  const {
    isLeft,
    shoulderX,
    shoulderY,
    shoulderZ = 0,
    sleeveMat = skinToneMat,
    skinMat = skinToneMat,
    gloveMat,
    accentMat,
    armScale = 1.0,
  } = options;

  // 1. Shoulder Pivot Group
  const shoulderGroup = new THREE.Group();
  shoulderGroup.position.set(shoulderX, shoulderY, shoulderZ);

  // Anatomical Shoulder Ball / Deltoid Joint
  const shoulderBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.088 * armScale, 12, 10),
    sleeveMat
  );
  shoulderGroup.add(shoulderBall);

  // Upper Arm (Biceps / Triceps muscle capsule)
  const bicep = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.072 * armScale, 0.16 * armScale, 8, 12),
    skinMat
  );
  bicep.position.y = -0.12 * armScale;
  shoulderGroup.add(bicep);

  // 2. Elbow Hinge Pivot Group (placed at distal humerus)
  const elbowGroup = new THREE.Group();
  elbowGroup.position.set(0, -0.24 * armScale, 0);
  shoulderGroup.add(elbowGroup);

  // Anatomical Elbow Joint Sphere (Olecranon)
  const elbowJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.066 * armScale, 10, 8),
    skinMat
  );
  elbowGroup.add(elbowJoint);

  // Forearm Musculature Capsule (Brachioradialis / Flexors)
  const forearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.064 * armScale, 0.16 * armScale, 8, 12),
    skinMat
  );
  forearm.position.y = -0.11 * armScale;
  elbowGroup.add(forearm);

  // 3. Wrist Pivot Group
  const wristGroup = new THREE.Group();
  wristGroup.position.set(0, -0.22 * armScale, 0);
  elbowGroup.add(wristGroup);

  const wristJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.052 * armScale, 8, 8),
    skinMat
  );
  wristGroup.add(wristJoint);

  // 4. Articulated Hand (Palm, Articulated Thumb & Fingers)
  const handGroup = new THREE.Group();
  wristGroup.add(handGroup);

  const handMaterial = gloveMat || skinMat;

  // Palm
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.088 * armScale, 0.09 * armScale, 0.045 * armScale),
    handMaterial
  );
  palm.position.set(0, -0.05 * armScale, 0.01 * armScale);
  handGroup.add(palm);

  // Articulated Thumb
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018 * armScale, 0.045 * armScale, 4, 8),
    handMaterial
  );
  const thumbSign = isLeft ? 1 : -1;
  thumb.position.set(thumbSign * 0.048 * armScale, -0.04 * armScale, 0.02 * armScale);
  thumb.rotation.z = thumbSign * 0.45;
  thumb.rotation.x = 0.3;
  handGroup.add(thumb);

  // 4 Articulated Knuckles & Fingers
  for (let f = 0; f < 4; f++) {
    const fx = (-0.03 + f * 0.02) * armScale;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014 * armScale, 0.055 * armScale, 4, 8),
      handMaterial
    );
    finger.position.set(fx, -0.1 * armScale, 0.012 * armScale);
    finger.rotation.x = 0.25; // natural relaxed anatomical curl
    handGroup.add(finger);
  }

  // Optional tactical knuckle plate
  if (accentMat) {
    const knuckleGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * armScale, 0.035 * armScale, 0.02 * armScale),
      accentMat
    );
    knuckleGuard.position.set(0, -0.05 * armScale, 0.036 * armScale);
    handGroup.add(knuckleGuard);
  }

  return {
    shoulderGroup,
    shoulderBall,
    bicep,
    elbowGroup,
    elbowJoint,
    forearm,
    wristGroup,
    wristJoint,
    handGroup,
  };
}

/**
 * Creates an anatomical articulated human leg with Hip ball, Thigh capsule,
 * Knee hinge with patella, Calf/Shin capsule, Ankle malleolus, and Foot with heel/arch/toes.
 */
export function buildAnatomicalLeg(options: {
  isLeft: boolean;
  hipX: number;
  hipY: number;
  hipZ?: number;
  pantsMat?: THREE.Material;
  skinMat?: THREE.Material;
  bootMat?: THREE.Material;
  soleMat?: THREE.Material;
  soleGlowMat?: THREE.Material;
  legScale?: number;
}) {
  const {
    isLeft,
    hipX,
    hipY,
    hipZ = 0,
    pantsMat = skinToneMat,
    skinMat = skinToneMat,
    bootMat,
    soleMat,
    soleGlowMat,
    legScale = 1.0,
  } = options;

  // 1. Hip Joint Group (Pivoted at femoral head)
  const hipGroup = new THREE.Group();
  hipGroup.position.set(hipX, hipY, hipZ);

  // Anatomical Hip Joint Ball
  const hipBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.098 * legScale, 12, 10),
    pantsMat
  );
  hipGroup.add(hipBall);

  // Thigh Musculature Capsule (Quadriceps & Hamstrings)
  const thigh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.092 * legScale, 0.22 * legScale, 8, 12),
    pantsMat
  );
  thigh.position.y = -0.15 * legScale;
  hipGroup.add(thigh);

  // 2. Knee Hinge Pivot Group (Pivoted at condyles)
  const kneeGroup = new THREE.Group();
  kneeGroup.position.set(0, -0.30 * legScale, 0);
  hipGroup.add(kneeGroup);

  // Knee Joint Sphere
  const kneeJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.082 * legScale, 10, 8),
    pantsMat
  );
  kneeGroup.add(kneeJoint);

  // Anatomical Patella (Knee Cap)
  const patella = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * legScale, 0.09 * legScale, 0.04 * legScale),
    bootMat || pantsMat
  );
  patella.position.set(0, 0, 0.065 * legScale);
  kneeGroup.add(patella);

  // Calf & Shin Musculature (Gastrocnemius / Tibia)
  const calfMat = bootMat || skinMat;
  const calf = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08 * legScale, 0.22 * legScale, 8, 12),
    calfMat
  );
  calf.position.y = -0.14 * legScale;
  kneeGroup.add(calf);

  // 3. Ankle Joint Group (Pivoted at malleolus)
  const ankleGroup = new THREE.Group();
  ankleGroup.position.set(0, -0.28 * legScale, 0);
  kneeGroup.add(ankleGroup);

  // Malleolus Ankle Bone Joint
  const ankleJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.068 * legScale, 8, 8),
    bootMat || pantsMat
  );
  ankleGroup.add(ankleJoint);

  // 4. Anatomical Foot (Heel Calcaneus, Arch, Sole & Toe Box)
  const footGroup = new THREE.Group();
  footGroup.position.set(0, 0, 0.04 * legScale);
  ankleGroup.add(footGroup);

  const shoeMaterial = bootMat || skinMat;

  // Heel / Ankle Counter
  const heel = new THREE.Mesh(
    new THREE.SphereGeometry(0.068 * legScale, 8, 8),
    shoeMaterial
  );
  heel.position.set(0, -0.04 * legScale, -0.06 * legScale);
  footGroup.add(heel);

  // Foot Upper & Arch
  const footUpper = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * legScale, 0.11 * legScale, 0.22 * legScale),
    shoeMaterial
  );
  footUpper.position.set(0, -0.02 * legScale, 0.04 * legScale);
  footGroup.add(footUpper);

  // Toe Box (Beveled front)
  const toeBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.13 * legScale, 0.075 * legScale, 0.1 * legScale),
    shoeMaterial
  );
  toeBox.position.set(0, -0.038 * legScale, 0.16 * legScale);
  footGroup.add(toeBox);

  // Durable Outsole with High-Traction Tread
  let soleGlowMesh: THREE.Mesh | null = null;
  if (soleMat) {
    const outsole = new THREE.Mesh(
      new THREE.BoxGeometry(0.155 * legScale, 0.04 * legScale, 0.3 * legScale),
      soleMat
    );
    outsole.position.set(0, -0.08 * legScale, 0.05 * legScale);
    footGroup.add(outsole);

    if (soleGlowMat) {
      soleGlowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 * legScale, 0.02 * legScale, 0.28 * legScale),
        soleGlowMat
      );
      soleGlowMesh.position.set(0, -0.07 * legScale, 0.05 * legScale);
      footGroup.add(soleGlowMesh);
    }
  }

  return {
    hipGroup,
    hipBall,
    thigh,
    kneeGroup,
    kneeJoint,
    patella,
    calf,
    ankleGroup,
    ankleJoint,
    footGroup,
    soleGlowMesh,
  };
}

// ============================================================================
// 1. FOREST RUNNER: Real Anatomical Athlete with Articulated Joints
// ============================================================================
export interface RunnerCharacterResult {
  group: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  torso: THREE.Group; // Aliased to chest for backward compatibility
  head: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  leftForearm: THREE.Group;
  leftWrist: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  rightForearm: THREE.Group;
  rightWrist: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  leftShin: THREE.Group; // Aliased to leftKnee
  leftAnkle: THREE.Group;
  leftFoot: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  rightShin: THREE.Group; // Aliased to rightKnee
  rightAnkle: THREE.Group;
  rightFoot: THREE.Group;
  sneakerGlows: THREE.Mesh[];
}

export function createRunnerCharacter(): RunnerCharacterResult {
  const root = new THREE.Group();

  const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    roughness: 0.18,
    metalness: 0.5,
  });
  const jerseyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 });
  const sneakerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const rubberSoleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  // 1. Anatomical Pelvis & Sacrum
  const hips = new THREE.Group();
  hips.position.y = 0.54;
  root.add(hips);

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.21, 0.22, 16),
    shortsMat
  );
  hips.add(pelvisMesh);

  // Tactical Belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 18), beltMat);
  belt.position.y = 0.09;
  hips.add(belt);

  // 2. Anatomical Lumbar Spine (Lower back pivot for natural waist twist & flexion)
  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);

  const lumbarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.22, 0.16, 14),
    jerseyMat
  );
  lumbarMesh.position.y = 0.08;
  spine.add(lumbarMesh);

  // 3. Thoracic Ribcage & Pectorals (Upper chest pivot for breathing & thoracic counter-twist)
  const chest = new THREE.Group();
  chest.position.y = 0.16;
  spine.add(chest);

  // Muscular V-taper Ribcage
  const ribcage = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.18, 8, 14),
    jerseyMat
  );
  ribcage.position.y = 0.16;
  ribcage.scale.set(1.15, 1.0, 0.82);
  chest.add(ribcage);

  // Pectoral Muscle Definition
  [-0.11, 0.11].forEach((px) => {
    const pec = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 0.06),
      jerseyMat
    );
    pec.position.set(px, 0.20, 0.16);
    chest.add(pec);
  });

  // Tactical Neon Harness Straps
  [-0.14, 0.14].forEach((hx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.03), neonCyanMat);
    strap.position.set(hx, 0.18, 0.18);
    chest.add(strap);
  });

  // Runner Energy Battery Core on back
  const batteryPack = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.32, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4, metalness: 0.7 })
  );
  batteryPack.position.set(0, 0.18, -0.19);
  chest.add(batteryPack);

  const batteryCell = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 12), neonCyanMat);
  batteryCell.position.set(0, 0.18, -0.25);
  chest.add(batteryCell);

  // 4. Cervical Spine & Neck
  const neck = new THREE.Group();
  neck.position.y = 0.36;
  chest.add(neck);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.13, 12), skinToneMat);
  neckMesh.position.y = 0.065;
  neck.add(neckMesh);

  // 5. Head (Mounted on cervical spine)
  const head = new THREE.Group();
  head.position.y = 0.13;
  neck.add(head);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), skinToneMat);
  head.add(headMesh);

  attachDetailedFace(head, {
    eyeColor: 0x38bdf8,
    browColor: 0x1e293b,
    headRadius: 0.21,
  });

  // Cap / Cyber Visor
  const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  capDome.position.y = 0.04;
  head.add(capDome);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.18), capMat);
  visor.position.set(0, 0.09, 0.22);
  visor.rotation.x = 0.18;
  head.add(visor);

  // Tactical Audio Headset
  const headset = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 }));
  headset.rotation.z = Math.PI / 2;
  headset.position.set(-0.22, 0.04, 0);
  head.add(headset);

  // Hair
  const hairTuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), darkHairMat);
  hairTuft.position.set(0, 0.04, -0.22);
  hairTuft.rotation.x = -Math.PI / 2.5;
  head.add(hairTuft);

  // 6. Anatomical Upper Limbs (Clavicle / Shoulder -> Elbow -> Wrist -> Hand)
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.29,
    shoulderY: 0.28,
    sleeveMat: jerseyMat,
    skinMat: skinToneMat,
    gloveMat,
    accentMat: neonCyanMat,
  });
  chest.add(leftArmData.shoulderGroup);

  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.29,
    shoulderY: 0.28,
    sleeveMat: jerseyMat,
    skinMat: skinToneMat,
    gloveMat,
    accentMat: neonCyanMat,
  });
  chest.add(rightArmData.shoulderGroup);

  // 7. Anatomical Lower Limbs (Hip -> Thigh -> Knee -> Calf/Shin -> Ankle -> Foot)
  const sneakerGlows: THREE.Mesh[] = [];

  const leftLegData = buildAnatomicalLeg({
    isLeft: true,
    hipX: -0.15,
    hipY: -0.06,
    pantsMat: shortsMat,
    skinMat: skinToneMat,
    bootMat: sneakerMat,
    soleMat: rubberSoleMat,
    soleGlowMat: neonCyanMat,
  });
  hips.add(leftLegData.hipGroup);
  if (leftLegData.soleGlowMesh) sneakerGlows.push(leftLegData.soleGlowMesh);

  const rightLegData = buildAnatomicalLeg({
    isLeft: false,
    hipX: 0.15,
    hipY: -0.06,
    pantsMat: shortsMat,
    skinMat: skinToneMat,
    bootMat: sneakerMat,
    soleMat: rubberSoleMat,
    soleGlowMat: neonCyanMat,
  });
  hips.add(rightLegData.hipGroup);
  if (rightLegData.soleGlowMesh) sneakerGlows.push(rightLegData.soleGlowMesh);

  enableShadows(root);

  return {
    group: root,
    hips,
    spine,
    chest,
    neck,
    torso: chest,
    head,
    leftArm: leftArmData.shoulderGroup,
    leftElbow: leftArmData.elbowGroup,
    leftForearm: leftArmData.elbowGroup,
    leftWrist: leftArmData.wristGroup,
    rightArm: rightArmData.shoulderGroup,
    rightElbow: rightArmData.elbowGroup,
    rightForearm: rightArmData.elbowGroup,
    rightWrist: rightArmData.wristGroup,
    leftLeg: leftLegData.hipGroup,
    leftKnee: leftLegData.kneeGroup,
    leftShin: leftLegData.kneeGroup,
    leftAnkle: leftLegData.ankleGroup,
    leftFoot: leftLegData.footGroup,
    rightLeg: rightLegData.hipGroup,
    rightKnee: rightLegData.kneeGroup,
    rightShin: rightLegData.kneeGroup,
    rightAnkle: rightLegData.ankleGroup,
    rightFoot: rightLegData.footGroup,
    sneakerGlows,
  };
}

// ============================================================================
// 2. MOUNTAIN KNIGHT HERO: Armored Paladin with Anatomical Articulations
// ============================================================================
export interface KnightHeroResult {
  group: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  plume: THREE.Mesh;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  leftForearm: THREE.Group;
  shield: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  rightForearm: THREE.Group;
  sword: THREE.Group;
  bladeGlow: THREE.Mesh;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
}

export function createKnightHeroCharacter(): KnightHeroResult {
  const root = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.90, roughness: 0.2 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.88, roughness: 0.28 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x78350f, metalness: 0.92, roughness: 0.16 });
  const plasmaCyanMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.1, metalness: 0.8 });
  const royalBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 });

  // 1. Hips / Faulds
  const hips = new THREE.Group();
  hips.position.y = 0.54;
  root.add(hips);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.28, 16), royalBlueMat);
  hips.add(skirt);

  const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.05), goldTrimMat);
  tasset.position.set(0, -0.04, 0.19);
  hips.add(tasset);

  // 2. Spine / Waist
  const spine = new THREE.Group();
  spine.position.y = 0.14;
  hips.add(spine);

  // 3. Chest Cuirass
  const chest = new THREE.Group();
  chest.position.y = 0.16;
  spine.add(chest);

  const cuirass = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.25, 0.26, 8, 14),
    steelMat
  );
  cuirass.position.y = 0.16;
  cuirass.scale.set(1.15, 1.0, 0.85);
  chest.add(cuirass);

  // Lion Medallion
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14), goldTrimMat);
  crest.rotation.x = Math.PI / 2;
  crest.position.set(0, 0.22, 0.23);
  chest.add(crest);

  // Gorget
  const gorget = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.38), goldTrimMat);
  gorget.position.y = 0.36;
  chest.add(gorget);

  // 4. Head / Helm
  const head = new THREE.Group();
  head.position.y = 0.46;
  chest.add(head);

  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.36, 16), steelMat);
  head.add(helm);

  const helmDome = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  helmDome.position.y = 0.18;
  head.add(helmDome);

  // Visor
  const eyeLightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  [-0.055, 0.055].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), eyeLightMat);
    eye.position.set(ex, 0.04, 0.22);
    head.add(eye);
  });

  // Plume
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.44, 8), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
  plume.rotation.x = -Math.PI / 2.8;
  plume.position.set(0, 0.28, -0.15);
  head.add(plume);

  // 5. Articulated Arms (with Pauldrons & Gauntlets)
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.36,
    shoulderY: 0.28,
    sleeveMat: steelMat,
    skinMat: darkSteelMat,
    gloveMat: goldTrimMat,
  });
  // Curved Paudron
  const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  leftArmData.shoulderGroup.add(pauldronL);
  chest.add(leftArmData.shoulderGroup);

  // Shield on left forearm
  const shield = new THREE.Group();
  shield.position.set(-0.16, 0, 0.12);
  shield.rotation.y = -0.2;
  const shieldBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.68, 0.06), royalBlueMat);
  shield.add(shieldBase);
  const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.04), goldTrimMat);
  shieldRim.position.z = -0.01;
  shield.add(shieldRim);
  const shieldStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), plasmaCyanMat);
  shieldStar.position.z = 0.05;
  shield.add(shieldStar);
  leftArmData.elbowGroup.add(shield);

  // Right Arm (Sword arm)
  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.36,
    shoulderY: 0.28,
    sleeveMat: steelMat,
    skinMat: darkSteelMat,
    gloveMat: goldTrimMat,
  });
  const pauldronR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), steelMat);
  rightArmData.shoulderGroup.add(pauldronR);
  chest.add(rightArmData.shoulderGroup);

  // Broadsword in right hand
  const sword = new THREE.Group();
  sword.position.set(0, -0.08, 0.12);
  sword.rotation.x = Math.PI / 2;

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.03), steelMat);
  blade.position.y = 0.52;
  sword.add(blade);

  const bladeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.08, 0.04), plasmaCyanMat);
  bladeGlow.position.y = 0.52;
  sword.add(bladeGlow);

  const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.08), goldTrimMat);
  sword.add(crossguard);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18), darkSteelMat);
  hilt.position.y = -0.11;
  sword.add(hilt);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), goldTrimMat);
  pommel.position.y = -0.22;
  sword.add(pommel);

  rightArmData.elbowGroup.add(sword);

  // 6. Articulated Legs (Greaves & Poleyns)
  const leftLegData = buildAnatomicalLeg({
    isLeft: true,
    hipX: -0.16,
    hipY: -0.08,
    pantsMat: steelMat,
    bootMat: goldTrimMat,
    legScale: 1.05,
  });
  hips.add(leftLegData.hipGroup);

  const rightLegData = buildAnatomicalLeg({
    isLeft: false,
    hipX: 0.16,
    hipY: -0.08,
    pantsMat: steelMat,
    bootMat: goldTrimMat,
    legScale: 1.05,
  });
  hips.add(rightLegData.hipGroup);

  enableShadows(root);

  return {
    group: root,
    hips,
    spine,
    chest,
    torso: chest,
    head,
    plume,
    leftArm: leftArmData.shoulderGroup,
    leftElbow: leftArmData.elbowGroup,
    leftForearm: leftArmData.elbowGroup,
    shield,
    rightArm: rightArmData.shoulderGroup,
    rightElbow: rightArmData.elbowGroup,
    rightForearm: rightArmData.elbowGroup,
    sword,
    bladeGlow,
    leftLeg: leftLegData.hipGroup,
    leftKnee: leftLegData.kneeGroup,
    rightLeg: rightLegData.hipGroup,
    rightKnee: rightLegData.kneeGroup,
  };
}

// ============================================================================
// 3. MOUNTAIN GOLEM GUARDIAN: Colossal Volcanic Titan with Articulated Joints
// ============================================================================
export interface GolemEnemyResult {
  group: THREE.Group;
  core: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftFist: THREE.Group;
  rightArm: THREE.Group;
  rightFist: THREE.Group;
  magmaVeins: THREE.Mesh[];
}

export function createGolemEnemyCharacter(): GolemEnemyResult {
  const root = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const darkBasaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });

  const magmaVeins: THREE.Mesh[] = [];

  // Core Pelvis
  const core = new THREE.Group();
  core.position.y = 0.65;
  root.add(core);

  const pelvisMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), darkBasaltMat);
  core.add(pelvisMesh);

  // Massive Torso
  const torso = new THREE.Group();
  torso.position.y = 0.28;
  core.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.72), rockMat);
  chest.position.y = 0.38;
  torso.add(chest);

  // Glowing Magma Fissure Veins
  [-0.18, 0, 0.18].forEach((vx, i) => {
    const vein = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44 + (i === 1 ? 0.12 : 0), 0.08), magmaMat);
    vein.position.set(vx, 0.38, 0.37);
    vein.rotation.z = (i - 1) * 0.2;
    torso.add(vein);
    magmaVeins.push(vein);
  });

  // Spine Spikes
  for (let s = 0; s < 4; s++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), darkBasaltMat);
    spike.position.set(0, 0.2 + s * 0.22, -0.42);
    spike.rotation.x = -Math.PI / 2.6;
    torso.add(spike);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 0.88;
  torso.add(head);

  const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 1), rockMat);
  head.add(headMesh);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.4 });
  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), eyeMat);
    eye.position.set(ex, 0.06, 0.34);
    head.add(eye);
    magmaVeins.push(eye);
  });

  // Horns
  [-0.26, 0.26].forEach((hx, i) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.44, 6), darkBasaltMat);
    horn.position.set(hx, 0.36, 0);
    horn.rotation.z = (i === 0 ? 1 : -1) * 0.45;
    head.add(horn);
  });

  // Articulated Boulder Arms
  function buildGolemArm(isLeft: boolean) {
    const armGroup = new THREE.Group();
    const xPos = isLeft ? -0.68 : 0.68;
    armGroup.position.set(xPos, 0.48, 0);

    const shoulderBoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), darkBasaltMat);
    armGroup.add(shoulderBoulder);

    const bicepCol = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.28), rockMat);
    bicepCol.position.y = -0.28;
    armGroup.add(bicepCol);

    const fistGroup = new THREE.Group();
    fistGroup.position.set(0, -0.5, 0.06);

    const fistMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.38), darkBasaltMat);
    fistGroup.add(fistMesh);

    const fistMagma = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), magmaMat);
    fistMagma.position.set(0, 0, 0.2);
    fistGroup.add(fistMagma);
    magmaVeins.push(fistMagma);

    armGroup.add(fistGroup);
    torso.add(armGroup);
    return { arm: armGroup, fist: fistGroup };
  }

  const leftArmObj = buildGolemArm(true);
  const rightArmObj = buildGolemArm(false);

  // Pillar Legs
  [-0.32, 0.32].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.58, 0.38), rockMat);
    leg.position.set(lx, -0.32, 0);
    core.add(leg);
  });

  enableShadows(root);

  return {
    group: root,
    core,
    torso,
    head,
    leftArm: leftArmObj.arm,
    leftFist: leftArmObj.fist,
    rightArm: rightArmObj.arm,
    rightFist: rightArmObj.fist,
    magmaVeins,
  };
}

// ============================================================================
// 4. MERCHANT DON MATEO: Real Anatomical Artisan Body
// ============================================================================
export interface MerchantCharacterResult {
  group: THREE.Group;
  headGroup: THREE.Group;
  mustacheL: THREE.Mesh;
  mustacheR: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  coinInHand: THREE.Mesh;
}

export function createMerchantCharacter(): MerchantCharacterResult {
  const root = new THREE.Group();

  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.55 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.65 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const goldCoinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, metalness: 0.85, roughness: 0.2 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.76, 0.44), tunicMat);
  torso.position.y = 0.74;
  root.add(torso);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.32), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
  collar.position.y = 1.12;
  root.add(collar);

  const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.05), apronMat);
  apronBib.position.set(0, 0.74, 0.23);
  root.add(apronBib);

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.03), leatherMat);
  pocket.position.set(0, 0.65, 0.27);
  root.add(pocket);

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.3;
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), skinToneMat);
  headGroup.add(head);

  attachDetailedFace(headGroup, {
    eyeColor: 0x451a03,
    browColor: 0x292524,
    headRadius: 0.24,
    hasNose: false,
    hasSmile: false,
  });

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), skinToneMat);
  nose.position.set(0, -0.02, 0.24);
  headGroup.add(nose);

  const stacheMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
  const mustacheL = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 8, 14, Math.PI), stacheMat);
  mustacheL.rotation.z = Math.PI / 1.3;
  mustacheL.position.set(-0.08, -0.07, 0.23);
  headGroup.add(mustacheL);

  const mustacheR = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 8, 14, Math.PI), stacheMat);
  mustacheR.rotation.z = -Math.PI / 1.3;
  mustacheR.position.set(0.08, -0.07, 0.23);
  headGroup.add(mustacheR);

  // Toque Hat
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16), hatMat);
  hatBand.position.y = 0.22;
  headGroup.add(hatBand);

  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.24, 16), hatMat);
  hatCrown.position.y = 0.38;
  headGroup.add(hatCrown);

  // Anatomical Arms
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.44,
    shoulderY: 0.85,
    sleeveMat: tunicMat,
    skinMat: skinToneMat,
  });
  root.add(leftArmData.shoulderGroup);

  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.44,
    shoulderY: 0.85,
    sleeveMat: tunicMat,
    skinMat: skinToneMat,
  });
  root.add(rightArmData.shoulderGroup);

  // Coin in right hand
  const coinInHand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), goldCoinMat);
  coinInHand.rotation.x = Math.PI / 2;
  coinInHand.position.set(0, -0.15, 0.08);
  rightArmData.handGroup.add(coinInHand);

  enableShadows(root);

  return {
    group: root,
    headGroup,
    mustacheL,
    mustacheR,
    leftArm: leftArmData.shoulderGroup,
    rightArm: rightArmData.shoulderGroup,
    coinInHand,
  };
}

// ============================================================================
// 5. CUSTOMER: Real Anatomical Adventurer Body
// ============================================================================
export interface CustomerCharacterResult {
  group: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
}

export function createCustomerCharacter(): CustomerCharacterResult {
  const root = new THREE.Group();

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.36), coatMat);
  torso.position.y = 0.65;
  root.add(torso);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.38), leatherMat);
  strap.position.set(0, 0.68, 0.04);
  strap.rotation.z = -Math.PI / 4;
  root.add(strap);

  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.14), leatherMat);
  satchel.position.set(0.26, 0.46, 0.16);
  root.add(satchel);

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.18;
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), skinToneMat);
  headGroup.add(head);

  attachDetailedFace(headGroup, {
    eyeColor: 0x16a34a,
    browColor: 0x1e293b,
    headRadius: 0.22,
  });

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), darkHairMat);
  hair.position.y = 0.04;
  headGroup.add(hair);

  // Anatomical Arms
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.35,
    shoulderY: 0.78,
    sleeveMat: coatMat,
    skinMat: skinToneMat,
  });
  root.add(leftArmData.shoulderGroup);

  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.35,
    shoulderY: 0.78,
    sleeveMat: coatMat,
    skinMat: skinToneMat,
  });
  root.add(rightArmData.shoulderGroup);

  // Legs with boots
  [-0.14, 0.14].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 6, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }));
    leg.position.set(lx, 0.22, 0);
    root.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), leatherMat);
    shoe.position.set(lx, 0.04, 0.04);
    root.add(shoe);
  });

  enableShadows(root);

  return {
    group: root,
    headGroup,
    leftArm: leftArmData.shoulderGroup,
    rightArm: rightArmData.shoulderGroup,
  };
}

// ============================================================================
// 6. BRIDGE EXPLORER: Real Anatomical Explorer Body with Staff
// ============================================================================
export interface ExplorerCharacterResult {
  group: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  staff: THREE.Group;
  staffCrystal: THREE.Mesh;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
}

export function createExplorerCharacter(): ExplorerCharacterResult {
  const root = new THREE.Group();

  const vestMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    roughness: 0.1,
    metalness: 0.9,
  });

  // Hips
  const hips = new THREE.Group();
  hips.position.y = 0.52;
  root.add(hips);

  const spine = new THREE.Group();
  spine.position.y = 0.12;
  hips.add(spine);

  const chest = new THREE.Group();
  chest.position.y = 0.14;
  spine.add(chest);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.32), vestMat);
  vest.position.y = 0.18;
  chest.add(vest);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), packMat);
  backpack.position.set(0, 0.20, -0.24);
  chest.add(backpack);

  const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 }));
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.44, -0.24);
  chest.add(bedroll);

  // Head with Safari Hat
  const head = new THREE.Group();
  head.position.y = 0.52;
  chest.add(head);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), skinToneMat);
  head.add(headMesh);

  attachDetailedFace(head, {
    eyeColor: 0x0284c7,
    browColor: 0x78350f,
    headRadius: 0.2,
  });

  const hatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.04, 16), hatMat);
  brim.position.y = 0.12;
  head.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 14), hatMat);
  crown.position.y = 0.22;
  head.add(crown);

  // Anatomical Arms
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.32,
    shoulderY: 0.38,
    sleeveMat: vestMat,
    skinMat: skinToneMat,
  });
  chest.add(leftArmData.shoulderGroup);

  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.32,
    shoulderY: 0.38,
    sleeveMat: vestMat,
    skinMat: skinToneMat,
  });
  chest.add(rightArmData.shoulderGroup);

  // Hiking Staff
  const staff = new THREE.Group();
  staff.position.set(0, -0.15, 0.1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 10), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
  staff.add(pole);

  const staffCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), crystalMat);
  staffCrystal.position.y = 0.65;
  staff.add(staffCrystal);

  rightArmData.handGroup.add(staff);

  // Anatomical Legs
  const leftLegData = buildAnatomicalLeg({
    isLeft: true,
    hipX: -0.14,
    hipY: -0.06,
    pantsMat: new THREE.MeshStandardMaterial({ color: 0x334155 }),
    bootMat: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 }),
  });
  hips.add(leftLegData.hipGroup);

  const rightLegData = buildAnatomicalLeg({
    isLeft: false,
    hipX: 0.14,
    hipY: -0.06,
    pantsMat: new THREE.MeshStandardMaterial({ color: 0x334155 }),
    bootMat: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 }),
  });
  hips.add(rightLegData.hipGroup);

  enableShadows(root);

  return {
    group: root,
    hips,
    spine,
    chest,
    torso: chest,
    head,
    leftArm: leftArmData.shoulderGroup,
    leftElbow: leftArmData.elbowGroup,
    rightArm: rightArmData.shoulderGroup,
    rightElbow: rightArmData.elbowGroup,
    staff,
    staffCrystal,
    leftLeg: leftLegData.hipGroup,
    leftKnee: leftLegData.kneeGroup,
    rightLeg: rightLegData.hipGroup,
    rightKnee: rightLegData.kneeGroup,
  };
}

// ============================================================================
// 7. CASTLE DETECTIVE: Real Anatomical Detective Body with Wand
// ============================================================================
export interface DetectiveCharacterResult {
  group: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  wand: THREE.Mesh;
  wandProjection: THREE.Mesh;
}

export function createDetectiveCharacter(): DetectiveCharacterResult {
  const root = new THREE.Group();

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.55 });
  const fedoraMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });

  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.36), coatMat);
  coat.position.y = 0.68;
  root.add(coat);

  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: 0x581c87 }));
  lapelL.position.set(-0.12, 0.82, 0.19);
  lapelL.rotation.z = -0.2;
  root.add(lapelL);

  const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: 0x581c87 }));
  lapelR.position.set(0.12, 0.82, 0.19);
  lapelR.rotation.z = 0.2;
  root.add(lapelR);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.02), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
  tie.position.set(0, 0.8, 0.2);
  root.add(tie);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.22;
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), skinToneMat);
  headGroup.add(head);

  attachDetailedFace(headGroup, {
    eyeColor: 0x38bdf8,
    browColor: 0x3b0764,
    headRadius: 0.21,
  });

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.03, 16), fedoraMat);
  brim.position.y = 0.14;
  brim.rotation.x = 0.08;
  headGroup.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.22, 14), fedoraMat);
  crown.position.y = 0.24;
  headGroup.add(crown);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.05, 14), goldMat);
  band.position.y = 0.18;
  headGroup.add(band);

  // Anatomical Arms
  const leftArmData = buildAnatomicalArm({
    isLeft: true,
    shoulderX: -0.35,
    shoulderY: 0.82,
    sleeveMat: coatMat,
    skinMat: skinToneMat,
  });
  root.add(leftArmData.shoulderGroup);

  const rightArmData = buildAnatomicalArm({
    isLeft: false,
    shoulderX: 0.35,
    shoulderY: 0.82,
    sleeveMat: coatMat,
    skinMat: skinToneMat,
  });
  root.add(rightArmData.shoulderGroup);

  // Wand mounted in right hand
  const wand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.65, 10),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, metalness: 0.8 })
  );
  wand.position.set(0.08, -0.05, 0.2);
  wand.rotation.x = Math.PI / 3;
  rightArmData.handGroup.add(wand);

  const lens = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, metalness: 0.9 })
  );
  lens.position.set(0.08, 0.22, 0.36);
  rightArmData.handGroup.add(lens);

  const wandProjection = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
  );
  wandProjection.rotation.x = -Math.PI / 2.5;
  wandProjection.position.set(0.08, 0.55, 0.9);
  rightArmData.handGroup.add(wandProjection);

  // Boots
  [-0.14, 0.14].forEach((lx) => {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.2), new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 }));
    boot.position.set(lx, 0.18, 0.02);
    root.add(boot);
  });

  enableShadows(root);

  return {
    group: root,
    headGroup,
    leftArm: leftArmData.shoulderGroup,
    rightArm: rightArmData.shoulderGroup,
    wand,
    wandProjection,
  };
}
