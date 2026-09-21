import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { WORLDS } from '../data/worldsData';
import { GameMode } from '../types';
import {
  createRunnerCharacter,
  createKnightHeroCharacter,
  createGolemEnemyCharacter,
  createMerchantCharacter,
  createCustomerCharacter,
  createExplorerCharacter,
  createDetectiveCharacter,
} from './characterBuilder3D';

interface ThreeWorldCanvasProps {
  viewMode: 'map' | 'game';
  currentWorldId: string;
  gameMode: GameMode;
  questionIndex: number;
  totalQuestions: number;
  isCorrect: boolean | null;
  heroHp: number;
  enemyHp: number;
  bridgeBuiltSegments: number;
  raceProgress?: number;
  shopCartTotal?: number;
  cluesFound?: number;
  onSelectWorld?: (worldId: string) => void;
  onWebGLError?: () => void;
}

export const ThreeWorldCanvas: React.FC<ThreeWorldCanvasProps> = ({
  viewMode,
  currentWorldId,
  gameMode,
  questionIndex,
  totalQuestions,
  isCorrect,
  heroHp,
  enemyHp,
  bridgeBuiltSegments,
  raceProgress = 0,
  shopCartTotal = 0,
  cluesFound = 0,
  onSelectWorld,
  onWebGLError,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Keep onSelectWorld in ref so re-renders don't teardown WebGL
  const onSelectWorldRef = useRef(onSelectWorld);
  onSelectWorldRef.current = onSelectWorld;

  // Dynamic references for animated scene objects
  const runnerGroupRef = useRef<THREE.Group | null>(null);
  const runnerLeftLegRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const runnerRightLegRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const trackPathMeshRef = useRef<THREE.Mesh | null>(null);
  const heroFighterRef = useRef<THREE.Group | null>(null);
  const enemyFighterRef = useRef<THREE.Group | null>(null);
  const bridgeSegmentsGroupRef = useRef<THREE.Group | null>(null);
  const bridgeWalkerRef = useRef<THREE.Group | null>(null);
  const castleRunesRef = useRef<THREE.Mesh[]>([]);

  // Shop 3D elements
  const shopMerchantRef = useRef<THREE.Group | null>(null);
  const shopMerchantHeadRef = useRef<THREE.Group | null>(null);
  const shopCustomerRef = useRef<THREE.Group | null>(null);
  const shopCoinsMeshRef = useRef<THREE.Mesh | null>(null);
  const shopProductMeshRef = useRef<THREE.Group | null>(null);
  const shopBasketGroupRef = useRef<THREE.Group | null>(null);
  const shopCashboxRef = useRef<THREE.Mesh | null>(null);

  // Castle 3D elements
  const castleDoorLeftRef = useRef<THREE.Group | null>(null);
  const castleDoorRightRef = useRef<THREE.Group | null>(null);
  const castleLockBarsRef = useRef<THREE.Mesh[]>([]);
  const castleDetectiveRef = useRef<THREE.Group | null>(null);
  const castleBeamMeshRef = useRef<THREE.Mesh | null>(null);
  const castleChestRef = useRef<THREE.Group | null>(null);

  const cloudsGroupRef = useRef<THREE.Group | null>(null);
  const mapIslandsRef = useRef<{ id: string; group: THREE.Group; mesh: THREE.Mesh }[]>([]);

  // Camera targets for smooth lerp
  const targetCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 10, 15));
  const targetCamLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const currentCamLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Drag interaction for orbital panning in Map mode
  const isDragging = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const mapRotationAngle = useRef(0);

  // Setup Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#142138');
    scene.fog = new THREE.FogExp2('#142138', 0.022);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 12, 16);
    cameraRef.current = camera;

    // 3. Renderer with safe WebGL creation
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      console.warn('WebGL Renderer initialization failed, switching to illustrated mode:', err);
      onWebGLError?.();
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
    sunLight.position.set(12, 20, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    scene.add(sunLight);

    const blueHemisphere = new THREE.HemisphereLight(0x4488ff, 0x112244, 0.6);
    scene.add(blueHemisphere);

    // 5. Water Plane (Deep stylized ocean)
    const waterGeo = new THREE.PlaneGeometry(80, 80, 24, 24);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x17315e,
      roughness: 0.3,
      metalness: 0.4,
      flatShading: true,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -2.5;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // 6. Floating Clouds
    const cloudsGroup = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const cloudGeo = new THREE.DodecahedronGeometry(1.2 + Math.random() * 0.8, 1);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        roughness: 0.9,
      });
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 35,
        2.5 + Math.random() * 4,
        (Math.random() - 0.5) * 35
      );
      cloud.scale.set(1.8 + Math.random(), 0.6 + Math.random() * 0.4, 1 + Math.random());
      cloudsGroup.add(cloud);
    }
    scene.add(cloudsGroup);
    cloudsGroupRef.current = cloudsGroup;

    // Resize Handler via ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };

    window.addEventListener('resize', handleResize);

    // 7. Click / Tap raycaster for World Map Island selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      isDragging.current = true;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - prevMousePos.current.x;
      mapRotationAngle.current += deltaX * 0.005;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      isDragging.current = false;
      // If click was stationary, detect island click
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const interactableMeshes = mapIslandsRef.current.map((item) => item.mesh);
      const intersects = raycaster.intersectObjects(interactableMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const matched = mapIslandsRef.current.find((item) => item.mesh === hit);
        if (matched && onSelectWorldRef.current) {
          onSelectWorldRef.current(matched.id);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);

      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Build the appropriate 3D world elements whenever viewMode or currentWorldId changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean previous world objects (except base lights, water, and clouds)
    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach((child) => {
      if (child.name.startsWith('custom_world_')) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((c) => scene.remove(c));

    mapIslandsRef.current = [];
    runnerGroupRef.current = null;
    heroFighterRef.current = null;
    enemyFighterRef.current = null;
    bridgeSegmentsGroupRef.current = null;
    castleRunesRef.current = [];

    const rootGroup = new THREE.Group();
    rootGroup.name = 'custom_world_root';

    if (viewMode === 'map') {
      // Setup Map Camera
      targetCamPos.current.set(0, 11, 15);
      targetCamLookAt.current.set(0, 0, 0);

      // Render all 5 interconnected floating islands
      WORLDS.forEach((world) => {
        const islandGroup = new THREE.Group();
        islandGroup.position.set(...world.islandPosition);

        // Island base (inverted cone cliff)
        const cliffGeo = new THREE.ConeGeometry(2.3, 2.5, 6);
        const cliffMat = new THREE.MeshStandardMaterial({
          color: 0x6e4e2a,
          roughness: 0.9,
          flatShading: true,
        });
        const cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
        cliffMesh.rotation.x = Math.PI;
        cliffMesh.position.y = -1.2;
        cliffMesh.castShadow = true;
        cliffMesh.receiveShadow = true;
        islandGroup.add(cliffMesh);

        // Island top grass plate
        const grassGeo = new THREE.CylinderGeometry(2.3, 2.4, 0.4, 6);
        const grassColor =
          world.id === 'bosque'
            ? 0x48bb5a
            : world.id === 'montana'
            ? 0xd8a038
            : world.id === 'ciudad'
            ? 0x8b5cf6
            : world.id === 'rio'
            ? 0x38bdf8
            : 0xd946ef;

        const grassMat = new THREE.MeshStandardMaterial({
          color: grassColor,
          roughness: 0.5,
          flatShading: true,
        });
        const grassMesh = new THREE.Mesh(grassGeo, grassMat);
        grassMesh.position.y = 0.1;
        grassMesh.castShadow = true;
        grassMesh.receiveShadow = true;
        islandGroup.add(grassMesh);

        // Island feature model
        if (world.id === 'bosque') {
          // Stylized trees
          for (let i = 0; i < 3; i++) {
            const treeTrunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.14, 0.6, 5),
              new THREE.MeshStandardMaterial({ color: 0x5a3b1d })
            );
            const angle = (i * Math.PI * 2) / 3;
            treeTrunk.position.set(Math.cos(angle) * 0.9, 0.5, Math.sin(angle) * 0.9);
            const foliage = new THREE.Mesh(
              new THREE.DodecahedronGeometry(0.55, 1),
              new THREE.MeshStandardMaterial({ color: 0x228b38, roughness: 0.6 })
            );
            foliage.position.y = 0.5;
            treeTrunk.add(foliage);
            islandGroup.add(treeTrunk);
          }
        } else if (world.id === 'montana') {
          // Rocky peak
          const peak = new THREE.Mesh(
            new THREE.ConeGeometry(1.2, 1.8, 5),
            new THREE.MeshStandardMaterial({ color: 0x94816c, roughness: 0.8, flatShading: true })
          );
          peak.position.y = 1;
          islandGroup.add(peak);
          const snowCap = new THREE.Mesh(
            new THREE.ConeGeometry(0.6, 0.8, 5),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
          );
          snowCap.position.y = 1.5;
          islandGroup.add(snowCap);
        } else if (world.id === 'ciudad') {
          // Buildings
          const building1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.2, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x6d44a6 })
          );
          building1.position.set(-0.5, 0.8, 0);
          islandGroup.add(building1);

          const building2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 1.6, 0.9),
            new THREE.MeshStandardMaterial({ color: 0x7c4ebf })
          );
          building2.position.set(0.4, 1.0, 0.3);
          islandGroup.add(building2);
        } else if (world.id === 'rio') {
          // Water canal and mini arch bridge
          const arch = new THREE.Mesh(
            new THREE.TorusGeometry(0.7, 0.15, 6, 8, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 })
          );
          arch.rotation.z = -Math.PI;
          arch.position.set(0, 0.5, 0);
          islandGroup.add(arch);
        } else if (world.id === 'castillo') {
          // Castle towers
          const castleTower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.45, 1.6, 7),
            new THREE.MeshStandardMaterial({ color: 0x701a75, flatShading: true })
          );
          castleTower.position.y = 1.0;
          const spire = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1.0, 7),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b })
          );
          spire.position.y = 1.3;
          castleTower.add(spire);
          islandGroup.add(castleTower);
        }

        // Floating status beacon / marker
        const beaconGeo = new THREE.OctahedronGeometry(0.35);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: world.id === currentWorldId ? 0xffea00 : 0xffffff,
          emissive: world.id === currentWorldId ? 0xcc9900 : 0x222222,
          roughness: 0.2,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.y = 2.4;
        islandGroup.add(beaconMesh);

        rootGroup.add(islandGroup);
        mapIslandsRef.current.push({ id: world.id, group: islandGroup, mesh: grassMesh });
      });

      // Connecting energy arches between islands
      const curveCoords: [number, number, number][] = [
        [-6, 0.5, 3],
        [-2.5, 1.8, -1.5],
        [2, 0.8, -3.5],
        [5.5, -0.2, 0.5],
        [1.5, 3.2, 4.2],
        [-6, 0.5, 3],
      ];

      for (let i = 0; i < curveCoords.length - 1; i++) {
        const start = new THREE.Vector3(...curveCoords[i]);
        const end = new THREE.Vector3(...curveCoords[i + 1]);
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.5, 0));
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(24);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineDashedMaterial({
          color: 0xfde047,
          dashSize: 0.4,
          gapSize: 0.3,
          linewidth: 2,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.computeLineDistances();
        rootGroup.add(line);
      }
    } else {
      // GAME MODE SCENE
      if (gameMode === 'race') {
        // WORLD 1: BOSQUE — Carrera 3D Track
        targetCamPos.current.set(0, 4.2, 8.5);
        targetCamLookAt.current.set(0, 1.2, 0);

        // Ground track plane
        const trackGeo = new THREE.BoxGeometry(6, 0.4, 26);
        const trackMat = new THREE.MeshStandardMaterial({
          color: 0x48a554,
          roughness: 0.6,
          flatShading: true,
        });
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.position.set(0, 0, 0);
        trackMesh.receiveShadow = true;
        rootGroup.add(trackMesh);

        // Dirt Path
        const pathGeo = new THREE.BoxGeometry(2.6, 0.42, 26);
        const pathMat = new THREE.MeshStandardMaterial({
          color: 0xc8b27e,
          roughness: 0.8,
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);
        pathMesh.position.set(0, 0.01, 0);
        pathMesh.receiveShadow = true;
        rootGroup.add(pathMesh);
        trackPathMeshRef.current = pathMesh;

        // Side trees along the track
        for (let i = -10; i <= 10; i += 2.5) {
          [-2.2, 2.2].forEach((xSide) => {
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6),
              new THREE.MeshStandardMaterial({ color: 0x5a3b1d })
            );
            trunk.position.set(xSide + (Math.random() - 0.5) * 0.4, 0.5, i);
            const foliage = new THREE.Mesh(
              new THREE.DodecahedronGeometry(0.65, 1),
              new THREE.MeshStandardMaterial({ color: 0x228b38, roughness: 0.5 })
            );
            foliage.position.y = 0.65;
            trunk.add(foliage);
            rootGroup.add(trunk);
          });
        }

        // Finish Line Banner at z = -10
        const postMat = new THREE.MeshStandardMaterial({ color: 0x27272a });
        const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5), postMat);
        postL.position.set(-1.4, 1.25, -10);
        const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5), postMat);
        postR.position.set(1.4, 1.25, -10);
        rootGroup.add(postL);
        rootGroup.add(postR);

        const banner = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.5, 0.05),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
        );
        banner.position.set(0, 2.2, -10);
        rootGroup.add(banner);

        // 3D Runner Character (Sculpted high-relief athletic model)
        const runnerObj = createRunnerCharacter();
        runnerObj.group.position.set(0, 0.2, 4);
        runnerLeftLegRef.current = runnerObj.leftLeg;
        runnerRightLegRef.current = runnerObj.rightLeg;
        rootGroup.add(runnerObj.group);
        runnerGroupRef.current = runnerObj.group;
      } else if (gameMode === 'battle') {
        // WORLD 2: MONTAÑA — Batalla en Arena 3D
        targetCamPos.current.set(0, 5, 9);
        targetCamLookAt.current.set(0, 1.2, 0);

        // Floating Arena Island
        const arenaGeo = new THREE.CylinderGeometry(5, 4.2, 1.2, 16);
        const arenaMat = new THREE.MeshStandardMaterial({
          color: 0x854d0e,
          roughness: 0.8,
          flatShading: true,
        });
        const arenaMesh = new THREE.Mesh(arenaGeo, arenaMat);
        arenaMesh.position.y = 0;
        arenaMesh.receiveShadow = true;
        rootGroup.add(arenaMesh);

        // Arena surface ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(2.4, 2.7, 24),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.61;
        rootGroup.add(ring);

        // Surrounding rocky spikes
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          const rock = new THREE.Mesh(
            new THREE.ConeGeometry(0.6, 1.8 + Math.random() * 0.8, 5),
            new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9, flatShading: true })
          );
          rock.position.set(Math.cos(angle) * 5.2, 0.8, Math.sin(angle) * 5.2);
          rootGroup.add(rock);
        }

        // Hero Knight Fighter (Steel cuirass, pauldrons, plume & kite shield)
        const heroObj = createKnightHeroCharacter();
        heroObj.group.position.set(-2.2, 0.6, 0);
        heroObj.group.rotation.y = Math.PI / 2;
        rootGroup.add(heroObj.group);
        heroFighterRef.current = heroObj.group;

        // Enemy Mountain Golem (Chiseled bedrock, magma core & horns)
        const enemyObj = createGolemEnemyCharacter();
        enemyObj.group.position.set(2.2, 0.6, 0);
        enemyObj.group.rotation.y = -Math.PI / 2;
        rootGroup.add(enemyObj.group);
        enemyFighterRef.current = enemyObj.group;
      } else if (gameMode === 'shop') {
        // WORLD 3: CIUDAD — Mercado Real de Don Mateo 3D
        targetCamPos.current.set(0, 4.4, 7.2);
        targetCamLookAt.current.set(0, 1.3, 0);

        // Cobblestone town square ground
        const plaza = new THREE.Mesh(
          new THREE.CylinderGeometry(5.5, 5, 0.6, 18),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85, flatShading: true })
        );
        plaza.position.y = 0;
        plaza.receiveShadow = true;
        rootGroup.add(plaza);

        // Market Stall Counter
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 1.0, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 })
        );
        counter.position.set(0, 0.8, 0);
        counter.castShadow = true;
        counter.receiveShadow = true;
        rootGroup.add(counter);

        // Awning pillars & canopy
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
        [-1.6, 1.6].forEach((px) => {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6), poleMat);
          pole.position.set(px, 1.7, 0);
          rootGroup.add(pole);
        });

        // Striped Awning
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(3.8, 0.16, 2.0),
          new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.35 })
        );
        canopy.position.set(0, 2.8, 0.1);
        canopy.rotation.x = 0.15;
        rootGroup.add(canopy);

        // Merchant Don Mateo (Sculpted apron with pocket, curled mustache, toque & cuffs)
        const merchantObj = createMerchantCharacter();
        merchantObj.group.position.set(0, 0.3, -1.2);
        rootGroup.add(merchantObj.group);
        shopMerchantRef.current = merchantObj.group;
        shopMerchantHeadRef.current = merchantObj.headGroup;

        // Wooden Cash Register / Coin Box on merchant counter (right side)
        const cashbox = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.3, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 })
        );
        cashbox.position.set(0.9, 1.45, -0.3);
        rootGroup.add(cashbox);
        shopCashboxRef.current = cashbox;

        // Customer's Wicker Shopping Basket on front counter (left side)
        const basket = new THREE.Group();
        basket.position.set(-0.85, 1.35, 0.35);

        const bRim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.3, 0.32, 12),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 })
        );
        basket.add(bRim);

        // Handle
        const handle = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.04, 6, 12, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xb45309 })
        );
        handle.position.y = 0.18;
        handle.rotation.x = Math.PI / 2;
        basket.add(handle);

        // Visual items inside customer's basket
        const boughtCount = Math.max(0, shopCartTotal || questionIndex);
        for (let b = 0; b < Math.min(boughtCount, 5); b++) {
          const itemInBasket = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshStandardMaterial({ color: b % 2 === 0 ? 0xef4444 : 0x38bdf8 })
          );
          itemInBasket.position.set((b % 2) * 0.14 - 0.07, 0.1 + b * 0.05, Math.floor(b / 2) * 0.12 - 0.06);
          basket.add(itemInBasket);
        }

        rootGroup.add(basket);
        shopBasketGroupRef.current = basket;

        // Customer Avatar in foreground (Sculpted coat, satchel bag & boots)
        const customerObj = createCustomerCharacter();
        customerObj.group.position.set(0, 0.3, 1.8);
        rootGroup.add(customerObj.group);
        shopCustomerRef.current = customerObj.group;

        // Active Golden Coins stack (held by customer, ready to pay)
        const coinsGroup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            metalness: 0.8,
            roughness: 0.2,
          })
        );
        coinsGroup.position.set(0.1, 1.25, 1.2);
        rootGroup.add(coinsGroup);
        shopCoinsMeshRef.current = coinsGroup;

        // Active Product being purchased (rests on merchant stand, ready to deliver)
        const productGroup = new THREE.Group();
        productGroup.position.set(0, 1.45, -0.2);

        // Glowing Apple / Potion item
        const appleMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0x991b1b,
            roughness: 0.3,
          })
        );
        productGroup.add(appleMesh);

        // Small stem
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x15803d })
        );
        stem.position.y = 0.18;
        productGroup.add(stem);

        rootGroup.add(productGroup);
        shopProductMeshRef.current = productGroup;
      } else if (gameMode === 'bridge') {
        // WORLD 4: RÍO — Puente Flotante 3D
        targetCamPos.current.set(0, 5, 8.5);
        targetCamLookAt.current.set(0, 1.0, 0);

        // River Gorge (Two cliff sides)
        const cliffLeft = new THREE.Mesh(
          new THREE.BoxGeometry(4, 3, 7),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
        );
        cliffLeft.position.set(-5, 0.5, 0);
        rootGroup.add(cliffLeft);

        const cliffRight = new THREE.Mesh(
          new THREE.BoxGeometry(4, 3, 7),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
        );
        cliffRight.position.set(5, 0.5, 0);
        rootGroup.add(cliffRight);

        // Water surface between cliffs
        const waterRiver = new THREE.Mesh(
          new THREE.PlaneGeometry(8, 7),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 })
        );
        waterRiver.rotation.x = -Math.PI / 2;
        waterRiver.position.set(0, -0.6, 0);
        rootGroup.add(waterRiver);

        // Dynamic Bridge Segments Group
        const bridgeGroup = new THREE.Group();
        bridgeSegmentsGroupRef.current = bridgeGroup;
        rootGroup.add(bridgeGroup);

        // Character walking across the bridge (Sculpted explorer with ranger hat, vest pockets, pack & staff)
        const walkerObj = createExplorerCharacter();
        const walkerX = -2.6 + (bridgeBuiltSegments / Math.max(1, totalQuestions)) * 5.2;
        walkerObj.group.position.set(walkerX, 1.2, 0);
        walkerObj.group.rotation.y = Math.PI / 2;
        rootGroup.add(walkerObj.group);
        bridgeWalkerRef.current = walkerObj.group;
      } else if (gameMode === 'detective') {
        // WORLD 5: CASTILLO — Gran Portón Acorazado y Cerrojos Mecánicos 3D
        targetCamPos.current.set(0, 4.4, 8.2);
        targetCamLookAt.current.set(0, 1.5, 0);

        // Fortress Stone Courtyard Floor
        const courtyard = new THREE.Mesh(
          new THREE.CylinderGeometry(6.0, 5.5, 0.6, 18),
          new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.9, flatShading: true })
        );
        courtyard.position.y = 0;
        courtyard.receiveShadow = true;
        rootGroup.add(courtyard);

        // Massive Stone Wall Portal
        const wallLeft = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 5.0, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
        );
        wallLeft.position.set(-2.8, 2.5, -0.8);
        rootGroup.add(wallLeft);

        const wallRight = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 5.0, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
        );
        wallRight.position.set(2.8, 2.5, -0.8);
        rootGroup.add(wallRight);

        // Gothic Arch Top
        const archTop = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 1.2, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
        );
        archTop.position.set(0, 4.4, -0.8);
        rootGroup.add(archTop);

        // Torches with fire on the wall sides
        [-2.0, 2.0].forEach((tx) => {
          const torchSconce = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.04, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x78350f })
          );
          torchSconce.position.set(tx, 2.8, -0.15);
          rootGroup.add(torchSconce);

          const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.12, 0.28, 8),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b })
          );
          flame.position.set(tx, 3.1, -0.15);
          rootGroup.add(flame);
        });

        // Interior Golden Vault Chamber (revealed when doors open)
        const chestGroup = new THREE.Group();
        chestGroup.position.set(0, 1.1, -2.4);

        const chestBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.6, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            metalness: 0.85,
            roughness: 0.2,
          })
        );
        chestGroup.add(chestBase);

        const chestLid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xb45309,
            metalness: 0.9,
          })
        );
        chestLid.rotation.z = Math.PI / 2;
        chestLid.position.y = 0.3;
        chestGroup.add(chestLid);

        rootGroup.add(chestGroup);
        castleChestRef.current = chestGroup;

        // Double Heavy Oak Vault Doors (hinged on left and right)
        const doorLeft = new THREE.Group();
        doorLeft.position.set(-1.5, 1.9, -0.8);
        const dMeshL = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 3.4, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
        );
        dMeshL.position.x = 0.75;
        doorLeft.add(dMeshL);
        rootGroup.add(doorLeft);
        castleDoorLeftRef.current = doorLeft;

        const doorRight = new THREE.Group();
        doorRight.position.set(1.5, 1.9, -0.8);
        const dMeshR = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 3.4, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
        );
        dMeshR.position.x = -0.75;
        doorRight.add(dMeshR);
        rootGroup.add(doorRight);
        castleDoorRightRef.current = doorRight;

        // Initial door rotation based on unlocked enigmas
        const currentUnlocked = cluesFound || questionIndex;
        if (currentUnlocked >= 5) {
          doorLeft.rotation.y = -1.2;
          doorRight.rotation.y = 1.2;
        } else {
          doorLeft.rotation.y = -currentUnlocked * 0.08;
          doorRight.rotation.y = currentUnlocked * 0.08;
        }

        // 5 Heavy Iron Cross-Bolts horizontally locking the doors
        castleLockBarsRef.current = [];
        const startY = 0.9;
        const boltSpacing = 0.5;

        for (let i = 0; i < 5; i++) {
          const isUnlocked = i < currentUnlocked;
          const isCurrent = i === questionIndex;

          const boltGeo = new THREE.BoxGeometry(1.8, 0.22, 0.28);
          const boltMat = new THREE.MeshStandardMaterial({
            color: isUnlocked ? 0x10b981 : isCurrent ? 0xf59e0b : 0x64748b,
            emissive: isUnlocked ? 0x065f46 : isCurrent ? 0x78350f : 0x000000,
            metalness: 0.7,
            roughness: 0.3,
          });
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(isUnlocked ? 2.4 : 0, startY + i * boltSpacing, -0.65);
          rootGroup.add(bolt);
          castleLockBarsRef.current.push(bolt);
        }

        // Detective Character in left foreground (Trench coat with lapels, fedora hat, cipher wand & boots)
        const detObj = createDetectiveCharacter();
        detObj.group.position.set(-1.8, 0.3, 2.2);
        detObj.group.rotation.y = Math.PI / 4;
        rootGroup.add(detObj.group);
        castleDetectiveRef.current = detObj.group;

        // Cipher Ray Light Beam (connecting wand to lock bar)
        const beamGeo = new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0,
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(-0.9, 1.4, 0.8);
        beam.rotation.x = Math.PI / 2.6;
        beam.rotation.z = -Math.PI / 6;
        rootGroup.add(beam);
        castleBeamMeshRef.current = beam;
      }
    }

    scene.add(rootGroup);
  }, [viewMode, currentWorldId, gameMode, totalQuestions, bridgeBuiltSegments, questionIndex]);

  // Update Dynamic Bridge Segments and advance walker when bridgeBuiltSegments changes
  useEffect(() => {
    if (gameMode !== 'bridge' || !bridgeSegmentsGroupRef.current) return;
    const group = bridgeSegmentsGroupRef.current;
    // Clear existing
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const totalSegs = totalQuestions || 5;
    const startX = -2.6;
    const endX = 2.6;
    const step = (endX - startX) / totalSegs;

    for (let i = 0; i < totalSegs; i++) {
      const isBuilt = i < bridgeBuiltSegments;
      const segGroup = new THREE.Group();
      segGroup.position.set(startX + step * i + step * 0.5, 0, 0);

      // Timber bridge deck span
      const deckGeo = new THREE.BoxGeometry(step * 0.94, 0.22, 1.8);
      const deckMat = new THREE.MeshStandardMaterial({
        color: isBuilt ? 0xd97706 : 0x334155,
        roughness: isBuilt ? 0.4 : 0.8,
        emissive: isBuilt ? 0x78350f : 0x000000,
        flatShading: true,
      });
      const deck = new THREE.Mesh(deckGeo, deckMat);
      deck.position.y = isBuilt ? 1.0 : -0.3;
      segGroup.add(deck);

      // Stone pier foundation pillar rising from river bed
      const pierGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8);
      const pierMat = new THREE.MeshStandardMaterial({
        color: isBuilt ? 0x64748b : 0x1e293b,
        roughness: 0.7,
      });
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.y = isBuilt ? 0.3 : -0.4;
      segGroup.add(pier);

      // Wooden side handrails when built
      if (isBuilt) {
        [-0.8, 0.8].forEach((zPos) => {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(step * 0.9, 0.08, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x92400e })
          );
          rail.position.set(0, 1.35, zPos);
          segGroup.add(rail);
        });
      }

      group.add(segGroup);
    }

    // Move 3D walker forward onto the newest constructed bridge pier
    if (bridgeWalkerRef.current) {
      const targetWalkerX = startX + (bridgeBuiltSegments / totalSegs) * (endX - startX);
      bridgeWalkerRef.current.position.x = targetWalkerX;
      bridgeWalkerRef.current.position.y = 1.2;
    }
  }, [bridgeBuiltSegments, totalQuestions, gameMode]);

  // Handle Response Animation (Race real advance/retreat, Battle real contact strike, etc.)
  useEffect(() => {
    if (isCorrect === null) return;

    if (gameMode === 'race' && runnerGroupRef.current) {
      const runner = runnerGroupRef.current;
      const startZ = runner.position.z;
      const startTime = performance.now();

      if (isCorrect) {
        // High-speed sprint surge forward towards the finish line
        const targetZ = THREE.MathUtils.lerp(4, -8, Math.min(1, (raceProgress || 0) / 100));
        const sprintAnim = (time: number) => {
          const elapsed = (time - startTime) / 420;
          if (elapsed < 1 && runnerGroupRef.current) {
            runner.position.y = 0.2 + Math.sin(elapsed * Math.PI) * 0.45;
            runner.position.z = THREE.MathUtils.lerp(startZ, targetZ, elapsed);
            runner.rotation.x = Math.sin(elapsed * Math.PI) * 0.3; // Lean forward into sprint
            requestAnimationFrame(sprintAnim);
          } else if (runnerGroupRef.current) {
            runner.position.y = 0.2;
            runner.position.z = targetZ;
            runner.rotation.x = 0;
          }
        };
        requestAnimationFrame(sprintAnim);
      } else {
        // RETROCEDER SI PIERDE: runner trips, stumbles backward along the track
        const retreatZ = Math.min(4.5, startZ + 1.6);
        const tripAnim = (time: number) => {
          const elapsed = (time - startTime) / 500;
          if (elapsed < 0.4) {
            // Initial trip/stumble
            const phase = elapsed / 0.4;
            runner.position.y = 0.2 + Math.sin(phase * Math.PI) * 0.25;
            runner.rotation.x = -Math.sin(phase * Math.PI) * 0.45; // Lean backward
            runner.rotation.z = Math.sin(phase * Math.PI * 3) * 0.15; // Stumble wobble
          } else if (elapsed < 1.0) {
            // Sliding backward along track
            const phase = (elapsed - 0.4) / 0.6;
            runner.position.z = THREE.MathUtils.lerp(startZ, retreatZ, phase);
            runner.rotation.x = -0.45 * (1 - phase);
            runner.rotation.z = 0;
            runner.position.y = 0.2;
          } else {
            runner.position.z = retreatZ;
            runner.rotation.x = 0;
            runner.rotation.z = 0;
            runner.position.y = 0.2;
          }
          if (elapsed < 1.0) requestAnimationFrame(tripAnim);
        };
        requestAnimationFrame(tripAnim);
      }
    } else if (gameMode === 'battle') {
      if (isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Hero athletic direct dash-slash contact attack
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalHeroX = hero.position.x;
        const originalHeroY = 0.6;
        const enemyOriginalX = 1.8;
        const startTime = performance.now();
        const attackAnim = (time: number) => {
          const elapsed = (time - startTime) / 480;
          if (elapsed < 0.45) {
            // Dash all the way into enemy melee range
            const phase = elapsed / 0.45;
            hero.position.x = THREE.MathUtils.lerp(originalHeroX, enemyOriginalX - 0.7, phase);
            hero.position.y = originalHeroY + Math.sin(phase * Math.PI) * 0.5;
            hero.rotation.z = -Math.sin(phase * Math.PI) * 0.4;
          } else if (elapsed < 0.7) {
            // Direct strike contact & enemy violent knockback
            const phase = (elapsed - 0.45) / 0.25;
            hero.position.x = enemyOriginalX - 0.7;
            hero.rotation.z = 0.1;
            enemy.position.x = THREE.MathUtils.lerp(enemyOriginalX, enemyOriginalX + 0.8, phase);
            enemy.rotation.z = Math.sin(phase * Math.PI * 4) * 0.35;
          } else if (elapsed < 1.0) {
            // Hero leaps back to safety, enemy recovers
            const phase = (elapsed - 0.7) / 0.3;
            hero.position.x = THREE.MathUtils.lerp(enemyOriginalX - 0.7, originalHeroX, phase);
            hero.position.y = originalHeroY;
            hero.rotation.z = 0;
            enemy.position.x = THREE.MathUtils.lerp(enemyOriginalX + 0.8, enemyOriginalX, phase);
            enemy.rotation.z = 0;
          } else {
            hero.position.x = originalHeroX;
            hero.position.y = originalHeroY;
            hero.rotation.z = 0;
            enemy.rotation.z = 0;
            enemy.position.x = enemyOriginalX;
          }
          if (elapsed < 1.0) requestAnimationFrame(attackAnim);
        };
        requestAnimationFrame(attackAnim);
      } else if (!isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Enemy boulder slam direct smash counter-attack
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalEnemyX = enemy.position.x;
        const originalHeroX = -1.8;
        const startTime = performance.now();
        const enemyAnim = (time: number) => {
          const elapsed = (time - startTime) / 500;
          if (elapsed < 0.45) {
            // Enemy charges across the arena straight to the Hero
            const phase = elapsed / 0.45;
            enemy.position.x = THREE.MathUtils.lerp(originalEnemyX, originalHeroX + 0.8, phase);
            enemy.position.y = 0.6 + Math.sin(phase * Math.PI) * 0.6;
          } else if (elapsed < 0.7) {
            // Fists smash down onto Hero, Hero gets knocked back
            const phase = (elapsed - 0.45) / 0.25;
            enemy.position.x = originalHeroX + 0.8;
            enemy.position.y = 0.6;
            hero.position.x = THREE.MathUtils.lerp(originalHeroX, originalHeroX - 0.9, phase);
            hero.rotation.z = -Math.sin(phase * Math.PI * 3) * 0.45;
          } else if (elapsed < 1.0) {
            // Enemy returns to position, Hero recovers
            const phase = (elapsed - 0.7) / 0.3;
            enemy.position.x = THREE.MathUtils.lerp(originalHeroX + 0.8, originalEnemyX, phase);
            hero.position.x = THREE.MathUtils.lerp(originalHeroX - 0.9, originalHeroX, phase);
            hero.rotation.z = 0;
          } else {
            enemy.position.x = originalEnemyX;
            enemy.position.y = 0.6;
            hero.position.x = originalHeroX;
            hero.rotation.z = 0;
          }
          if (elapsed < 1.0) requestAnimationFrame(enemyAnim);
        };
        requestAnimationFrame(enemyAnim);
      }
    } else if (gameMode === 'bridge' && bridgeWalkerRef.current) {
      const walker = bridgeWalkerRef.current;
      const totalSegs = totalQuestions || 5;
      const startX = -2.6;
      const endX = 2.6;
      const currentX = walker.position.x;
      const targetX = startX + (bridgeBuiltSegments / totalSegs) * (endX - startX);
      const startTime = performance.now();

      if (isCorrect) {
        // Physical leap across to the newly placed bridge span
        const leapAnim = (time: number) => {
          const elapsed = (time - startTime) / 450;
          if (elapsed < 1 && bridgeWalkerRef.current) {
            walker.position.x = THREE.MathUtils.lerp(currentX, targetX, elapsed);
            walker.position.y = 1.2 + Math.sin(elapsed * Math.PI) * 0.6;
            requestAnimationFrame(leapAnim);
          } else if (bridgeWalkerRef.current) {
            walker.position.x = targetX;
            walker.position.y = 1.2;
          }
        };
        requestAnimationFrame(leapAnim);
      } else {
        // Stumble backward away from the open canyon gap
        const stumbleAnim = (time: number) => {
          const elapsed = (time - startTime) / 400;
          if (elapsed < 1 && bridgeWalkerRef.current) {
            walker.position.x = currentX - Math.sin(elapsed * Math.PI) * 0.35;
            walker.rotation.z = Math.sin(elapsed * Math.PI * 4) * 0.25;
            requestAnimationFrame(stumbleAnim);
          } else if (bridgeWalkerRef.current) {
            walker.position.x = currentX;
            walker.rotation.z = 0;
          }
        };
        requestAnimationFrame(stumbleAnim);
      }
    } else if (gameMode === 'shop' && shopCoinsMeshRef.current && shopProductMeshRef.current) {
      const coins = shopCoinsMeshRef.current;
      const product = shopProductMeshRef.current;
      const merchantHead = shopMerchantHeadRef.current;
      const startTime = performance.now();

      const initialCoinsPos = new THREE.Vector3(0.1, 1.25, 1.2);
      const targetCoinsPos = new THREE.Vector3(0.9, 1.5, -0.3); // into Don Mateo's cashbox

      const initialProdPos = new THREE.Vector3(0, 1.45, -0.2);
      const targetProdPos = new THREE.Vector3(-0.85, 1.4, 0.35); // into player's shopping basket

      if (isCorrect) {
        // Physical purchase transaction:
        // 1. Coins fly arc into merchant's register
        // 2. Purchased item arcs into customer's shopping basket
        // 3. Merchant nods head and gives item
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 600;
          if (elapsed < 0.5) {
            const p = elapsed / 0.5;
            coins.position.lerpVectors(initialCoinsPos, targetCoinsPos, p);
            coins.position.y = initialCoinsPos.y + Math.sin(p * Math.PI) * 0.85;
            coins.rotation.z = p * Math.PI * 4;
          } else if (elapsed < 1.0) {
            coins.position.copy(targetCoinsPos);
            const p = (elapsed - 0.5) / 0.5;
            product.position.lerpVectors(initialProdPos, targetProdPos, p);
            product.position.y = initialProdPos.y + Math.sin(p * Math.PI) * 0.7;
            product.scale.set(1 + Math.sin(p * Math.PI) * 0.25, 1 + Math.sin(p * Math.PI) * 0.25, 1 + Math.sin(p * Math.PI) * 0.25);
            if (merchantHead) {
              merchantHead.rotation.x = Math.sin(p * Math.PI * 2) * 0.2;
            }
          } else {
            coins.position.copy(initialCoinsPos);
            coins.rotation.z = 0;
            product.position.copy(initialProdPos);
            product.scale.set(1, 1, 1);
            if (merchantHead) merchantHead.rotation.x = 0;
          }
          if (elapsed < 1.0) requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
      } else {
        // Incorrect: Merchant shakes head 'No', coins bounce back, product remains unpurchased
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 480;
          if (elapsed < 1.0) {
            if (merchantHead) {
              merchantHead.rotation.y = Math.sin(elapsed * Math.PI * 6) * 0.35;
            }
            coins.position.z = initialCoinsPos.z - Math.sin(elapsed * Math.PI) * 0.25;
            requestAnimationFrame(anim);
          } else {
            if (merchantHead) merchantHead.rotation.y = 0;
            coins.position.copy(initialCoinsPos);
          }
        };
        requestAnimationFrame(anim);
      }
    } else if (gameMode === 'detective' && castleLockBarsRef.current.length > 0) {
      const activeIdx = Math.min(questionIndex, 4);
      const activeBar = castleLockBarsRef.current[activeIdx];
      const beam = castleBeamMeshRef.current;
      const doorLeft = castleDoorLeftRef.current;
      const doorRight = castleDoorRightRef.current;
      const startTime = performance.now();

      if (isCorrect && activeBar) {
        // 1. Golden beam shoots from detective's cipher wand to active lock bar
        // 2. Lock bar mechanically slides into the right stone wall recess (x = 2.4)
        // 3. Castle vault doors creak open wider, revealing treasure chest chamber
        const startX = activeBar.position.x;
        const targetX = 2.4;

        const anim = (time: number) => {
          const elapsed = (time - startTime) / 650;
          if (beam) {
            (beam.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(elapsed, 1.0) * Math.PI) * 0.95;
          }

          if (elapsed < 1.0) {
            activeBar.position.x = THREE.MathUtils.lerp(startX, targetX, elapsed);
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xfbbf24);
              activeBar.material.emissive.setHex(0xd97706);
            }
            const openFactor = Math.min((questionIndex + 1) / 5, 1.0);
            const maxAngle = questionIndex >= 4 ? 1.25 : openFactor * 0.65;
            if (doorLeft) doorLeft.rotation.y = -THREE.MathUtils.lerp(0, maxAngle, elapsed);
            if (doorRight) doorRight.rotation.y = THREE.MathUtils.lerp(0, maxAngle, elapsed);

            requestAnimationFrame(anim);
          } else {
            activeBar.position.x = targetX;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0x10b981);
              activeBar.material.emissive.setHex(0x065f46);
            }
            if (beam) {
              (beam.material as THREE.MeshBasicMaterial).opacity = 0;
            }
          }
        };
        requestAnimationFrame(anim);
      } else if (!isCorrect && activeBar) {
        // Bolt rattles stubbornly against the oak gate with warning red vibration
        const originalX = activeBar.position.x;
        const anim = (time: number) => {
          const elapsed = (time - startTime) / 450;
          if (elapsed < 1.0) {
            activeBar.position.x = originalX + Math.sin(elapsed * Math.PI * 8) * 0.12;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xef4444);
              activeBar.material.emissive.setHex(0x991b1b);
            }
            requestAnimationFrame(anim);
          } else {
            activeBar.position.x = originalX;
            if (activeBar.material instanceof THREE.MeshStandardMaterial) {
              activeBar.material.color.setHex(0xf59e0b);
              activeBar.material.emissive.setHex(0x78350f);
            }
          }
        };
        requestAnimationFrame(anim);
      }
    }
  }, [isCorrect, gameMode, heroHp, enemyHp, raceProgress, bridgeBuiltSegments, questionIndex, totalQuestions, cluesFound, shopCartTotal]);

  // Main Render & Animation Loop
  useEffect(() => {
    let clock = new THREE.Clock();

    const renderLoop = () => {
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth camera motion
      if (cameraRef.current) {
        if (viewMode === 'map') {
          // Orbiting camera around center based on mapRotationAngle
          const orbitRadius = 16;
          const currentAngle = mapRotationAngle.current + time * 0.04;
          const cx = Math.sin(currentAngle) * orbitRadius;
          const cz = Math.cos(currentAngle) * orbitRadius;
          targetCamPos.current.set(cx, 11, cz);
        }

        cameraRef.current.position.lerp(targetCamPos.current, 0.06);
        currentCamLookAt.current.lerp(targetCamLookAt.current, 0.08);
        cameraRef.current.lookAt(currentCamLookAt.current);
      }

      // Gentle cloud drifting
      if (cloudsGroupRef.current) {
        cloudsGroupRef.current.rotation.y = time * 0.015;
      }

      // World Map Island Hovering Bobbing
      if (viewMode === 'map') {
        mapIslandsRef.current.forEach((item, idx) => {
          item.group.position.y = WORLDS[idx]?.islandPosition[1] + Math.sin(time * 2 + idx) * 0.12;
        });
      }

      // Game Mode animations
      if (gameMode === 'race') {
        // Running legs swinging & vertical running bounce
        if (runnerLeftLegRef.current && runnerRightLegRef.current) {
          const runSpeed = 14;
          runnerLeftLegRef.current.rotation.x = Math.sin(time * runSpeed) * 0.65;
          runnerRightLegRef.current.rotation.x = -Math.sin(time * runSpeed) * 0.65;
          if (runnerGroupRef.current && isCorrect !== true) {
            runnerGroupRef.current.position.y = 0.2 + Math.abs(Math.sin(time * runSpeed)) * 0.08;
          }
        }
      } else if (gameMode === 'battle') {
        // Hero & Enemy idle breathing movement
        if (heroFighterRef.current && enemyFighterRef.current && isCorrect === null) {
          heroFighterRef.current.position.y = 0.6 + Math.sin(time * 3) * 0.04;
          enemyFighterRef.current.position.y = 0.6 + Math.cos(time * 2.5) * 0.04;
        }
      } else if (gameMode === 'shop') {
        // Merchant breathing & coin gleam
        if (shopMerchantRef.current && isCorrect === null) {
          shopMerchantRef.current.position.y = 0.3 + Math.sin(time * 2.5) * 0.02;
        }
        if (shopCoinsMeshRef.current && isCorrect === null) {
          shopCoinsMeshRef.current.rotation.y = time * 0.8;
        }
      } else if (gameMode === 'detective') {
        // Detective subtle breathing & wand ambient pulsing
        if (castleDetectiveRef.current && isCorrect === null) {
          castleDetectiveRef.current.position.y = 0.3 + Math.sin(time * 2) * 0.02;
        }
        if (castleChestRef.current) {
          castleChestRef.current.position.y = 1.1 + Math.sin(time * 3) * 0.03;
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [viewMode, gameMode]);

  return (
    <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] overflow-hidden rounded-2xl border border-slate-700/60 bg-[#142138] shadow-2xl select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Navigation Controls Overlay */}
      {viewMode === 'map' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/60 text-xs text-slate-300 pointer-events-none">
          <span>🔄 Arrastra para girar el mapa 3D</span>
          <span className="text-slate-500">·</span>
          <span>👆 Toca una isla para viajar</span>
        </div>
      )}

      {viewMode === 'game' && gameMode === 'battle' && (
        <div className="absolute top-3 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
          <div className="bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-blue-500/40 w-40">
            <div className="flex justify-between text-xs font-bold text-blue-300 mb-1">
              <span>Héroe (Tú)</span>
              <span>{Math.max(0, heroHp)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.max(0, heroHp)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-500/40 w-44 text-right">
            <div className="flex justify-between text-xs font-bold text-amber-300 mb-1">
              <span>Guardián</span>
              <span>{Math.max(0, enemyHp)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 float-right"
                style={{ width: `${Math.max(0, enemyHp)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'game' && gameMode === 'bridge' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-sky-500/40 text-xs font-bold text-sky-200 pointer-events-none">
          Puente construido: {bridgeBuiltSegments} / {totalQuestions} bloques
        </div>
      )}
    </div>
  );
};
