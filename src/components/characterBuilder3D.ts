import * as THREE from 'three';

/**
 * High-relief, sculpted 3D character models for MathQuest 5
 * Crafted with anatomical structure, layered clothing/armor, accessories, and beveled relief
 */

// Shared skin & hair materials
const skinMat = new THREE.MeshStandardMaterial({
  color: 0xfed7aa,
  roughness: 0.55,
  metalness: 0.05,
});

const darkHairMat = new THREE.MeshStandardMaterial({
  color: 0x292524,
  roughness: 0.7,
});

/**
 * Enable shadow casting and receiving for all meshes within a group
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
 * Attach high-relief realistic facial anatomy: sclera, colored iris, pupil,
 * catchlight glint, shaped eyebrows, nose bridge, lips and ears.
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
    eyeColor = 0x2563eb,
    browColor = 0x3f271d,
    headRadius = 0.2,
    hasSmile = true,
    hasNose = true,
    hasEars = true,
  } = options;

  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const irisMat = new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.8 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.7 });

  const eyeZ = headRadius * 0.88;
  const eyeY = headRadius * 0.04;
  const eyeSpread = headRadius * 0.38;

  // Eyes (Left & Right) with deep anatomical relief
  [-eyeSpread, eyeSpread].forEach((ex) => {
    // Sclera (eyeball white base)
    const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.22, 10, 10), scleraMat);
    eyeBase.position.set(ex, eyeY, eyeZ);
    eyeBase.scale.set(1.2, 0.9, 0.4);
    headGroup.add(eyeBase);

    // Colored Iris
    const iris = new THREE.Mesh(new THREE.CylinderGeometry(headRadius * 0.11, headRadius * 0.11, 0.02, 10), irisMat);
    iris.rotation.x = Math.PI / 2;
    iris.position.set(ex, eyeY, eyeZ + 0.04);
    headGroup.add(iris);

    // Black Pupil
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(headRadius * 0.06, headRadius * 0.06, 0.025, 8), pupilMat);
    pupil.rotation.x = Math.PI / 2;
    pupil.position.set(ex, eyeY, eyeZ + 0.045);
    headGroup.add(pupil);

    // Specular Catchlight Glint
    const glint = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.03, 6, 6), glintMat);
    glint.position.set(ex + headRadius * 0.04, eyeY + headRadius * 0.04, eyeZ + 0.055);
    headGroup.add(glint);

    // Sculpted Eyebrow with relief
    const brow = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.34, headRadius * 0.06, headRadius * 0.08), browMat);
    brow.position.set(ex, eyeY + headRadius * 0.24, eyeZ + 0.02);
    brow.rotation.z = ex > 0 ? -0.12 : 0.12;
    headGroup.add(brow);
  });

  // Sculpted Nose with bridge and nostrils
  if (hasNose) {
    const nose = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.18, headRadius * 0.28, headRadius * 0.22), skinMat);
    nose.position.set(0, -headRadius * 0.08, headRadius * 0.96);
    headGroup.add(nose);
  }

  // Sculpted Lips
  if (hasSmile) {
    const lips = new THREE.Mesh(new THREE.BoxGeometry(headRadius * 0.36, headRadius * 0.06, headRadius * 0.08), lipMat);
    lips.position.set(0, -headRadius * 0.32, headRadius * 0.88);
    headGroup.add(lips);
  }

  // Sculpted Ears
  if (hasEars) {
    [-headRadius * 0.98, headRadius * 0.98].forEach((earX) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.22, 8, 8), skinMat);
      ear.scale.set(0.4, 1.2, 0.8);
      ear.position.set(earX, 0, 0);
      headGroup.add(ear);
    });
  }
}

// ============================================================================
// 1. FOREST RUNNER: Athletic sprinter with sneakers, vest badge & visor
// ============================================================================
export interface RunnerCharacterResult {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

export function createRunnerCharacter(): RunnerCharacterResult {
  const root = new THREE.Group();

  // Pelvis / Hips
  const hips = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.2, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
  );
  hips.position.y = 0.45;
  root.add(hips);

  // Athletic Sports Belt with metallic buckle in relief
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.06, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2 })
  );
  belt.position.y = 0.54;
  root.add(belt);

  // Torso / Athletic Jersey
  const jerseyMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.4,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.28), jerseyMat);
  torso.position.y = 0.78;
  torso.castShadow = true;
  root.add(torso);

  // Front Jersey Number Emblem Badge (#3 in relief)
  const badgeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.1,
  });
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), badgeMat);
  badge.position.set(0, 0.8, 0.15);
  root.add(badge);

  const numStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd97706 })
  );
  numStripe.position.set(0, 0.8, 0.17);
  root.add(numStripe);

  // Hydration / Explorer Backpack on back with relief
  const packMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.16), packMat);
  backpack.position.set(0, 0.8, -0.2);
  root.add(backpack);

  // Backpack straps over shoulders
  [-0.14, 0.14].forEach((sx) => {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b })
    );
    strap.position.set(sx, 0.8, 0.14);
    root.add(strap);
  });

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 0.12),
    skinMat
  );
  neck.position.y = 1.05;
  root.add(neck);

  // Head with nose & ears
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.2;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 14),
    skinMat
  );
  headGroup.add(head);

  // Nose relief
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.06),
    skinMat
  );
  nose.position.set(0, -0.01, 0.2);
  headGroup.add(nose);

  // Athletic Running Cap / Visor
  const capMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    capMat
  );
  capDome.position.y = 0.04;
  headGroup.add(capDome);

  // Cap Visor / Peak extending forward
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.04, 0.18),
    capMat
  );
  visor.position.set(0, 0.08, 0.22);
  visor.rotation.x = 0.2;
  headGroup.add(visor);

  // Hair tuft peaking out from under visor
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.08, 0.12),
    darkHairMat
  );
  hair.position.set(0, 0.02, -0.16);
  headGroup.add(hair);

  root.add(headGroup);

  // Athletic Arms (pumping in running stance)
  const armMat = jerseyMat;
  [-0.26, 0.26].forEach((side, idx) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side, 0.95, 0);

    // Shoulder cap / short sleeve
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.08, 0.16),
      armMat
    );
    sleeve.position.y = -0.06;
    armGroup.add(sleeve);

    // Forearm & Hand in fist
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.24),
      skinMat
    );
    forearm.position.set(0, -0.22, 0.06);
    forearm.rotation.x = idx === 0 ? 0.7 : -0.6;
    armGroup.add(forearm);

    // Fist with sports glove
    const glove = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    glove.position.set(0, -0.32, idx === 0 ? 0.14 : -0.04);
    armGroup.add(glove);

    root.add(armGroup);
  });

  // Articulated Running Legs (Thigh + Shin/Sock + Sculpted Sneaker)
  function buildRunnerLeg(): THREE.Group {
    const legGroup = new THREE.Group();

    // Thigh (running shorts)
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.075, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    );
    thigh.position.y = -0.14;
    legGroup.add(thigh);

    // Knee & Shin (White Athletic Sock with Red Stripe)
    const sock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
    );
    sock.position.y = -0.36;
    legGroup.add(sock);

    const sockStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    sockStripe.position.y = -0.28;
    legGroup.add(sockStripe);

    // Sculpted Running Sneaker (White rubber sole + Red/Blue upper + toe cap)
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.48, 0.05);

    // Rubber Sole
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
    );
    sole.position.y = -0.02;
    shoeGroup.add(sole);

    // Sneaker Upper
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.07, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
    );
    shoeGroup.add(upper);

    // Toe Cap
    const toeCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 })
    );
    toeCap.position.set(0, 0, 0.08);
    shoeGroup.add(toeCap);

    legGroup.add(shoeGroup);
    return legGroup;
  }

  const leftLeg = buildRunnerLeg();
  leftLeg.position.set(-0.16, 0.45, 0);
  root.add(leftLeg);

  const rightLeg = buildRunnerLeg();
  rightLeg.position.set(0.16, 0.45, 0);
  root.add(rightLeg);

  enableShadows(root);
  return { group: root, leftLeg, rightLeg };
}

// ============================================================================
// 2. MOUNTAIN HERO KNIGHT: Steel Cuirass with Gold Trim, Pauldrons & Crest Shield
// ============================================================================
export function createKnightHeroCharacter(): { group: THREE.Group; sword: THREE.Group } {
  const root = new THREE.Group();

  // Steel & Gold Materials with metallic shine
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.25,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0x78350f,
    metalness: 0.9,
    roughness: 0.2,
  });

  const tunicMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.5,
  });

  // Tunic Skirt / Faulds
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 0.28, 8),
    tunicMat
  );
  skirt.position.y = 0.42;
  root.add(skirt);

  // Armored Cuirass / Chestplate with beveled pectorals
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.34),
    steelMat
  );
  chest.position.y = 0.78;
  chest.castShadow = true;
  root.add(chest);

  // Golden Breastplate Medallion / Lion Emblem in relief
  const crestMedallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8),
    goldTrimMat
  );
  crestMedallion.rotation.x = Math.PI / 2;
  crestMedallion.position.set(0, 0.82, 0.18);
  root.add(crestMedallion);

  // Gold Trim on collar and waist
  const collarTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.05, 0.36),
    goldTrimMat
  );
  collarTrim.position.y = 1.02;
  root.add(collarTrim);

  const waistTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.06, 0.36),
    goldTrimMat
  );
  waistTrim.position.y = 0.56;
  root.add(waistTrim);

  // Layered Curved Pauldrons (Shoulder Armor with gold bevels)
  [-0.34, 0.34].forEach((px) => {
    const pauldronGroup = new THREE.Group();
    pauldronGroup.position.set(px, 0.95, 0);

    const plateTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      steelMat
    );
    pauldronGroup.add(plateTop);

    const plateRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.03, 6, 12),
      goldTrimMat
    );
    plateRim.rotation.x = Math.PI / 2;
    pauldronGroup.add(plateRim);

    root.add(pauldronGroup);
  });

  // Knight Great Helm with visor and plumage
  const helmGroup = new THREE.Group();
  helmGroup.position.y = 1.25;

  const helm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.36, 12),
    steelMat
  );
  helmGroup.add(helm);

  const helmDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    steelMat
  );
  helmDome.position.y = 0.18;
  helmGroup.add(helmDome);

  // Visor horizontal eye slit in relief
  const visorSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.05, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 })
  );
  visorSlit.position.set(0, 0.04, 0.2);
  helmGroup.add(visorSlit);

  // Helm Crest / Flowing Crimson Feather Plume
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.36, 6),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
  );
  plume.rotation.x = -Math.PI / 3;
  plume.position.set(0, 0.26, -0.12);
  helmGroup.add(plume);

  root.add(helmGroup);

  // Armored Arms & Steel Gauntlets
  [-0.32, 0.32].forEach((ax) => {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.07, 0.4),
      steelMat
    );
    arm.position.set(ax, 0.72, 0.05);
    arm.rotation.x = 0.3;
    root.add(arm);

    // Gauntlet Fist
    const gauntlet = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.14),
      goldTrimMat
    );
    gauntlet.position.set(ax, 0.54, 0.18);
    root.add(gauntlet);
  });

  // Armored Greaves / Boots
  [-0.15, 0.15].forEach((lx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.4, 0.18),
      steelMat
    );
    leg.position.set(lx, 0.2, 0);
    root.add(leg);

    // Solleret (Armored Boot toe)
    const toe = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.1, 0.14),
      goldTrimMat
    );
    toe.position.set(lx, 0.05, 0.08);
    root.add(toe);
  });

  // Embellished Kite Shield (Left Arm)
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.46, 0.72, 0.16);
  shieldGroup.rotation.y = -0.3;

  // Shield Face (Kite Shape)
  const shieldBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.62, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 })
  );
  shieldGroup.add(shieldBase);

  // Golden Shield Rim Relief
  const shieldRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.66, 0.03),
    goldTrimMat
  );
  shieldRim.position.z = -0.01;
  shieldGroup.add(shieldRim);

  // Star Emblem on Shield
  const shieldStar = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12),
    goldTrimMat
  );
  shieldStar.position.z = 0.04;
  shieldGroup.add(shieldStar);

  root.add(shieldGroup);

  // Broadsword with Fuller, Crossguard & Pommel (Right Arm)
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0.44, 0.78, 0.22);
  swordGroup.rotation.z = Math.PI / 4;
  swordGroup.rotation.y = 0.2;

  // Steel Double-Edged Blade with glowing edge
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.95, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      metalness: 0.95,
      roughness: 0.15,
    })
  );
  blade.position.y = 0.45;
  swordGroup.add(blade);

  // Golden Crossguard
  const crossguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.08),
    goldTrimMat
  );
  crossguard.position.y = -0.02;
  swordGroup.add(crossguard);

  // Wrapped Leather Hilt
  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
  );
  hilt.position.y = -0.12;
  swordGroup.add(hilt);

  // Pommel
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    goldTrimMat
  );
  pommel.position.y = -0.22;
  swordGroup.add(pommel);

  root.add(swordGroup);

  enableShadows(root);
  return { group: root, sword: swordGroup };
}

// ============================================================================
// 3. MOUNTAIN GOLEM GUARDIAN: Chiseled Granite with Magma Veins & Horns
// ============================================================================
export function createGolemEnemyCharacter(): { group: THREE.Group } {
  const root = new THREE.Group();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    flatShading: true,
  });

  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    roughness: 0.2,
  });

  // Heavy Rocky Core Pelvis
  const pelvis = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), rockMat);
  pelvis.position.y = 0.55;
  root.add(pelvis);

  // Massive Angular Torso with Overlapping Bedrock Plates
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.7, 0.65), rockMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  root.add(torso);

  // Magma Core Glowing Chest Fissure in relief
  const fissure = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.45, 0.08),
    magmaMat
  );
  fissure.position.set(0, 1.05, 0.32);
  root.add(fissure);

  // Jagged Rock Spine plates along back
  for (let s = 0; s < 3; s++) {
    const spinePlate = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.35, 4),
      rockMat
    );
    spinePlate.position.set(0, 0.8 + s * 0.28, -0.36);
    spinePlate.rotation.x = -Math.PI / 3;
    root.add(spinePlate);
  }

  // Stone Brow & Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.55;

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), rockMat);
  headGroup.add(head);

  // Heavy Chiseled Brow
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), rockMat);
  brow.position.set(0, 0.14, 0.26);
  headGroup.add(brow);

  // Deep-set Glowing Ruby Eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    roughness: 0.1,
  });
  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), eyeMat);
    eye.position.set(ex, 0.06, 0.32);
    headGroup.add(eye);
  });

  // Granite Horns / Spikes on Crown
  [-0.24, 0.24].forEach((hx, i) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), rockMat);
    horn.position.set(hx, 0.32, 0);
    horn.rotation.z = (i === 0 ? 1 : -1) * 0.4;
    headGroup.add(horn);
  });

  root.add(headGroup);

  // Massive Bouldered Arms with Knuckled Stone Fists
  [-0.58, 0.58].forEach((ax) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(ax, 1.2, 0);

    // Shoulder Boulder
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), rockMat);
    armGroup.add(boulder);

    // Arm Column with glowing magma line
    const armCol = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.28), rockMat);
    armCol.position.set(0, -0.35, 0.1);
    armGroup.add(armCol);

    // Stone Fist
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.32), rockMat);
    fist.position.set(0, -0.65, 0.16);
    armGroup.add(fist);

    root.add(armGroup);
  });

  // Rocky Column Legs
  [-0.26, 0.26].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.32), rockMat);
    leg.position.set(lx, 0.25, 0);
    root.add(leg);
  });

  enableShadows(root);
  return { group: root };
}

// ============================================================================
// 4. MERCHANT DON MATEO: Apron with pocket relief, mustache, hat & friendly eyes
// ============================================================================
export function createMerchantCharacter(): { group: THREE.Group; headGroup: THREE.Group } {
  const root = new THREE.Group();

  // Tunic Torso (Tailored violet fabric)
  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.75, 0.42), tunicMat);
  torso.position.y = 0.72;
  root.add(torso);

  // White Shirt Collar showing at neck
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
  );
  collar.position.y = 1.08;
  root.add(collar);

  // Gold Merchant Apron with relief pocket and hem
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.7 });
  const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.05), apronMat);
  apronBib.position.set(0, 0.72, 0.22);
  root.add(apronBib);

  // Apron Front Pocket in tangible relief
  const pocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.18, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 })
  );
  pocket.position.set(0, 0.64, 0.26);
  root.add(pocket);

  // Apron Waist Ties
  const beltTie = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.44), apronMat);
  beltTie.position.y = 0.52;
  root.add(beltTie);

  // Head Group (nodding / animated)
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.28;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), skinMat);
  headGroup.add(head);

  // Prominent Friendly Merchant Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
  nose.position.set(0, -0.02, 0.23);
  headGroup.add(nose);

  // Curled Handlebar Mustache with 3D relief
  const stacheMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
  const stacheL = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 6, 12, Math.PI), stacheMat);
  stacheL.rotation.z = Math.PI / 1.3;
  stacheL.position.set(-0.08, -0.07, 0.22);
  headGroup.add(stacheL);

  const stacheR = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 6, 12, Math.PI), stacheMat);
  stacheR.rotation.z = -Math.PI / 1.3;
  stacheR.position.set(0.08, -0.07, 0.22);
  headGroup.add(stacheR);

  // Smiling mouth
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.015, 6, 10, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xbe123c })
  );
  smile.rotation.x = Math.PI;
  smile.position.set(0, -0.12, 0.2);
  headGroup.add(smile);

  // Baker / Merchant Toque Hat with folded pleats
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16), hatMat);
  hatBand.position.y = 0.22;
  headGroup.add(hatBand);

  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.24, 16), hatMat);
  hatCrown.position.y = 0.38;
  headGroup.add(hatCrown);

  root.add(headGroup);

  // Welcoming Arms with Cuffs
  [-0.44, 0.44].forEach((sx) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.2), tunicMat);
    arm.position.set(sx, 0.72, 0.2);
    arm.rotation.x = Math.PI / 3.5;
    root.add(arm);

    // White Shirt Cuff
    const cuff = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    cuff.position.set(sx, 0.58, 0.32);
    root.add(cuff);

    // Friendly Open Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
    hand.position.set(sx, 0.52, 0.38);
    root.add(hand);
  });

  enableShadows(root);
  return { group: root, headGroup };
}

// ============================================================================
// 5. CUSTOMER: Coat, cross-body satchel with buckle, boots & hairstyle
// ============================================================================
export function createCustomerCharacter(): { group: THREE.Group } {
  const root = new THREE.Group();

  // Coat Torso (Emerald green)
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.36), coatMat);
  torso.position.y = 0.65;
  root.add(torso);

  // Cross-body Leather Satchel Bag with brass buckle
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.38), leatherMat);
  strap.position.set(0, 0.68, 0.04);
  strap.rotation.z = -Math.PI / 4;
  root.add(strap);

  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.14), leatherMat);
  satchel.position.set(0.26, 0.46, 0.16);
  root.add(satchel);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 })
  );
  buckle.position.set(0.26, 0.46, 0.24);
  root.add(buckle);

  // Head with stylish hair
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.18;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
  headGroup.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 10, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
    darkHairMat
  );
  hair.position.y = 0.04;
  headGroup.add(hair);

  root.add(headGroup);

  // Legs in dark jeans & brown walking shoes
  [-0.14, 0.14].forEach((lx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.35, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    leg.position.set(lx, 0.18, 0);
    root.add(leg);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 0.22),
      leatherMat
    );
    shoe.position.set(lx, 0.04, 0.04);
    root.add(shoe);
  });

  enableShadows(root);
  return { group: root };
}

// ============================================================================
// 6. BRIDGE WALKER EXPLORER: Ranger hat, pockets, hiking backpack & staff
// ============================================================================
export function createExplorerCharacter(): { group: THREE.Group } {
  const root = new THREE.Group();

  // Khaki Adventurer Vest
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.32), vestMat);
  torso.position.y = 0.62;
  root.add(torso);

  // Relief Pockets on Vest
  [-0.14, 0.14].forEach((px) => {
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 })
    );
    pocket.position.set(px, 0.62, 0.17);
    root.add(pocket);
  });

  // Heavy Expedition Rucksack on back with rolled bedroll
  const packMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), packMat);
  backpack.position.set(0, 0.66, -0.24);
  root.add(backpack);

  // Rolled Bedroll strapped to top of pack
  const bedroll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
  );
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.92, -0.24);
  root.add(bedroll);

  // Head with Explorer / Safari Hat
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.08;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), skinMat);
  headGroup.add(head);

  // Safari / Ranger Hat (curved brim + crown dent)
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.04, 16), hatMat);
  brim.position.y = 0.12;
  headGroup.add(brim);

  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 14), hatMat);
  hatCrown.position.y = 0.22;
  headGroup.add(hatCrown);

  const hatBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.225, 0.225, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0x451a03 })
  );
  hatBand.position.y = 0.16;
  headGroup.add(hatBand);

  root.add(headGroup);

  // Hiking Walking Staff in right hand
  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
  );
  staff.position.set(0.34, 0.6, 0.16);
  staff.rotation.x = 0.1;
  root.add(staff);

  // Hiking Boots
  [-0.14, 0.14].forEach((lx) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.32, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    leg.position.set(lx, 0.16, 0);
    root.add(leg);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.09, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 })
    );
    boot.position.set(lx, 0.04, 0.04);
    root.add(boot);
  });

  enableShadows(root);
  return { group: root };
}

// ============================================================================
// 7. CASTLE DETECTIVE: Double-breasted Trench Coat, Fedora Hat & Cipher Wand
// ============================================================================
export function createDetectiveCharacter(): { group: THREE.Group; wand: THREE.Mesh } {
  const root = new THREE.Group();

  const coatMat = new THREE.MeshStandardMaterial({
    color: 0x7e22ce,
    roughness: 0.55,
  });

  // Double-Breasted Trench Coat
  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.36), coatMat);
  coat.position.y = 0.68;
  root.add(coat);

  // Coat Lapels in relief
  const lapelL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.32, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x581c87 })
  );
  lapelL.position.set(-0.12, 0.82, 0.19);
  lapelL.rotation.z = -0.2;
  root.add(lapelL);

  const lapelR = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.32, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x581c87 })
  );
  lapelR.position.set(0.12, 0.82, 0.19);
  lapelR.rotation.z = 0.2;
  root.add(lapelR);

  // Red Detective Tie tucked into collar
  const tie = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.24, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xef4444 })
  );
  tie.position.set(0, 0.8, 0.2);
  root.add(tie);

  // Belt with metallic buckle
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.38), coatMat);
  belt.position.y = 0.52;
  root.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85 })
  );
  buckle.position.set(0, 0.52, 0.2);
  root.add(buckle);

  // Head with Pinched Fedora Hat
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.22;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), skinMat);
  headGroup.add(head);

  // Fedora Hat
  const fedoraMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.5 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.03, 16), fedoraMat);
  brim.position.y = 0.14;
  brim.rotation.x = 0.08;
  headGroup.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.22, 14), fedoraMat);
  crown.position.y = 0.24;
  headGroup.add(crown);

  // Golden Hatband
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.225, 0.225, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6 })
  );
  band.position.y = 0.18;
  headGroup.add(band);

  root.add(headGroup);

  // Cipher Wand with Brass Bezel and Glowing Lens
  const wand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, metalness: 0.8 })
  );
  wand.position.set(0.38, 0.8, 0.26);
  wand.rotation.x = Math.PI / 3;
  root.add(wand);

  // Glowing Crystal Lens at the tip of the wand
  const lens = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      metalness: 0.9,
    })
  );
  lens.position.set(0.38, 1.06, 0.42);
  root.add(lens);

  // Polished Detective Boots
  [-0.14, 0.14].forEach((lx) => {
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.36, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.4 })
    );
    boot.position.set(lx, 0.18, 0.02);
    root.add(boot);
  });

  enableShadows(root);
  return { group: root, wand };
}
