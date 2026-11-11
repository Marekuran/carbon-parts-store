import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const viewport = document.querySelector('#viewport');
const stage = document.querySelector('.studio-stage');
const productsByCategory = {
  wheels: { label: 'Forged wheels', filter: 'Wheels', description: 'Explore forged profiles and finishes. Confirm size, offset, bolt pattern and brake clearance before purchase.' },
  steering: { label: 'Steering & cockpit', filter: 'Interior', description: 'Explore tactile cockpit upgrades for the point where you meet the road.' },
  seats: { label: 'Performance seats', filter: 'Seats', description: 'Find supportive forms and premium upholstery for your cockpit.' },
  hood: { label: 'Hood & front aero', filter: 'Exterior', description: 'Explore carefully shaped exterior details for the front profile.' },
  exhaust: { label: 'Exhaust details', filter: 'Exhaust', description: 'Refine the rear profile with considered exhaust finishes.' },
  brakes: { label: 'Performance brakes', filter: 'Brakes', description: 'Browse braking upgrades selected for confident, consistent feel.' },
  body: { label: 'Body & exterior', filter: 'Exterior', description: 'Explore subtle exterior upgrades shaped for the silhouette.' },
  mirrors: { label: 'Mirrors', filter: 'Exterior', description: 'Explore mirror details. Confirm exact mirror housing and option fitment before purchase.' },
  lights: { label: 'Lighting', filter: 'Exterior', description: 'Browse lighting details. Verify lamp codes, connectors and road-use approval for your car.' },
  spoiler: { label: 'Spoiler & rear aero', filter: 'Exterior', description: 'Explore rear aero details. Confirm body style, mounting points and road clearance.' },
  dashboard: { label: 'Dashboard & displays', filter: 'Carbon Fiber', description: 'Refine the dash with carbon surfaces and precise details.' },
  selector: { label: 'Gear & controls', filter: 'Carbon Fiber', description: 'Discover considered gear selectors and cockpit controls.' },
  doors: { label: 'Door & cockpit trim', filter: 'Carbon Fiber', description: 'Bring the same material quality to every surface you touch.' },
  trim: { label: 'Carbon trim', filter: 'Carbon Fiber', description: 'Explore directional weave, forged carbon and refined finishes.' },
  interior: { label: 'Interior collection', filter: 'Interior', description: 'Browse compatible steering, seating and cockpit upgrades.' }
};

let scene, camera, renderer, controls, vehicle, mixer;
let selectedCategory = 'all';
let selectedAnchor = null;
let initialCameraPosition, initialCameraTarget;
let modelMeshes = [];
let previouslySaved = [];
try { previouslySaved = JSON.parse(localStorage.getItem('carbon:savedBuild') || '[]'); } catch { previouslySaved = []; }
const savedBuild = new Set(Array.isArray(previouslySaved) ? previouslySaved : []);
const exploredParts = new Set(savedBuild);
const partLabels = { wheels: 'Wheels', seats: 'Seats', steering: 'Steering', hood: 'Hood', exhaust: 'Exhaust', brakes: 'Brakes', body: 'Body', mirrors: 'Mirrors', lights: 'Lights', spoiler: 'Spoiler' };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const callout = document.querySelector('#studioProduct');
const line = document.querySelector('#calloutPath');
const dot = document.querySelector('#calloutDot');

function categoryForName(rawName = '') {
  const name = rawName.toLowerCase();
  if (/badge|plate_text|logo|emblem|registration plate|license plate/.test(name)) return 'branding';
  if (/steering|steer_input/.test(name)) return 'steering';
  if (/brake_disc|brake_hat|caliper|brake/.test(name)) return 'brakes';
  if (/exhaust|tailpipe|muffler/.test(name)) return 'exhaust';
  if (/hood|bonnet/.test(name)) return 'hood';
  if (/mirror/.test(name)) return 'mirrors';
  if (/headlight|tail_light|taillight|lamp|light/.test(name)) return 'lights';
  if (/spoiler|rear_wing|wing/.test(name)) return 'spoiler';
  if (/tire|tyre|sidewall|rim|spoke|wheel(?!house)|hub/.test(name)) return 'wheels';
  if (/seat|bolster|headrest|shoulder_belt/.test(name)) return 'seats';
  if (/wheelhouse|arch_liner|fender/.test(name)) return 'body';
  if (/shift_selector|gear|selector/.test(name)) return 'selector';
  if (/dashboard|dash_|display|gauge|instrument panel|cockpit|interior carpet|center_tunnel|centre tunnel|center console/.test(name)) return 'dashboard';
  if (/door_panel|door_skin|door_accent|door_carbon|door_handle|door pull|door shut seam/.test(name)) return 'doors';
  if (/trim|carbon|vent|grille|splitter|wing|diffuser|headlight|tail_light|mirror|fender|wheelhouse/.test(name)) return 'trim';
  if (/glass|windshield|window|roof|body_shell|shell|undertray|subframe/.test(name)) return 'shell';
  return 'body';
}

function isInteriorCategory(category) {
  return ['steering', 'seats', 'dashboard', 'selector', 'doors', 'interior'].includes(category);
}

function isSelected(category) {
  if (selectedCategory === 'all') return true;
  if (selectedCategory === 'interior') return isInteriorCategory(category);
  if (selectedCategory === 'body') return ['body', 'shell', 'trim'].includes(category);
  if (selectedCategory === 'brakes') return category === 'brakes';
  if (selectedCategory === 'trim') return ['trim', 'dashboard', 'doors'].includes(category);
  return category === selectedCategory;
}

function blackMaterial(source) {
  const clone = source.clone();
  if (clone.color) clone.color.multiplyScalar(0.11);
  if (clone.emissive) clone.emissive.setRGB(0, 0, 0);
  clone.roughness = Math.max(clone.roughness ?? 0.5, 0.7);
  clone.metalness = Math.min(clone.metalness ?? 0.1, 0.2);
  clone.needsUpdate = true;
  return clone;
}


function materialForGhost(source) {
  const clone = source.clone();
  clone.transparent = true;
  clone.opacity = 0.42;
  clone.depthWrite = false;
  clone.needsUpdate = true;
  return clone;
}

function prepareMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.carbonCategory = categoryForName(mesh.name);
  mesh.userData.carbonOriginalVisible = mesh.visible;
  mesh.userData.carbonOriginalMaterial = mesh.material;
  mesh.userData.carbonBlackMaterial = Array.isArray(mesh.material)
    ? mesh.material.map(blackMaterial)
    : blackMaterial(mesh.material);
  mesh.userData.carbonGhostMaterial = Array.isArray(mesh.userData.carbonBlackMaterial)
    ? mesh.userData.carbonBlackMaterial.map(materialForGhost)
    : materialForGhost(mesh.userData.carbonBlackMaterial);
  if (mesh.userData.carbonCategory === 'branding') mesh.visible = false;
  modelMeshes.push(mesh);
}

function addHoodSelectableSurface(root) {
  const body = modelMeshes.find(mesh => /sculpted[_ ]body[_ ]shell/i.test(mesh.name)
    && (Array.isArray(mesh.material) ? mesh.material.some(material => material.name === 'paint') : mesh.material?.name === 'paint'));
  const position = body?.geometry?.getAttribute('position');
  const normal = body?.geometry?.getAttribute('normal');
  const index = body?.geometry?.index;
  if (!body || !position || !index) return;
  const paintGroup = body.geometry.groups.find(group => body.material[group.materialIndex]?.name === 'paint');
  if (Array.isArray(body.material) && !paintGroup) return;
  const positions = [];
  const normals = [];
  const triangleCount = Math.floor(((paintGroup?.count ?? index.count)) / 3);
  const start = paintGroup?.start ?? 0;
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const ids = [index.getX(start + triangle * 3), index.getX(start + triangle * 3 + 1), index.getX(start + triangle * 3 + 2)];
    const center = ids.reduce((sum, id) => sum + position.getX(id), 0) / 3;
    const height = ids.reduce((sum, id) => sum + position.getY(id), 0) / 3;
    // In this model the nose and hood sit at negative X; positive X is the rear.
    if (center > -1.12 || height < 0.44) continue;
    for (const id of ids) {
      positions.push(position.getX(id), position.getY(id), position.getZ(id));
      if (normal) normals.push(normal.getX(id), normal.getY(id), normal.getZ(id));
    }
  }
  if (!positions.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  const hoodPaint = Array.isArray(body.material) ? body.material[paintGroup.materialIndex] : body.material;
  const hood = new THREE.Mesh(geometry, hoodPaint.clone());
  hood.name = 'Hood selectable surface';
  hood.position.copy(body.position);
  hood.quaternion.copy(body.quaternion);
  hood.scale.copy(body.scale);
  hood.renderOrder = body.renderOrder + 1;
  hood.castShadow = false;
  hood.receiveShadow = true;
  hood.userData.carbonCategory = 'hood';
  hood.userData.carbonOriginalVisible = true;
  hood.userData.carbonOriginalMaterial = hood.material;
  hood.userData.carbonBlackMaterial = blackMaterial(hood.material);
  hood.userData.carbonGhostMaterial = materialForGhost(hood.userData.carbonBlackMaterial);
  body.parent.add(hood);
  modelMeshes.push(hood);
}

function groupBounds(category) {
  const bounds = new THREE.Box3();
  let found = false;
  for (const mesh of modelMeshes) {
    if (!isSelectedForBounds(mesh.userData.carbonCategory, category) || !mesh.visible) continue;
    bounds.expandByObject(mesh);
    found = true;
  }
  return found ? bounds : new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
}

function isSelectedForBounds(meshCategory, category) {
  if (category === 'all') return meshCategory !== 'branding';
  if (category === 'interior') return isInteriorCategory(meshCategory);
  if (category === 'body') return ['body', 'shell', 'trim'].includes(meshCategory);
  if (category === 'trim') return ['trim', 'dashboard', 'doors'].includes(meshCategory);
  return meshCategory === category;
}

function setInteriorCutaway(active) {
  for (const mesh of modelMeshes) {
    const name = mesh.name.toLowerCase();
    const transparentPart = /glass|windshield|window/.test(name);
    mesh.visible = mesh.userData.carbonOriginalVisible && !(active && transparentPart);
  }
}

function syncPartAvailability() {
  document.querySelectorAll('.part-btn[data-part]:not([data-part="all"])').forEach(button => {
    const category = button.dataset.part;
    const available = modelMeshes.some(mesh => isSelectedForBounds(mesh.userData.carbonCategory, category));
    button.disabled = !available;
    if (!available) {
      button.title = `${button.textContent.trim()} is not modeled on this vehicle`;
      button.setAttribute('aria-label', `${button.textContent.trim()}, not present on this model`);
    } else {
      button.removeAttribute('title');
      button.removeAttribute('aria-label');
    }
  });
}

function applySelection() {
  if (!vehicle) return;
  const interior = selectedCategory !== 'all' && (isInteriorCategory(selectedCategory));
  setInteriorCutaway(interior);
  for (const mesh of modelMeshes) {
    if (mesh.userData.carbonCategory === 'branding') continue;
    if (selectedCategory !== 'all' && isSelected(mesh.userData.carbonCategory)) mesh.material = mesh.userData.carbonOriginalMaterial;
    else if (interior) mesh.material = mesh.userData.carbonGhostMaterial;
    else mesh.material = mesh.userData.carbonBlackMaterial;
  }
}

function getAnchor(category) {
  const preferred = {
    wheels: /front.*(left|right)|tire|tyre|wheel(?!house)|rim|spoke/,
    steering: /steering.*wheel|steer.*wheel/,
    seats: /seat|bolster|headrest/,
    hood: /hood|bonnet|front.*panel/,
    exhaust: /exhaust|tailpipe|muffler/,
    brakes: /brake_disc|brake caliper|caliper|brake/,
    dashboard: /dashboard|instrument|display|gauge|cockpit/,
    selector: /selector|shifter|gear/,
    doors: /door.*(panel|trim|handle)/,
    trim: /splitter|wing|diffuser|carbon|trim/,
    body: /body shell|body_shell|bumper|fender|grille/,
    interior: /steering.*wheel|seat|dashboard|instrument|center.*console/
  }[category];
  const candidates = modelMeshes.filter(mesh => isSelectedForBounds(mesh.userData.carbonCategory, category) && mesh.visible);
  if (candidates.length) {
    candidates.sort((a, b) => Number(preferred?.test(b.name.toLowerCase()) ?? false) - Number(preferred?.test(a.name.toLowerCase()) ?? false));
    const box = new THREE.Box3().setFromObject(candidates[0]);
    if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
  }
  return groupBounds(category).getCenter(new THREE.Vector3());
}

function updateCallout() {
  if (!renderer || !selectedAnchor || !callout.classList.contains('open')) {
    line.setAttribute('d', '');
    dot.setAttribute('visibility', 'hidden');
    return;
  }
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const projected = selectedAnchor.clone().project(camera);
  const ax = (projected.x * 0.5 + 0.5) * w;
  const ay = (-projected.y * 0.5 + 0.5) * h;
  if (projected.z > 1 || ax < -10 || ax > w + 10 || ay < -10 || ay > h + 10) {
    line.setAttribute('d', '');
    dot.setAttribute('visibility', 'hidden');
    return;
  }
  const cw = callout.offsetWidth || 254;
  const ch = callout.offsetHeight || 160;
  const rightFits = ax + 64 + cw <= w - 12;
  const leftFits = ax - cw - 64 >= 12;
  const wideStage = w > 1000;
  const leftSide = wideStage ? true : !rightFits && (leftFits || ax > w * 0.5);
  const cardX = wideStage ? 12 : leftSide ? Math.max(12, ax - cw - 64) : Math.min(w - cw - 12, ax + 64);
  const stageTop = stage.getBoundingClientRect().top;
  const visibleBelowNav = Math.max(78, 92 - stageTop);
  const cardY = w < 700
    ? Math.min(Math.max(58, 88 - stageTop), h - ch - 85)
    : wideStage ? Math.min(200, h - ch - 85) : Math.min(Math.max(88, visibleBelowNav), h - ch - 85);
  callout.style.left = `${cardX}px`;
  callout.style.right = 'auto';
  callout.style.bottom = 'auto';
  callout.style.top = `${cardY}px`;
  const endX = leftSide ? cardX + cw : cardX;
  const endY = Math.max(cardY + 17, Math.min(ay, cardY + ch - 17));
  const bend = leftSide ? -28 : 28;
  line.setAttribute('d', `M ${ax} ${ay} C ${ax + bend} ${ay}, ${endX - bend} ${endY}, ${endX} ${endY}`);
  dot.setAttribute('cx', ax);
  dot.setAttribute('cy', ay);
  dot.setAttribute('visibility', 'visible');
}

function setView(position, target = new THREE.Vector3(0, 0, 0)) {
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
}

function selectPart(category, point) {
  selectedCategory = category;
  // Toolbar selections must calculate a fresh category anchor. The old anchor
  // is retained only for a direct raycast selection, where point is supplied.
  selectedAnchor = null;
  selectedAnchor = point?.clone() ?? (category === 'all' ? null : getAnchor(category));
  if (category !== 'all' && partLabels[category]) {
    exploredParts.add(category);
    renderBuildSummary();
  }
  document.querySelectorAll('.part-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.part === category);
  });
  if (category === 'all') {
    callout.classList.remove('open');
    setInteriorCutaway(false);
    applySelection();
    line.setAttribute('d', '');
    dot.setAttribute('visibility', 'hidden');
    return;
  }
  const info = productsByCategory[category] || productsByCategory.body;
  const detailNumber = { wheels: '01', steering: '02', seats: '03', hood: '04', exhaust: '05', brakes: '06', body: '07', mirrors: '08', lights: '09', spoiler: '10', dashboard: '11', selector: '12', doors: '13', trim: '14', interior: '15' };
  document.querySelector('#partEyebrow').textContent = `SELECTED DETAIL / ${detailNumber[category] || '08'}`;
  document.querySelector('#partTitle').textContent = info.label;
  document.querySelector('#partDesc').textContent = info.description;
  document.querySelector('#partAction').querySelector('span:first-child').textContent = `Browse ${info.filter === 'Interior' ? 'interior' : info.filter.toLowerCase()} upgrades`;
  callout.classList.add('open');
  applySelection();
}

function renderBuildSummary() {
  const list = document.querySelector('#buildParts');
  if (!list) return;
  list.innerHTML = exploredParts.size
    ? [...exploredParts].map(key => `<span class="build-chip">${partLabels[key] || key}</span>`).join('')
    : '<span class="build-empty">Choose details on the car to start a build.</span>';
  const save = document.querySelector('#saveBuild');
  const isSaved = [...exploredParts].length > 0 && [...exploredParts].every(key => savedBuild.has(key));
  save?.setAttribute('aria-pressed', String(isSaved));
  if (save) save.innerHTML = isSaved ? 'Build saved <span>✓</span>' : 'Save this build <span>＋</span>';
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);
  scene.fog = new THREE.Fog(0x0b0d10, 15, 30);
  camera = new THREE.PerspectiveCamera(viewport.clientWidth < 700 ? 48 : 32, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
  camera.position.set(5.7, 2.45, 6.2);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc8d3df, 0x17191c, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(0xa9bcd2, 1.7);
  rimLight.position.set(-5, 4, -5);
  scene.add(rimLight);
  const stripLight = new THREE.DirectionalLight(0xffffff, 0.7);
  stripLight.position.set(1, 3, -6);
  scene.add(stripLight);

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x080a0c, metalness: 0.12, roughness: 0.68 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.86;
  floor.receiveShadow = true;
  scene.add(floor);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2.7;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.enablePan = true;
}

function fitModel(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  const dimensions = bounds.getSize(new THREE.Vector3());
  root.position.sub(center);
  root.updateMatrixWorld(true);
  const normalized = dimensions.x > 0 ? 5.8 / dimensions.x : 1;
  root.scale.setScalar(normalized);
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  const floor = scene.children.find(o => o.geometry?.type === 'PlaneGeometry');
  if (floor) floor.position.y = fitted.min.y + 0.018;
  controls.target.set(0, 0, 0);
  const mobile = viewport.clientWidth < 700;
  camera.fov = mobile ? 48 : 32;
  camera.position.set(mobile ? 6.2 : 5.25, mobile ? 1.9 : 2.15, mobile ? 6.2 : 5.8);
  initialCameraPosition = camera.position.clone();
  initialCameraTarget = controls.target.clone();
}

function loadModel() {
  const query = new URLSearchParams(location.search).get('model');
  const source = query || window.CARBON_MODEL_URL || './assets/unbranded-mid-engine-supercar.glb';
  new GLTFLoader().load(source, gltf => {
    vehicle = gltf.scene;
    vehicle.name = 'unbranded_mid_engine_supercar';
    modelMeshes = [];
    vehicle.traverse(object => { if (object.isMesh) prepareMesh(object); });
    addHoodSelectableSurface(vehicle);
    scene.add(vehicle);
    fitModel(vehicle);
    syncPartAvailability();
    mixer = new THREE.AnimationMixer(vehicle);
    document.querySelector('.loading').style.display = 'none';
    document.querySelector('.model-note').textContent = 'UNBRANDED MID-ENGINE SUPERCAR · CC0 · DRAG TO ORBIT';
    if (gltf.animations.length) {
      document.querySelector('#viewInterior').setAttribute('aria-label', 'Open cabin view');
    }
    applySelection();
  }, progress => {
    if (progress.total) document.querySelector('.loading span:last-child').textContent = `LOADING VEHICLE ${Math.round(progress.loaded / progress.total * 100)}%`;
  }, error => {
    console.error('CARBON vehicle GLB could not load:', error);
    document.querySelector('.loading').innerHTML = '<span>VEHICLE MODEL FAILED TO LOAD · REFRESH TO RETRY</span>';
  });
}

function resize() {
  if (!renderer) return;
  camera.aspect = viewport.clientWidth / viewport.clientHeight;
  camera.fov = viewport.clientWidth < 700 ? 48 : 32;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  const svg = document.querySelector('.callout-svg');
  svg.setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
}

function animate() {
  requestAnimationFrame(animate);
  mixer?.update(1 / 60);
  controls?.update();
  renderer?.render(scene, camera);
  updateCallout();
}

export function initConfigurator() {
  if (!('WebGLRenderingContext' in window)) {
    viewport.innerHTML = '<div class="preview-error"><strong>WebGL is unavailable.</strong><span>This browser does not expose WebGL to the page.</span><small>Try current Chrome or Edge with hardware acceleration enabled.</small></div>';
    return;
  }
  try {
    setupScene();
    loadModel();
    const dom = renderer.domElement;
    let pointerStart = null;
    dom.addEventListener('pointerdown', event => { pointerStart = event.button === 0 ? [event.clientX, event.clientY] : null; });
    dom.addEventListener('pointerup', event => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 7) { pointerStart = null; return; }
      pointerStart = null;
      const rect = dom.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(modelMeshes, false).filter(item => item.object.visible && item.object.userData.carbonCategory !== 'branding');
      const nearest = hits[0];
      const hoodHit = nearest && hits.find(item => item.object.userData.carbonCategory === 'hood' && item.distance <= nearest.distance + 0.002);
      const hit = hoodHit || nearest;
      if (hit) selectPart(hit.object.userData.carbonCategory, hit.point);
    });
    dom.addEventListener('pointermove', event => {
      const rect = dom.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      dom.style.cursor = raycaster.intersectObjects(modelMeshes, false).some(item => item.object.visible) ? 'crosshair' : 'grab';
    });
    document.querySelectorAll('.part-btn').forEach(button => button.onclick = () => selectPart(button.dataset.part));
    document.querySelector('#resetView').onclick = () => {
      selectPart('all');
      if (initialCameraPosition && initialCameraTarget) setView(initialCameraPosition, initialCameraTarget);
    };
    document.querySelector('#partAction').onclick = () => {
      const info = productsByCategory[selectedCategory] || productsByCategory.body;
      window.setActiveCollection?.(info.filter, '992gt3rs', selectedCategory === 'all' ? '' : (selectedCategory === 'interior' ? 'interior' : selectedCategory));
    };
    document.querySelector('#saveBuild').onclick = () => {
      if (!exploredParts.size) return;
      savedBuild.clear();
      exploredParts.forEach(key => savedBuild.add(key));
      localStorage.setItem('carbon:savedBuild', JSON.stringify([...savedBuild]));
      renderBuildSummary();
    };
    renderBuildSummary();
    document.querySelector('#viewFront').onclick = () => setView(new THREE.Vector3(7, 1.8, 0.15));
    document.querySelector('#viewSide').onclick = () => setView(new THREE.Vector3(0.15, 1.8, 7));
    document.querySelector('#viewRear').onclick = () => setView(new THREE.Vector3(-7, 1.8, 0.15));
    document.querySelector('#viewInterior').onclick = () => selectPart('interior');
    document.querySelector('#closeStudio').onclick = () => selectPart('all');
    new ResizeObserver(resize).observe(viewport);
    resize();
    animate();
  } catch (error) {
    console.error('CARBON 3D initialization failed:', error);
    viewport.innerHTML = `<div class="preview-error"><strong>3D preview could not start.</strong><span>${String(error.message || error).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span><small>Check browser WebGL support and reload.</small></div>`;
  }
}
