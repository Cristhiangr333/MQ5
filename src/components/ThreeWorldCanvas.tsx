import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { WORLDS } from '../data/worldsData';
import { GameMode } from '../types';

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
  onSelectWorld?: (worldId: string) => void;
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
  onSelectWorld,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic references for animated scene objects
  const runnerGroupRef = useRef<THREE.Group | null>(null);
  const runnerLeftLegRef = useRef<THREE.Mesh | null>(null);
  const runnerRightLegRef = useRef<THREE.Mesh | null>(null);
  const trackPathMeshRef = useRef<THREE.Mesh | null>(null);
  const heroFighterRef = useRef<THREE.Group | null>(null);
  const enemyFighterRef = useRef<THREE.Group | null>(null);
  const bridgeSegmentsGroupRef = useRef<THREE.Group | null>(null);
  const castleRunesRef = useRef<THREE.Mesh[]>([]);
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

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
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
        if (matched && onSelectWorld) {
          onSelectWorld(matched.id);
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
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
  }, [onSelectWorld]);

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

        // 3D Runner Character
        const runner = new THREE.Group();
        runner.position.set(0, 0.2, 4);

        // Body
        const bodyMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.6, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 })
        );
        bodyMesh.position.y = 0.7;
        bodyMesh.castShadow = true;
        runner.add(bodyMesh);

        // Head
        const headMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.5 })
        );
        headMesh.position.y = 1.15;
        headMesh.castShadow = true;
        runner.add(headMesh);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.14, 0.45, 0.14);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.16, 0.25, 0);
        leftLeg.castShadow = true;
        runner.add(leftLeg);
        runnerLeftLegRef.current = leftLeg;

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.16, 0.25, 0);
        rightLeg.castShadow = true;
        runner.add(rightLeg);
        runnerRightLegRef.current = rightLeg;

        rootGroup.add(runner);
        runnerGroupRef.current = runner;
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

        // Hero Fighter (Left side, facing right)
        const heroGroup = new THREE.Group();
        heroGroup.position.set(-2.2, 0.6, 0);
        heroGroup.rotation.y = Math.PI / 2;

        const hBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.8, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 })
        );
        hBody.position.y = 0.6;
        hBody.castShadow = true;
        heroGroup.add(hBody);

        const hHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfecdd3 })
        );
        hHead.position.y = 1.15;
        heroGroup.add(hHead);

        // Hero Sword / Staff
        const sword = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7 })
        );
        sword.rotation.z = Math.PI / 4;
        sword.position.set(0.4, 0.8, 0.2);
        heroGroup.add(sword);

        rootGroup.add(heroGroup);
        heroFighterRef.current = heroGroup;

        // Enemy Rock Guardian (Right side, facing left)
        const enemyGroup = new THREE.Group();
        enemyGroup.position.set(2.2, 0.6, 0);
        enemyGroup.rotation.y = -Math.PI / 2;

        const eBody = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.8, 1),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, flatShading: true })
        );
        eBody.position.y = 0.9;
        eBody.castShadow = true;
        enemyGroup.add(eBody);

        // Glowing crystal eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c });
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
        eyeL.position.set(0.2, 1.1, 0.65);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
        eyeR.position.set(-0.2, 1.1, 0.65);
        enemyGroup.add(eyeL);
        enemyGroup.add(eyeR);

        rootGroup.add(enemyGroup);
        enemyFighterRef.current = enemyGroup;
      } else if (gameMode === 'shop') {
        // WORLD 3: CIUDAD — Mercado del Mercader 3D
        targetCamPos.current.set(0, 4.5, 7.5);
        targetCamLookAt.current.set(0, 1.2, 0);

        // Cobblestone plaza
        const plaza = new THREE.Mesh(
          new THREE.CylinderGeometry(5.5, 5, 0.6, 18),
          new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true })
        );
        plaza.position.y = 0;
        plaza.receiveShadow = true;
        rootGroup.add(plaza);

        // Merchant Stall with canopy
        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.9, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
        );
        counter.position.set(0, 0.75, -1.5);
        counter.castShadow = true;
        counter.receiveShadow = true;
        rootGroup.add(counter);

        // Stall Poles
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
        [-1.4, 1.4].forEach((px) => {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), poleMat);
          pole.position.set(px, 1.4, -1.5);
          rootGroup.add(pole);
        });

        // Striped Awning
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.15, 1.8),
          new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.4 })
        );
        canopy.position.set(0, 2.4, -1.2);
        canopy.rotation.x = 0.2;
        rootGroup.add(canopy);

        // Goods crates on counter
        const itemsGroup = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.4, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xd97706 })
          );
          crate.position.set(-1.0 + i * 0.7, 1.4, -1.5);
          // Gem on top
          const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0369a1, roughness: 0.1 })
          );
          gem.position.y = 0.35;
          crate.add(gem);
          itemsGroup.add(crate);
        }
        rootGroup.add(itemsGroup);

        // Buyer Customer Avatar in foreground
        const buyer = new THREE.Group();
        buyer.position.set(0, 0.3, 1.8);
        const bBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.75, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x10b981 })
        );
        bBody.position.y = 0.6;
        buyer.add(bBody);
        const bHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xfed7aa })
        );
        bHead.position.y = 1.15;
        buyer.add(bHead);
        rootGroup.add(buyer);
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

        // Character walking across the bridge
        const walker = new THREE.Group();
        const walkerX = -2.6 + (bridgeBuiltSegments / Math.max(1, totalQuestions)) * 5.2;
        walker.position.set(walkerX, 1.2, 0);
        walker.rotation.y = Math.PI / 2;

        const wBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 0.65, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x0284c7 })
        );
        wBody.position.y = 0.5;
        walker.add(wBody);
        const wHead = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xfed7aa })
        );
        wHead.position.y = 1.0;
        walker.add(wHead);
        rootGroup.add(walker);
      } else if (gameMode === 'detective') {
        // WORLD 5: CASTILLO — Enigma del Detective 3D
        targetCamPos.current.set(0, 4.5, 8.5);
        targetCamLookAt.current.set(0, 1.4, 0);

        // Citadel Base
        const castleBase = new THREE.Mesh(
          new THREE.CylinderGeometry(4.5, 4.0, 1.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.6, flatShading: true })
        );
        castleBase.position.y = 0;
        rootGroup.add(castleBase);

        // Citadel Tower Spire
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.6, 3.4, 8),
          new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.5 })
        );
        tower.position.set(0, 2.2, -1.2);
        rootGroup.add(tower);

        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(1.8, 2.2, 8),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
        );
        roof.position.set(0, 4.8, -1.2);
        rootGroup.add(roof);

        // 5 Magical Clue Runes rotating around the tower
        castleRunesRef.current = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          const runeGeo = new THREE.TorusGeometry(0.35, 0.08, 8, 16);
          const runeMat = new THREE.MeshStandardMaterial({
            color: i < questionIndex ? 0xf43f5e : 0x475569,
            emissive: i < questionIndex ? 0xbe123c : 0x000000,
            roughness: 0.2,
          });
          const rune = new THREE.Mesh(runeGeo, runeMat);
          rune.position.set(Math.cos(angle) * 2.8, 1.8 + (i % 2) * 0.4, Math.sin(angle) * 2.8);
          rootGroup.add(rune);
          castleRunesRef.current.push(rune);
        }
      }
    }

    scene.add(rootGroup);
  }, [viewMode, currentWorldId, gameMode, totalQuestions, bridgeBuiltSegments, questionIndex]);

  // Update Dynamic Bridge Segments when bridgeBuiltSegments changes
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
      const segGeo = new THREE.BoxGeometry(step * 0.9, 0.25, 1.8);
      const segMat = new THREE.MeshStandardMaterial({
        color: isBuilt ? 0xfbbf24 : 0x334155,
        roughness: isBuilt ? 0.3 : 0.8,
        emissive: isBuilt ? 0x92400e : 0x000000,
        flatShading: true,
      });
      const segment = new THREE.Mesh(segGeo, segMat);
      segment.position.set(startX + step * i + step * 0.5, isBuilt ? 1.0 : -0.2, 0);
      group.add(segment);
    }
  }, [bridgeBuiltSegments, totalQuestions, gameMode]);

  // Handle Response Animation (Race runner hop, Battle strike, etc.)
  useEffect(() => {
    if (isCorrect === null) return;

    if (gameMode === 'race' && runnerGroupRef.current) {
      if (isCorrect) {
        // Hop forward
        const startZ = runnerGroupRef.current.position.z;
        const targetZ = Math.max(-8, startZ - 1.8);
        const startTime = performance.now();
        const hopAnim = (time: number) => {
          const elapsed = (time - startTime) / 300;
          if (elapsed < 1 && runnerGroupRef.current) {
            runnerGroupRef.current.position.y = 0.2 + Math.sin(elapsed * Math.PI) * 0.8;
            runnerGroupRef.current.position.z = THREE.MathUtils.lerp(startZ, targetZ, elapsed);
            requestAnimationFrame(hopAnim);
          } else if (runnerGroupRef.current) {
            runnerGroupRef.current.position.y = 0.2;
            runnerGroupRef.current.position.z = targetZ;
          }
        };
        requestAnimationFrame(hopAnim);
      }
    } else if (gameMode === 'battle') {
      if (isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Hero attack dash
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalX = hero.position.x;
        const startTime = performance.now();
        const attackAnim = (time: number) => {
          const elapsed = (time - startTime) / 380;
          if (elapsed < 0.5) {
            hero.position.x = THREE.MathUtils.lerp(originalX, originalX + 1.8, elapsed * 2);
          } else if (elapsed < 1.0) {
            hero.position.x = THREE.MathUtils.lerp(originalX + 1.8, originalX, (elapsed - 0.5) * 2);
            enemy.rotation.z = Math.sin((elapsed - 0.5) * Math.PI * 4) * 0.2;
          } else {
            hero.position.x = originalX;
            enemy.rotation.z = 0;
          }
          if (elapsed < 1.0) requestAnimationFrame(attackAnim);
        };
        requestAnimationFrame(attackAnim);
      } else if (!isCorrect && heroFighterRef.current && enemyFighterRef.current) {
        // Enemy counter-attack dash
        const hero = heroFighterRef.current;
        const enemy = enemyFighterRef.current;
        const originalX = enemy.position.x;
        const startTime = performance.now();
        const enemyAnim = (time: number) => {
          const elapsed = (time - startTime) / 380;
          if (elapsed < 0.5) {
            enemy.position.x = THREE.MathUtils.lerp(originalX, originalX - 1.6, elapsed * 2);
          } else if (elapsed < 1.0) {
            enemy.position.x = THREE.MathUtils.lerp(originalX - 1.6, originalX, (elapsed - 0.5) * 2);
            hero.rotation.z = -Math.sin((elapsed - 0.5) * Math.PI * 4) * 0.2;
          } else {
            enemy.position.x = originalX;
            hero.rotation.z = 0;
          }
          if (elapsed < 1.0) requestAnimationFrame(enemyAnim);
        };
        requestAnimationFrame(enemyAnim);
      }
    }
  }, [isCorrect, gameMode, heroHp, enemyHp]);

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
        // Running legs swinging
        if (runnerLeftLegRef.current && runnerRightLegRef.current) {
          const runSpeed = 14;
          runnerLeftLegRef.current.rotation.x = Math.sin(time * runSpeed) * 0.65;
          runnerRightLegRef.current.rotation.x = -Math.sin(time * runSpeed) * 0.65;
        }
      } else if (gameMode === 'detective') {
        // Rotating castle rings
        castleRunesRef.current.forEach((rune, idx) => {
          rune.rotation.x = time * 1.5 + idx;
          rune.rotation.y = time * 1.2 + idx;
        });
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
