import * as THREE from "three";
import {
  MeshStandardMaterial,
  SphereGeometry,
  Color,
  FrontSide,
  GreaterDepth,
  IncrementStencilOp,
  DecrementStencilOp,
  Vector2,
  Vector3,
  BackSide,
  Raycaster,
  Mesh,
  Ray,
  Plane,
  PlaneGeometry,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from "dat.gui";
import { Curve } from "../Curve";

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
camera.position.set(15, 20, 15);
camera.lookAt(0, 0, 0);

//some hills
const plane = new THREE.Mesh(
  new PlaneGeometry(30, 30, 20, 20),
  //shaded material first
  new MeshStandardMaterial({
    color: 0xaa0000,
    emissive: 0x300000,
    roughness: 1,
    metalness: 0,
    stencilWrite: true,
    stencilRef: 1,
    stencilZPass: THREE.ReplaceStencilOp,
  })
);
//draw this after main stuff
plane.renderOrder = 2;
scene.add(plane);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
const vert = plane.geometry.attributes.position;
for (let i = 2; i < vert.count * 3; i += 3) {
  vert.array[i] = Math.random();
}
plane.geometry.computeVertexNormals();

//some objects on terrain
const sg = new SphereGeometry(1, 10, 10);
for (let i = 0; i < 10; i++) {
  const mesh = new THREE.Mesh(
    sg,
    new MeshStandardMaterial({ roughness: 1, metalness: 0 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.x = Math.random() * 30 - 15;
  mesh.position.z = Math.random() * 30 - 15;
  mesh.position.y = 1;
  scene.add(mesh);
}

const dl = new THREE.DirectionalLight();
dl.castShadow = true;
dl.position.set(-10, 10, 10);
dl.shadow.camera.left = -20;
dl.shadow.camera.right = 20;
dl.shadow.camera.top = 20;
dl.shadow.camera.bottom = -20;
scene.add(dl);

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;

const HEIGHT = 10;
const curve = new Curve();
scene.add(curve);
curve.getA().set(-5, HEIGHT, -5);
curve.getB().set(-0, HEIGHT, 5);
curve.getC().set(10, HEIGHT, 5);
curve.getD().set(10, HEIGHT, 10);

curve.thickLine.position.y = HEIGHT;
scene.add(curve.thickLine);

scene.add(curve.controls);
const vertices = curve.controls.children.filter((c) => c instanceof Mesh);

const clone = (mesh) => {
  const newMesh = mesh.clone();
  newMesh.material = mesh.material.clone();
  newMesh.material.uniforms = { ...newMesh.material.uniforms };
  newMesh.material.uniforms.uColor.value = new Color();
  newMesh.material.stencilWrite = true;
  newMesh.material.depthWrite = false;
  newMesh.material.colorWrite = false;

  return newMesh;
};
const firstPass = clone(curve.extrusion);
firstPass.material.side = BackSide;
firstPass.material.stencilZFail = IncrementStencilOp;
firstPass.renderOrder = 3;
// scene.add(firstPass);

const secondPass = clone(curve.extrusion);
secondPass.material.stencilZFail = DecrementStencilOp;
secondPass.renderOrder = 4;
scene.add(secondPass);

const lightPass = plane.clone();
lightPass.material = new MeshStandardMaterial({
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc,
  metalness: 0,
  roughness: 1,
  depthFunc: THREE.EqualDepth,
});
lightPass.renderOrder = 5;
scene.add(lightPass);

const mouse = new Vector2();
const raycaster = new Raycaster();
let hovered = null;
let mouseDown = false;
const onMouseMove = (evt) => {
  mouse.set(evt.clientX, evt.clientY);
  mouse.x /= window.innerWidth;
  mouse.y /= window.innerHeight;
  mouse.multiplyScalar(2);
  mouse.subScalar(1);
  mouse.y = -mouse.y;
};
const ray = new Ray();
const WORK_VEC3 = new Vector3();
const WORK_PLANE = new Plane();
WORK_PLANE.normal.set(0, 1, 0);
WORK_PLANE.constant = -HEIGHT;

const onMouseDown = (evt) => {
  if (!hovered) return;
  controls.enabled = false;
  const onUp = () => {
    controls.enabled = true;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  const onMove = () => {
    ray.origin.copy(camera.position);
    WORK_VEC3.set(mouse.x, mouse.y, 0.5);
    WORK_VEC3.unproject(camera);
    ray.direction.copy(WORK_VEC3).sub(camera.position).normalize();

    ray.intersectPlane(WORK_PLANE, hovered.position);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
};
document.addEventListener("mousemove", onMouseMove);
document.addEventListener("mousedown", onMouseDown);

let time = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  time += clock.getDelta();
  renderer.render(scene, camera);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(vertices);
  if (intersects.length > 0) {
    hovered = intersects[0].object;
  } else {
    hovered = null;
  }
  vertices.forEach((v) => {
    if (hovered === v) {
      v.material.setHightlight(true);
    } else {
      v.material.setHightlight(false);
    }
  });
}
animate();

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener("resize", onWindowResize);
