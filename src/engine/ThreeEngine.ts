import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  SceneObject,
  RenderMode,
  CameraMode,
  CameraPreset,
  CabinetCell,
  Vector3D,
} from '../types/cad';
import { CellDetector } from './CellDetector';
import { TextureGenerator } from './TextureGenerator';

export class ThreeEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public perspectiveCamera: THREE.PerspectiveCamera;
  public orthographicCamera: THREE.OrthographicCamera;
  public activeCamera: THREE.Camera;
  public controls: OrbitControls;

  private objectMeshMap: Map<string, THREE.Group> = new Map();
  private edgeLinesMap: Map<string, THREE.LineSegments> = new Map();
  private dimensionHelpersGroup: THREE.Group;
  private cellHighlightGroup: THREE.Group;
  private cellHighlightMesh: THREE.Mesh;
  private cellHighlightEdges: THREE.LineSegments;
  private drawingPreviewGroup: THREE.Group;
  private gridHelper: THREE.GridHelper;
  private groundMesh: THREE.Mesh;

  private savedCameraState: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    isOrtho: boolean;
  } | null = null;

  private dirLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;

  private currentRenderMode: RenderMode = 'realistic';
  private currentCameraMode: CameraMode = 'perspective';

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private animationFrameId: number | null = null;
  private isDestroyed = false;

  public onSelectObject?: (objectId: string | null, isMultiSelect: boolean) => void;
  public onDoubleClickObject?: (objectId: string) => void;
  public onCellHover?: (cell: CabinetCell | null) => void;
  public onCellDrop?: (cell: CabinetCell, clientPos: { x: number; y: number }) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f172a'); // Dark slate blueprint CAD theme

    // 2. Camera setup
    const aspect = width / height;
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 10, 50000);
    this.perspectiveCamera.position.set(1500, 1500, -2500);

    const frustumSize = 2500;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -100000,
      100000
    );
    this.orthographicCamera.position.set(1500, 1500, -2500);

    this.activeCamera = this.perspectiveCamera;

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 1.0;
    this.controls.target.set(0, 800, 0);
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go deep below ground
    this.controls.minDistance = 200;
    this.controls.maxDistance = 15000;
    this.controls.minZoom = 0.05;
    this.controls.maxZoom = 50;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Update projection matrix on camera changes
    this.controls.addEventListener('change', () => {
      if (this.activeCamera === this.orthographicCamera) {
        this.orthographicCamera.updateProjectionMatrix();
      }
    });

    // 5. Lighting
    this.ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.6);
    this.hemiLight.position.set(0, 3000, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(2000, 4000, 2500);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 100;
    this.dirLight.shadow.camera.far = 10000;
    const d = 2500;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // 6. Ground grid & shadow receiver
    this.gridHelper = new THREE.GridHelper(6000, 60, 0x3b82f6, 0x334155);
    this.gridHelper.position.y = -0.5;
    this.scene.add(this.gridHelper);

    const groundGeo = new THREE.PlaneGeometry(10000, 10000);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -1;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 7. Dimension Helpers Group
    this.dimensionHelpersGroup = new THREE.Group();
    this.scene.add(this.dimensionHelpersGroup);

    // 8. Cell Hover Highlight Mesh & Edges Group
    this.cellHighlightGroup = new THREE.Group();
    this.cellHighlightGroup.visible = false;

    const cellGeo = new THREE.BoxGeometry(1, 1, 1);
    const cellMat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Vibrant emerald / cyan glow
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    this.cellHighlightMesh = new THREE.Mesh(cellGeo, cellMat);
    this.cellHighlightGroup.add(this.cellHighlightMesh);

    const cellEdgesGeo = new THREE.EdgesGeometry(cellGeo);
    const cellEdgesMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 3,
    });
    this.cellHighlightEdges = new THREE.LineSegments(cellEdgesGeo, cellEdgesMat);
    this.cellHighlightGroup.add(this.cellHighlightEdges);

    this.scene.add(this.cellHighlightGroup);

    // 9. Interactive Drawing Preview Group (Wall, Beam, Column live extrusion)
    this.drawingPreviewGroup = new THREE.Group();
    this.drawingPreviewGroup.visible = false;
    this.scene.add(this.drawingPreviewGroup);

    // Setup Event Listeners
    this.setupInteractions();
    this.animate();
  }

  private setupInteractions() {
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;
    let lastClickTime = 0;
    let lastClickedId: string | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerDownTime = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      const elapsed = performance.now() - pointerDownTime;

      // Click / Tap if pointer didn't drag significantly
      if (dist < 8 && elapsed < 400) {
        const now = performance.now();
        const clickedObjId = this.pickObjectId(e.clientX, e.clientY);

        // Check for double click on the same object
        if (clickedObjId && clickedObjId === lastClickedId && now - lastClickTime < 350) {
          if (this.onDoubleClickObject) {
            this.onDoubleClickObject(clickedObjId);
          }
          lastClickTime = 0;
          lastClickedId = null;
          return;
        }

        lastClickTime = now;
        lastClickedId = clickedObjId;
        this.handleCanvasClick(e, clickedObjId);
      }
    };

    this.renderer.domElement.addEventListener('pointerdown', onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', onPointerUp);
  }

  private pickObjectId(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.activeCamera);

    const interactiveMeshes: THREE.Object3D[] = [];
    this.objectMeshMap.forEach((group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.objectId) {
          interactiveMeshes.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(interactiveMeshes, true);
    if (intersects.length > 0) {
      return intersects[0].object.userData.objectId || null;
    }
    return null;
  }

  private handleCanvasClick(e: PointerEvent, precomputedId?: string | null) {
    const objectId = precomputedId !== undefined ? precomputedId : this.pickObjectId(e.clientX, e.clientY);
    const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;

    if (this.onSelectObject) {
      this.onSelectObject(objectId, isMulti);
    }
  }

  /**
   * Enables or disables orbit camera controls (useful when drawing marquee selection box)
   */
  public setControlsEnabled(enabled: boolean) {
    if (this.controls) {
      this.controls.enabled = enabled;
    }
  }

  /**
   * Projects 3D object bounding boxes to 2D screen coordinates and returns objects
   * whose screen projections intersect or fall within the selection rectangle
   */
  public getObjectsInScreenRect(rect: { left: number; top: number; right: number; bottom: number }): string[] {
    const minX = Math.min(rect.left, rect.right);
    const maxX = Math.max(rect.left, rect.right);
    const minY = Math.min(rect.top, rect.bottom);
    const maxY = Math.max(rect.top, rect.bottom);

    const domRect = this.renderer.domElement.getBoundingClientRect();
    const selectedIds: string[] = [];

    this.objectMeshMap.forEach((group, objectId) => {
      if (!group.visible) return;

      const box = new THREE.Box3().setFromObject(group);
      if (box.isEmpty()) return;

      // Extract 8 corner points and center of 3D AABB in world space
      const corners = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        new THREE.Vector3((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2),
      ];

      let minScreenX = Infinity;
      let maxScreenX = -Infinity;
      let minScreenY = Infinity;
      let maxScreenY = -Infinity;
      let anyInFront = false;

      for (const corner of corners) {
        corner.project(this.activeCamera);

        if (corner.z <= 1 && corner.z >= -1) {
          anyInFront = true;
        }

        const screenX = ((corner.x + 1) / 2) * domRect.width + domRect.left;
        const screenY = ((-corner.y + 1) / 2) * domRect.height + domRect.top;

        minScreenX = Math.min(minScreenX, screenX);
        maxScreenX = Math.max(maxScreenX, screenX);
        minScreenY = Math.min(minScreenY, screenY);
        maxScreenY = Math.max(maxScreenY, screenY);
      }

      if (!anyInFront) return;

      // Check 2D bounding rectangle intersection
      const intersects = !(
        maxScreenX < minX ||
        minScreenX > maxX ||
        maxScreenY < minY ||
        minScreenY > maxY
      );

      if (intersects) {
        selectedIds.push(objectId);
      }
    });

    return selectedIds;
  }

  /**
   * Syncs and updates all 3D scene objects from state
   */
  public syncObjects(objects: SceneObject[], selectedIds: Set<string>) {
    const activeIds = new Set<string>();

    objects.forEach((obj) => {
      if (obj.type === 'cabinet' || obj.type === 'group') {
        // Parent container nodes
        return;
      }

      activeIds.add(obj.id);
      let group = this.objectMeshMap.get(obj.id);

      if (!group) {
        group = new THREE.Group();
        group.userData.objectId = obj.id;
        this.scene.add(group);
        this.objectMeshMap.set(obj.id, group);
      }

      // Update Group transform
      group.position.set(obj.position.x, obj.position.y, obj.position.z);
      group.rotation.set(
        THREE.MathUtils.degToRad(obj.rotation.x),
        THREE.MathUtils.degToRad(obj.rotation.y),
        THREE.MathUtils.degToRad(obj.rotation.z)
      );
      group.visible = obj.visible;

      // Rebuild mesh inside group
      this.buildObjectMesh(group, obj, selectedIds.has(obj.id));
    });

    // Remove deleted objects
    this.objectMeshMap.forEach((group, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.disposeGroup(group);
        this.objectMeshMap.delete(id);
      }
    });

    // Update 3D Dimension measurement lines
    this.updateDimensionHelpers(objects, selectedIds);
  }

  /**
   * Constructs the procedural mesh for a CAD object (panel, drawer, door, leg, etc.)
   */
  private buildObjectMesh(group: THREE.Group, obj: SceneObject, isSelected: boolean) {
    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    const dims = obj.dimensions;
    const w = dims.width;
    const h = dims.height;
    const d = dims.depth;

    // Create Base Material depending on current RenderMode
    const mat = this.createThreeMaterial(obj.material, isSelected);

    // Sliding door panels sit on the rail plane and do not use hinge rotation.
    if (obj.type === 'door' && obj.metadata?.door?.doorType === 'sliding') {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      panel.position.z = -d / 2;
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData.objectId = obj.id;
      this.attachEdges(panel, isSelected);
      group.add(panel);
      return;
    }

    // Check for Door with dynamic Swing Angle
    if (obj.type === 'door' && obj.metadata?.door) {
      const doorData = obj.metadata.door;
      const openAngleDeg = doorData.isOpen ? (doorData.openAngle || 90) : 0;
      const angleRad = THREE.MathUtils.degToRad(openAngleDeg);

      const doorPivot = new THREE.Group();
      const isLeft = doorData.doorType === 'single_left';

      // Hinge pivot at left or right edge
      const pivotX = isLeft ? -w / 2 : w / 2;
      doorPivot.position.set(pivotX, 0, d / 2);
      doorPivot.rotation.y = isLeft ? -angleRad : angleRad;

      const doorGeo = new THREE.BoxGeometry(w, h, d);
      const doorMesh = new THREE.Mesh(doorGeo, mat);
      doorMesh.position.set(isLeft ? w / 2 : -w / 2, 0, -d / 2);
      doorMesh.castShadow = true;
      doorMesh.receiveShadow = true;
      doorMesh.userData.objectId = obj.id;

      // Bold edge lines
      this.attachEdges(doorMesh, isSelected);
      doorPivot.add(doorMesh);

      // Add Vertical Handle on the door opening side (flush on the front face)
      const handleLen = Math.min(160, Math.max(80, Math.round(h * 0.25)));
      const handleMesh = this.createHandleMesh(obj, isSelected, true, handleLen);

      const handleInset = Math.min(35, Math.max(15, Math.round(w * 0.15)));
      const defaultHandleX = isLeft ? w / 2 - handleInset : -w / 2 + handleInset;
      const handleX = defaultHandleX + (doorData.handleOffsetX || 0);

      let handleY = 0;
      if (doorData.handlePosition === 'top') {
        handleY = Math.max(0, h / 2 - 120);
      } else if (doorData.handlePosition === 'bottom') {
        handleY = Math.min(0, -h / 2 + 120);
      } else {
        handleY = 0;
      }

      handleY += doorData.handleOffsetY || 0;
      handleMesh.position.set(handleX, handleY, -d / 2 - 12.5);
      doorMesh.add(handleMesh);

      group.add(doorPivot);
      return;
    }

    // Check for Drawer with dynamic pull-out extension and inner/outer placement
    if (obj.type === 'drawer' && obj.metadata?.drawer) {
      const drawerData = obj.metadata.drawer;
      const ext = drawerData.extensionMm || 0;
      const isInner = drawerData.placement === 'inner';

      const drawerContainer = new THREE.Group();
      drawerContainer.position.set(0, 0, -ext); // Slide forward in local space

      // Front panel
      const frontThickness = isInner ? 16 : 18;
      const frontH = isInner ? Math.max(40, h - 10) : h;
      const frontGeo = new THREE.BoxGeometry(w, frontH, frontThickness);
      const frontMesh = new THREE.Mesh(frontGeo, mat);
      frontMesh.position.set(0, isInner ? -5 : 0, -d / 2 + frontThickness / 2);
      frontMesh.castShadow = true;
      frontMesh.receiveShadow = true;
      frontMesh.userData.objectId = obj.id;
      this.attachEdges(frontMesh, isSelected);
      drawerContainer.add(frontMesh);

      // Drawer Box (Sides, Back, Bottom)
      const boxMat = this.createThreeMaterial(obj.material, false, true);
      const boxW = Math.max(60, w - 24);
      const boxH = Math.min(frontH - 25, 140);
      const boxD = Math.max(100, d - 18);

      // Bottom
      const bBottom = new THREE.Mesh(new THREE.BoxGeometry(boxW, 16, boxD), boxMat);
      bBottom.position.set(0, -frontH / 2 + 16, 0);
      bBottom.castShadow = true;
      drawerContainer.add(bBottom);

      // Left Box Side
      const bLeft = new THREE.Mesh(new THREE.BoxGeometry(14, boxH, boxD), boxMat);
      bLeft.position.set(-boxW / 2 + 7, -frontH / 2 + boxH / 2 + 16, 0);
      drawerContainer.add(bLeft);

      // Right Box Side
      const bRight = new THREE.Mesh(new THREE.BoxGeometry(14, boxH, boxD), boxMat);
      bRight.position.set(boxW / 2 - 7, -frontH / 2 + boxH / 2 + 16, 0);
      drawerContainer.add(bRight);

      // Back Box Panel
      const bBack = new THREE.Mesh(new THREE.BoxGeometry(boxW - 28, boxH, 14), boxMat);
      bBack.position.set(0, -frontH / 2 + boxH / 2 + 16, boxD / 2 - 7);
      drawerContainer.add(bBack);

      // Handle: Recessed finger cutout grip for inner drawer, or stylish bar handle for outer drawer
      if (isInner || drawerData.handleType === 'recessed') {
        const gripGeo = new THREE.BoxGeometry(Math.min(100, w * 0.4), 16, 6);
        const gripMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x93c5fd : 0x1e293b,
          metalness: 0.8,
          roughness: 0.2,
        });
        const gripMesh = new THREE.Mesh(gripGeo, gripMat);
        gripMesh.position.set(0, frontH / 2 - 14, -d / 2 + frontThickness + 1);
        drawerContainer.add(gripMesh);
      } else if (drawerData.handleType !== 'none') {
        const handleLen = Math.min(160, Math.max(80, Math.round(w * 0.35)));
        const handleMesh = this.createHandleMesh(obj, isSelected, false, handleLen);
        handleMesh.position.set(0, 0, -d / 2 - 12.5);
        drawerContainer.add(handleMesh);
      }

      group.add(drawerContainer);
      return;
    }

    // Check for Cabinet or Drawer Accessories
    if (obj.type === 'accessory') {
      const accData = obj.metadata?.accessory;
      const accType = accData?.accessoryType;
      const chromeMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x60a5fa : 0xd1d5db,
        metalness: 0.9,
        roughness: 0.15,
      });
      const bracketMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x3b82f6 : 0x334155,
        metalness: 0.6,
        roughness: 0.35,
      });

      const accGroup = new THREE.Group();

      if (obj.metadata?.sliding?.part === 'bottom_rail' || obj.metadata?.sliding?.part === 'top_rail') {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bracketMat);
        rail.userData.objectId = obj.id;
        this.attachEdges(rail, isSelected);
        accGroup.add(rail);
      } else if (obj.metadata?.sliding?.part === 'channel') {
        const channel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bracketMat);
        channel.userData.objectId = obj.id;
        this.attachEdges(channel, isSelected);
        accGroup.add(channel);
      } else if (accType === 'hanging_rail') {

        // 1. Askı Borusu (Oval Aluminum Chrome Rail + Side Flanges + Hangers)
        const railGeo = new THREE.CylinderGeometry(12, 12, w, 20);
        const railMesh = new THREE.Mesh(railGeo, chromeMat);
        railMesh.rotation.z = Math.PI / 2;
        railMesh.castShadow = true;
        accGroup.add(railMesh);

        // Flange brackets on sides
        const flangeGeo = new THREE.CylinderGeometry(18, 18, 6, 16);
        const leftFlange = new THREE.Mesh(flangeGeo, bracketMat);
        leftFlange.rotation.z = Math.PI / 2;
        leftFlange.position.set(-w / 2 + 3, 0, 0);
        accGroup.add(leftFlange);

        const rightFlange = new THREE.Mesh(flangeGeo, bracketMat);
        rightFlange.rotation.z = Math.PI / 2;
        rightFlange.position.set(w / 2 - 3, 0, 0);
        accGroup.add(rightFlange);

        // Procedural decorative clothes hangers hanging on rail
        const hangerSpacing = 140;
        const hangerCount = Math.max(1, Math.min(5, Math.floor((w - 120) / hangerSpacing)));
        const startHangerX = -((hangerCount - 1) * hangerSpacing) / 2;

        for (let hi = 0; hi < hangerCount; hi++) {
          const hX = startHangerX + hi * hangerSpacing;
          const hangerTop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 20, 8), chromeMat);
          hangerTop.position.set(hX, -10, 0);
          accGroup.add(hangerTop);

          const hangerBar = new THREE.Mesh(new THREE.BoxGeometry(110, 5, 8), bracketMat);
          hangerBar.position.set(hX, -22, 0);
          accGroup.add(hangerBar);
        }
      } else if (accType === 'wardrobe_lift') {
        // 2. Asansörlü Askılık (Hydraulic Wardrobe Lift)
        const topBar = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, w - 40, 20), chromeMat);
        topBar.rotation.z = Math.PI / 2;
        topBar.position.set(0, h / 2 - 20, 0);
        accGroup.add(topBar);

        // Left & Right Hydraulic Arms
        const armGeo = new THREE.BoxGeometry(12, h * 0.85, 20);
        const leftArm = new THREE.Mesh(armGeo, bracketMat);
        leftArm.position.set(-w / 2 + 12, 0, 0);
        accGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, bracketMat);
        rightArm.position.set(w / 2 - 12, 0, 0);
        accGroup.add(rightArm);

        // Center Drop-Down Pull Rod
        const rodGeo = new THREE.CylinderGeometry(8, 8, h * 0.9, 16);
        const centerRod = new THREE.Mesh(rodGeo, chromeMat);
        centerRod.position.set(0, -h * 0.15, 0);
        accGroup.add(centerRod);

        // Pull Handle Grip at bottom of rod
        const gripGeo = new THREE.CylinderGeometry(16, 16, 70, 16);
        const gripMesh = new THREE.Mesh(gripGeo, bracketMat);
        gripMesh.rotation.z = Math.PI / 2;
        gripMesh.position.set(0, -h * 0.6, 0);
        accGroup.add(gripMesh);
      } else if (accType === 'pant_rack') {
        // 3. Raylı Pantolonluk (Telescopic Trouser Rack)
        const frameMat = bracketMat;
        // Outer slide frame
        const leftSlide = new THREE.Mesh(new THREE.BoxGeometry(18, 30, d), frameMat);
        leftSlide.position.set(-w / 2 + 9, 0, 0);
        accGroup.add(leftSlide);

        const rightSlide = new THREE.Mesh(new THREE.BoxGeometry(18, 30, d), frameMat);
        rightSlide.position.set(w / 2 - 9, 0, 0);
        accGroup.add(rightSlide);

        const frontBar = new THREE.Mesh(new THREE.BoxGeometry(w, 24, 16), frameMat);
        frontBar.position.set(0, 0, -d / 2 + 8);
        accGroup.add(frontBar);

        // Trouser hanging rungs across depth
        const rungCount = Math.max(3, Math.min(10, Math.floor((d - 60) / 45)));
        const rungSpan = (d - 70) / (rungCount - 1);
        for (let ri = 0; ri < rungCount; ri++) {
          const rZ = -d / 2 + 35 + ri * rungSpan;
          const rungMesh = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, w - 38, 12), chromeMat);
          rungMesh.rotation.z = Math.PI / 2;
          rungMesh.position.set(0, 0, rZ);
          accGroup.add(rungMesh);
        }
      } else if (accType === 'tie_rack') {
        // 4. Kravatlık & Kemerlik (Side Mounted Pull-Out Tie Rack)
        const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 24, d), bracketMat);
        accGroup.add(rail);

        // Hanging pegs
        const pegCount = Math.max(4, Math.floor(d / 40));
        for (let pi = 0; pi < pegCount; pi++) {
          const pZ = -d / 2 + 25 + pi * 36;
          const peg = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 32, 12), chromeMat);
          peg.rotation.z = Math.PI / 2;
          peg.position.set(16, 0, pZ);
          accGroup.add(peg);
        }
      } else if (accType === 'wire_basket') {
        // 5. Raylı Tel Sepet (Pull-Out Wire Basket)
        const sideSlideL = new THREE.Mesh(new THREE.BoxGeometry(14, 25, d), bracketMat);
        sideSlideL.position.set(-w / 2 + 7, 0, 0);
        accGroup.add(sideSlideL);

        const sideSlideR = new THREE.Mesh(new THREE.BoxGeometry(14, 25, d), bracketMat);
        sideSlideR.position.set(w / 2 - 7, 0, 0);
        accGroup.add(sideSlideR);

        // Top perimeter wire
        const topWireGeo = new THREE.BoxGeometry(w - 30, 8, d - 20);
        const topWire = new THREE.Mesh(topWireGeo, chromeMat);
        topWire.position.set(0, h / 2 - 6, 0);
        accGroup.add(topWire);

        // Bottom mesh plate
        const botGeo = new THREE.BoxGeometry(w - 30, 6, d - 20);
        const botMesh = new THREE.Mesh(botGeo, chromeMat);
        botMesh.position.set(0, -h / 2 + 6, 0);
        accGroup.add(botMesh);

        // Vertical wire ribs
        const ribCount = Math.max(3, Math.floor(d / 60));
        for (let rbi = 0; rbi < ribCount; rbi++) {
          const rz = -d / 2 + 20 + rbi * (d - 40) / (ribCount - 1);
          const ribL = new THREE.Mesh(new THREE.BoxGeometry(4, h - 16, 4), chromeMat);
          ribL.position.set(-w / 2 + 16, 0, rz);
          accGroup.add(ribL);
          const ribR = new THREE.Mesh(new THREE.BoxGeometry(4, h - 16, 4), chromeMat);
          ribR.position.set(w / 2 - 16, 0, rz);
          accGroup.add(ribR);
        }
      } else if (accType === 'led_profile') {
        // 6. LED Profil Aydınlatma (LED Light Bar)
        const aluProfile = new THREE.Mesh(
          new THREE.BoxGeometry(w, 10, 16),
          new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 })
        );
        accGroup.add(aluProfile);

        // Glowing LED Diffuser Strip
        const ledStrip = new THREE.Mesh(
          new THREE.BoxGeometry(w - 8, 4, 10),
          new THREE.MeshStandardMaterial({
            color: 0xffedd5,
            emissive: new THREE.Color(isSelected ? '#60a5fa' : '#fef08a'),
            emissiveIntensity: 1.4,
            roughness: 0.1,
          })
        );
        ledStrip.position.set(0, -4, 0);
        accGroup.add(ledStrip);
      } else if (accType === 'cutlery_tray') {
        // 7. Çatal Kaşıklık (Cutlery Organizer Tray)
        const trayMat = this.createThreeMaterial(obj.material, isSelected);
        const trayBase = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), trayMat);
        trayBase.position.set(0, -h / 2 + 4, 0);
        accGroup.add(trayBase);

        // Outer borders
        const wallMat = trayMat;
        const bL = new THREE.Mesh(new THREE.BoxGeometry(8, h, d), wallMat);
        bL.position.set(-w / 2 + 4, 0, 0);
        accGroup.add(bL);
        const bR = new THREE.Mesh(new THREE.BoxGeometry(8, h, d), wallMat);
        bR.position.set(w / 2 - 4, 0, 0);
        accGroup.add(bR);
        const bF = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), wallMat);
        bF.position.set(0, 0, -d / 2 + 4);
        accGroup.add(bF);
        const bB = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), wallMat);
        bB.position.set(0, 0, d / 2 - 4);
        accGroup.add(bB);

        // Longitudinal internal dividers (creates 4 cutlery slots)
        const colCount = 3;
        for (let ci = 1; ci <= colCount; ci++) {
          const cx = -w / 2 + (ci * w) / (colCount + 1);
          const colDiv = new THREE.Mesh(new THREE.BoxGeometry(6, h * 0.85, d - 16), wallMat);
          colDiv.position.set(cx, 0, 0);
          accGroup.add(colDiv);
        }
      } else if (accType === 'jewelry_tray') {
        // 8. Takılık / Mücevher Kutusu (Jewelry & Watch Tray)
        const velvetMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x2563eb : 0x1e293b,
          roughness: 0.95,
          metalness: 0.05,
        });

        const trayBase = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), velvetMat);
        trayBase.position.set(0, -h / 2 + 4, 0);
        accGroup.add(trayBase);

        // Grid dividers (3x3 grid for rings, watches, jewelry)
        for (let gx = 1; gx <= 2; gx++) {
          const divX = new THREE.Mesh(new THREE.BoxGeometry(6, h * 0.8, d - 16), velvetMat);
          divX.position.set(-w / 2 + (gx * w) / 3, 0, 0);
          accGroup.add(divX);
        }
        for (let gz = 1; gz <= 2; gz++) {
          const divZ = new THREE.Mesh(new THREE.BoxGeometry(w - 16, h * 0.8, 6), velvetMat);
          divZ.position.set(0, 0, -d / 2 + (gz * d) / 3);
          accGroup.add(divZ);
        }
      } else if (accType === 'drawer_organizer') {
        // 9. Çekmece İçi Bölücü (Cross Grid Organizer)
        const orgMat = this.createThreeMaterial(obj.material, isSelected);
        const divX1 = new THREE.Mesh(new THREE.BoxGeometry(8, h, d), orgMat);
        divX1.position.set(-w / 6, 0, 0);
        accGroup.add(divX1);

        const divX2 = new THREE.Mesh(new THREE.BoxGeometry(8, h, d), orgMat);
        divX2.position.set(w / 6, 0, 0);
        accGroup.add(divX2);

        const divZ1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), orgMat);
        divZ1.position.set(0, 0, 0);
        accGroup.add(divZ1);
      } else {
        // Generic fallback accessory box
        const genMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        accGroup.add(genMesh);
      }

      // Assign objectId to all child meshes for raycasting selection
      accGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.objectId = obj.id;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      group.add(accGroup);
      return;
    }

    // Standard Panel / Wall / Shelf / Divider / Column
    let geo: THREE.BufferGeometry;
    if (obj.type === 'leg') {
      geo = new THREE.CylinderGeometry(w / 2, (w / 2) * 0.8, h, 16);
    } else if (obj.type === 'shelf' || obj.type === 'divider') {
      geo = new THREE.BoxGeometry(w, h, d);
    } else {
      geo = new THREE.BoxGeometry(w, h, d);
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.objectId = obj.id;

    // Attach sharp, bold black edge outlines
    this.attachEdges(mesh, isSelected);
    group.add(mesh);
  }

  /**
   * Generates realistic PBR / Sketch / Unpainted / Wood Textured materials
   */
  private createThreeMaterial(
    config: SceneObject['material'],
    isSelected: boolean,
    isSubPart = false
  ): THREE.Material {
    if (isSelected) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3b82f6'),
        roughness: 0.3,
        metalness: 0.2,
        emissive: new THREE.Color('#1d4ed8'),
        emissiveIntensity: 0.35,
      });
    }

    if (this.currentRenderMode === 'sketch') {
      return new THREE.MeshBasicMaterial({
        color: new THREE.Color('#f8fafc'),
      });
    }

    if (this.currentRenderMode === 'unpainted') {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2e8f0'),
        roughness: 0.85,
        metalness: 0.05,
      });
    }

    // Wood Textured Mode or Realistic with wood grain pattern
    const isWoodMode =
      this.currentRenderMode === 'wood_textured' ||
      (this.currentRenderMode === 'realistic' && config.texturePattern === 'wood-grain');

    if (isWoodMode && config.type !== 'glass' && config.type !== 'metal') {
      const woodTex = TextureGenerator.getWoodTexture(config.color, config.grainDirection);
      const bumpTex = TextureGenerator.getWoodBumpMap(config.grainDirection);

      return new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: bumpTex,
        bumpScale: 0.7,
        roughness: config.roughness ?? 0.45,
        metalness: config.metalness ?? 0.04,
      });
    }

    // Realistic Mode (Solid lacquer / glass / metal)
    const baseColor = new THREE.Color(config.color);
    if (isSubPart) {
      baseColor.multiplyScalar(0.9);
    }

    if (config.type === 'glass') {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transmission: 0.9,
        opacity: 0.4,
        transparent: true,
        roughness: 0.1,
        metalness: 0.1,
        ior: 1.5,
      });
    }

    return new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: config.roughness ?? 0.5,
      metalness: config.metalness ?? 0.05,
    });
  }

  /**
   * Attaches crisp, thick CAD outline edges to any mesh
   */
  private attachEdges(mesh: THREE.Mesh, isSelected: boolean) {
    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const edgeColor = isSelected
      ? 0x60a5fa
      : this.currentRenderMode === 'sketch'
      ? 0x090d16
      : 0x1e293b;

    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      linewidth: 2,
    });
    const lineSegments = new THREE.LineSegments(edgesGeo, edgeMat);
    mesh.add(lineSegments);
  }

  private createHandleMesh(
    obj: SceneObject,
    isSelected: boolean,
    isVertical = false,
    customLength?: number
  ): THREE.Mesh {
    const len = customLength ?? 140;
    const handleGeo = isVertical
      ? new THREE.BoxGeometry(14, len, 25)
      : new THREE.BoxGeometry(len, 14, 25);

    const handleMat = new THREE.MeshStandardMaterial({
      color: isSelected ? 0x93c5fd : 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.castShadow = true;
    return handleMesh;
  }

  /**
   * Renders SketchUp-like 3D Dimension lines on selected objects
   */
  private updateDimensionHelpers(objects: SceneObject[], selectedIds: Set<string>) {
    // Clear old dimension lines
    while (this.dimensionHelpersGroup.children.length > 0) {
      const child = this.dimensionHelpersGroup.children[0];
      this.dimensionHelpersGroup.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
    }

    if (selectedIds.size === 0) return;

    selectedIds.forEach((id) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;

      const pos = obj.position;
      const dims = obj.dimensions;
      const w = dims.width;
      const h = dims.height;
      const d = dims.depth;

      // Build bounding box wireframe around selected object with high visibility
      const boxGeo = new THREE.BoxGeometry(w + 4, h + 4, d + 4);
      const wireGeo = new THREE.EdgesGeometry(boxGeo);
      const wireMat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 30,
        gapSize: 15,
        linewidth: 2,
      });

      const wireframe = new THREE.LineSegments(wireGeo, wireMat);
      wireframe.computeLineDistances();
      wireframe.position.set(pos.x, pos.y, pos.z);
      this.dimensionHelpersGroup.add(wireframe);
    });
  }

  /**
   * Highlights a hovered cabinet cell in 3D with glowing cyan volume and sharp bounding edges
   */
  public highlightCell(cell: CabinetCell | null) {
    if (!cell) {
      this.cellHighlightGroup.visible = false;
      return;
    }

    const cx = (cell.minX + cell.maxX) / 2;
    const cy = (cell.minY + cell.maxY) / 2;
    const cz = (cell.minZ + cell.maxZ) / 2;

    this.cellHighlightGroup.position.set(cx, cy, cz);
    this.cellHighlightGroup.scale.set(
      Math.max(1, cell.width - 2),
      Math.max(1, cell.height - 2),
      Math.max(1, cell.depth - 2)
    );
    this.cellHighlightGroup.visible = true;
  }

  /**
   * Highlights multiple swept cabinet cells with a combined glowing bounding box
   */
  public highlightMultiCells(cells: CabinetCell[] | null) {
    if (!cells || cells.length === 0) {
      this.cellHighlightGroup.visible = false;
      return;
    }

    const minX = Math.min(...cells.map((c) => c.minX));
    const maxX = Math.max(...cells.map((c) => c.maxX));
    const minY = Math.min(...cells.map((c) => c.minY));
    const maxY = Math.max(...cells.map((c) => c.maxY));
    const minZ = Math.min(...cells.map((c) => c.minZ));
    const maxZ = Math.max(...cells.map((c) => c.maxZ));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const d = Math.max(1, maxZ - minZ);

    this.cellHighlightGroup.position.set(cx, cy, cz);
    this.cellHighlightGroup.scale.set(w, h, d);
    this.cellHighlightGroup.visible = true;
  }

  /**
   * Raycast from client screen coordinate to find ground plane intersection (Y = 0)
   */
  public raycastGroundPlane(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.activeCamera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(groundPlane, targetPoint);

    return hit ? targetPoint : null;
  }

  /**
   * Displays dynamic real-time 3D drawing preview for Wall / Beam / Column
   */
  public showDrawingPreview(
    type: 'wall' | 'beam' | 'column',
    startPoint: Vector3D,
    currentPoint: Vector3D,
    height = 2600,
    thickness = 150
  ) {
    // Clear previous preview geometry
    while (this.drawingPreviewGroup.children.length > 0) {
      const child = this.drawingPreviewGroup.children[0];
      this.drawingPreviewGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      } else if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        child.geometry.dispose();
      }
    }

    const dx = currentPoint.x - startPoint.x;
    const dz = currentPoint.z - startPoint.z;
    const length = Math.max(20, Math.round(Math.hypot(dx, dz)));
    const angleRad = Math.atan2(dz, dx);

    const color = type === 'wall' ? 0x0284c7 : type === 'beam' ? 0xd97706 : 0x7c3aed;
    const edgeColor = type === 'wall' ? 0x38bdf8 : type === 'beam' ? 0xfbbf24 : 0xa78bfa;

    if (type === 'column') {
      const w = Math.max(50, Math.abs(dx));
      const d = Math.max(50, Math.abs(dz));
      const midX = (startPoint.x + currentPoint.x) / 2;
      const midZ = (startPoint.z + currentPoint.z) / 2;
      const midY = height / 2;

      const geo = new THREE.BoxGeometry(w, height, d);
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, midY, midZ);

      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: edgeColor, linewidth: 2 });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(edges);

      this.drawingPreviewGroup.add(mesh);
    } else {
      // Wall or Beam (linear stroke extrusion)
      const isBeam = type === 'beam';
      const actualHeight = isBeam ? (height || 400) : (height || 2600);
      const actualThickness = isBeam ? (thickness || 300) : (thickness || 150);
      const elevationY = isBeam ? 2400 : 0;
      const midY = isBeam ? elevationY - actualHeight / 2 : actualHeight / 2;

      const midX = (startPoint.x + currentPoint.x) / 2;
      const midZ = (startPoint.z + currentPoint.z) / 2;

      const geo = new THREE.BoxGeometry(length, actualHeight, actualThickness);
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.65,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(midX, midY, midZ);
      mesh.rotation.y = -angleRad;

      const edgesGeo = new THREE.EdgesGeometry(geo);
      const edgesMat = new THREE.LineBasicMaterial({ color: edgeColor, linewidth: 2 });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(edges);

      // Add ground guideline
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(startPoint.x, 2, startPoint.z),
        new THREE.Vector3(currentPoint.x, 2, currentPoint.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: edgeColor,
        dashSize: 40,
        gapSize: 20,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      this.drawingPreviewGroup.add(line);

      this.drawingPreviewGroup.add(mesh);
    }

    this.drawingPreviewGroup.visible = true;
  }

  /**
   * Hides the dynamic drawing preview
   */
  public hideDrawingPreview() {
    this.drawingPreviewGroup.visible = false;
  }

  /**
   * Adjusts mouse buttons, touch gestures, and rotation lock for 2D Plan vs 3D Orbit modes
   */
  public updateControlModes(is2DMode = false) {
    if (!this.controls) return;

    if (is2DMode) {
      this.controls.enableRotate = false;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.controls.touches = {
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    } else {
      this.controls.enableRotate = true;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
    }
  }

  /**
   * Switches camera to Top-Down 2D plan view for drawing walls / beams
   */
  public switchToTopDownView(target?: Vector3D) {
    if (!this.savedCameraState) {
      this.savedCameraState = {
        position: this.activeCamera.position.clone(),
        target: this.controls.target.clone(),
        isOrtho: this.activeCamera === this.orthographicCamera,
      };
    }

    const t = target ?? { x: 0, y: 0, z: 0 };
    this.controls.target.set(t.x, 0, t.z);

    // Switch to orthographic camera looking straight down
    const aspect = (this.container.clientWidth || window.innerWidth) / (this.container.clientHeight || window.innerHeight);
    const frustumSize = 4000;
    this.orthographicCamera.left = (frustumSize * aspect) / -2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = frustumSize / -2;
    this.orthographicCamera.near = -100000;
    this.orthographicCamera.far = 100000;
    this.orthographicCamera.zoom = 1;
    this.orthographicCamera.up.set(0, 0, -1);
    this.orthographicCamera.position.set(t.x, 5000, t.z);
    this.orthographicCamera.lookAt(t.x, 0, t.z);
    this.orthographicCamera.updateProjectionMatrix();

    this.activeCamera = this.orthographicCamera;
    this.controls.object = this.activeCamera;
    this.updateControlModes(true);
    this.controls.update();
  }

  /**
   * Restores previous camera state from before drawing mode
   */
  public restoreCameraState() {
    if (!this.savedCameraState) {
      // Default to 3D Iso view
      this.setCameraPreset('iso');
      this.setCameraMode('perspective');
      this.updateControlModes(false);
      return;
    }

    const { position, target, isOrtho } = this.savedCameraState;
    this.savedCameraState = null;

    if (isOrtho) {
      this.activeCamera = this.orthographicCamera;
    } else {
      this.activeCamera = this.perspectiveCamera;
    }

    this.activeCamera.up.set(0, 1, 0);
    this.activeCamera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.object = this.activeCamera;
    this.updateControlModes(false);
    this.controls.update();
  }

  /**
   * Finds the target CabinetCell under the screen coordinates (clientX, clientY)
   * Uses both 3D Box ray-intersection for empty cells and mesh intersection for populated cells.
   */
  public findCellAtScreenPos(
    clientX: number,
    clientY: number,
    allCells: CabinetCell[]
  ): CabinetCell | null {
    if (!allCells || allCells.length === 0) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.activeCamera);

    // 1. Direct ray intersection with all 3D cell bounding boxes (accurate for open cabinet front)
    let bestCell: CabinetCell | null = null;
    let minDistance = Infinity;
    const intersectPoint = new THREE.Vector3();

    for (const cell of allCells) {
      const box = new THREE.Box3(
        new THREE.Vector3(cell.minX, cell.minY, cell.minZ),
        new THREE.Vector3(cell.maxX, cell.maxY, cell.maxZ)
      );

      if (this.raycaster.ray.intersectBox(box, intersectPoint)) {
        const dist = this.raycaster.ray.origin.distanceTo(intersectPoint);
        if (dist < minDistance) {
          minDistance = dist;
          bestCell = cell;
        }
      }
    }

    if (bestCell) {
      return bestCell;
    }

    // 2. Supplementary check: raycast against panels / shelves in scene
    const interactiveMeshes: THREE.Object3D[] = [];
    this.objectMeshMap.forEach((group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.objectId) {
          interactiveMeshes.push(child);
        }
      });
    });

    const hits = this.raycaster.intersectObjects(interactiveMeshes, true);
    if (hits.length > 0) {
      const hitPoint = hits[0].point;
      const found = CellDetector.findCellAtPoint(hitPoint, allCells, 200);
      if (found) return found;
    }

    return null;
  }

  /**
   * Switches Render Mode: 'sketch' | 'realistic' | 'unpainted' | 'wood_textured'
   */
  public setRenderMode(mode: RenderMode, objects: SceneObject[], selectedIds: Set<string>) {
    this.currentRenderMode = mode;

    if (mode === 'sketch') {
      this.scene.background = new THREE.Color('#ffffff');
      this.ambLight.intensity = 1.0;
      this.dirLight.castShadow = false;
      this.gridHelper.visible = false;
    } else if (mode === 'unpainted') {
      this.scene.background = new THREE.Color('#1e293b');
      this.ambLight.intensity = 0.8;
      this.dirLight.castShadow = true;
      this.gridHelper.visible = true;
    } else if (mode === 'wood_textured') {
      this.scene.background = new THREE.Color('#0b1120');
      this.ambLight.intensity = 0.8;
      this.hemiLight.intensity = 0.7;
      this.dirLight.castShadow = true;
      this.gridHelper.visible = true;
    } else {
      // Realistic
      this.scene.background = new THREE.Color('#0f172a');
      this.ambLight.intensity = 0.7;
      this.dirLight.castShadow = true;
      this.gridHelper.visible = true;
    }

    this.syncObjects(objects, selectedIds);
  }

  /**
   * Switches Camera Mode: 'perspective' | 'orthographic'
   */
  public setCameraMode(mode: CameraMode) {
    this.currentCameraMode = mode;
    const oldCam = this.activeCamera;

    if (mode === 'orthographic') {
      this.orthographicCamera.position.copy(oldCam.position);
      this.orthographicCamera.rotation.copy(oldCam.rotation);
      this.orthographicCamera.up.copy(oldCam.up);
      this.orthographicCamera.updateProjectionMatrix();
      this.activeCamera = this.orthographicCamera;
    } else {
      this.perspectiveCamera.position.copy(oldCam.position);
      this.perspectiveCamera.rotation.copy(oldCam.rotation);
      this.perspectiveCamera.up.copy(oldCam.up);
      this.perspectiveCamera.updateProjectionMatrix();
      this.activeCamera = this.perspectiveCamera;
    }

    this.controls.object = this.activeCamera;
    this.controls.update();
  }

  /**
   * Sets Standard Camera Angles: 3D Iso, Front, Top, Left, Right, Back
   */
  public setCameraPreset(preset: CameraPreset, target?: Vector3D) {
    const t = target ?? { x: 0, y: 800, z: 0 };
    this.controls.target.set(t.x, t.y, t.z);

    const dist = 2500;

    switch (preset) {
      case 'front':
        this.activeCamera.up.set(0, 1, 0);
        this.activeCamera.position.set(t.x, t.y, t.z - dist);
        this.updateControlModes(false);
        break;
      case 'back':
        this.activeCamera.up.set(0, 1, 0);
        this.activeCamera.position.set(t.x, t.y, t.z + dist);
        this.updateControlModes(false);
        break;
      case 'top':
        this.activeCamera.up.set(0, 0, -1);
        this.activeCamera.position.set(t.x, t.y + dist, t.z);
        this.updateControlModes(true);
        break;
      case 'left':
        this.activeCamera.up.set(0, 1, 0);
        this.activeCamera.position.set(t.x - dist, t.y, t.z);
        this.updateControlModes(false);
        break;
      case 'right':
        this.activeCamera.up.set(0, 1, 0);
        this.activeCamera.position.set(t.x + dist, t.y, t.z);
        this.updateControlModes(false);
        break;
      case 'iso':
      default:
        this.activeCamera.up.set(0, 1, 0);
        this.activeCamera.position.set(t.x + 1500, t.y + 1200, t.z - 2000);
        this.updateControlModes(false);
        break;
    }

    this.activeCamera.lookAt(t.x, t.y, t.z);
    if (this.activeCamera instanceof THREE.OrthographicCamera || this.activeCamera instanceof THREE.PerspectiveCamera) {
      this.activeCamera.updateProjectionMatrix();
    }
    this.controls.update();
  }

  /**
   * Resize Handler for Window & Orientation changes
   */
  public handleResize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const aspect = width / height;

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    const frustumSize = 2500;
    this.orthographicCamera.left = (frustumSize * aspect) / -2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = frustumSize / -2;
    this.orthographicCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Main render loop
   */
  private animate = () => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();

    // Pulse cell highlight when active
    if (this.cellHighlightGroup && this.cellHighlightGroup.visible) {
      const pulse = 0.35 + Math.sin(performance.now() * 0.007) * 0.15;
      (this.cellHighlightMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    this.renderer.render(this.scene, this.activeCamera);
  };

  /**
   * Raycast from client screen coordinate to find ground/cell plane intersection
   */
  public getIntersectionFromScreen(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.activeCamera);

    // Test intersection with ground or cabinets
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(groundPlane, targetPoint);

    return hit ? targetPoint : null;
  }

  /**
   * Takes a high-resolution screenshot of the 3D scene
   */
  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.activeCamera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
