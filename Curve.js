import {
    BufferGeometry,
    Object3D,
    ShaderMaterial,
    Vector3,
    Mesh,
    Line,
    MeshBasicMaterial,
    Color,
    LineSegments,
    BoxGeometry,
    PlaneGeometry,
    AxesHelper,
    DoubleSide,
  } from "three";
  
  const GLSL_BEZIER = `
  vec3 bezier(vec3 A, vec3 B, vec3 C, vec3 D, float t, out vec3 normal) {
      vec3 E = mix(A, B, t);
      vec3 F = mix(B, C, t);
      vec3 G = mix(C, D, t);
    
      vec3 H = mix(E, F, t);
      vec3 I = mix(F, G, t);
    
      vec3 dE = (B - A);
      vec3 dF = (C - B);
      vec3 dG = (D - C);
      vec3 dH = (dF - dE) * t + dE;
      vec3 dI = (dG - dF) * t + dF;
      vec3 derivative = (dI - dH) * t + dH;
  
      vec3 P = mix(H, I, t);
    
      vec3 up = vec3(0.0, 1.0, 0.0);
      normal = cross(derivative, up);
      normal = normalize(normal);
  
      return P;
  }
  `;
  
  const fragmentShader = `
  uniform vec3 uColor;
  uniform float uAlpha;
  void main(){
      gl_FragColor = vec4(uColor, uAlpha);
  }
  `;
  class LineMaterial extends ShaderMaterial {
    constructor(points, color = 0xff0000) {
      super({
        uniforms: {
          uPoints: {
            value: points,
          },
          uAlpha: {
            value: 1,
          },
          uColor: {
            value: new Color(color),
          },
        },
        vertexShader: `
          ${GLSL_BEZIER}
          uniform vec3 uPoints[4];
          void main(){
              vec3 normal;
              vec3 p = bezier(uPoints[0], uPoints[1], uPoints[2], uPoints[3], position.z, normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
          }
              `,
        fragmentShader,
      });
    }
    getColor() {
      return this.uniforms.uColor.value;
    }
  }
  
  class HandleMaterial extends ShaderMaterial {
    constructor(points, color = 0x00ff00) {
      super({
        uniforms: {
          uPoints: {
            value: points,
          },
          uAlpha: {
            value: 1,
          },
          uColor: {
            value: new Color(color),
          },
        },
        vertexShader: `
          uniform vec3 uPoints[4];
          void main(){
              vec3 p;
              if(position.z < 0.5){
                  p = uPoints[0];
              } else if( position.z < 1.5){
                  p = uPoints[1];       
              } else if ( position.z < 2.5){
                  p = uPoints[2];      
              } else if ( position.z < 3.5){
                  p = uPoints[3];
              }
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
          }
      `,
        fragmentShader,
      });
    }
  }
  
  class ExtrudeMaterial extends ShaderMaterial {
    constructor(points, color = 0x00ff00) {
      super({
        uniforms: {
          uPoints: {
            value: points,
          },
          uAlpha: {
            value: 1,
          },
          uColor: {
            value: new Color(color),
          },
        },
        vertexShader: `
          uniform vec3 uPoints[4];
          ${GLSL_BEZIER}
          void main(){
              vec3 normal;
              vec3 p = bezier(uPoints[0], uPoints[1], uPoints[2], uPoints[3], position.z, normal);
              p -= normal * position.x*2.;
              p.y = position.y;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
          }
            `,
        fragmentShader,
      });
    }
    getColor() {
      return this.uniforms.uColor.value;
    }
  }
  
  class VertexMaterial extends MeshBasicMaterial {
    constructor(color = 0x00ff00) {
      super({ color: new Color(color) });
      this._color = new Color(color);
      this._hlColor = new Color(0xffff00);
    }
    setHightlight(v) {
      if (v) {
        this.color = this._hlColor;
      } else {
        this.color = this._color;
      }
    }
  }
  
  const SEG_COUNT = 20;
  //vertex for handles
  const BOX_GEOMETRY = new BoxGeometry(0.5, 0.5, 0.5);
  const PLANE_GEOMETRY = new PlaneGeometry(1, 1, 1, SEG_COUNT);
  PLANE_GEOMETRY.translate(0, 0.5, 0.0);
  PLANE_GEOMETRY.rotateX(Math.PI / 2);
  
  //dynamic line geometry
  const LINE_POINTS = [];
  for (let i = 0; i <= SEG_COUNT; i++) {
    LINE_POINTS.push(new Vector3(0, 0, i / SEG_COUNT));
  }
  const LINE_GEOMETRY = new BufferGeometry().setFromPoints(LINE_POINTS);
  
  //extruded line geometry
  const EXTRUDE_GEOMETRY = new BoxGeometry(1, 1000, 1, 1, 1, SEG_COUNT);
  EXTRUDE_GEOMETRY.translate(0, 0.0, 0.5);
  
  const HANDLE_LINES_GEOMETRY = new BufferGeometry().setFromPoints([
    new Vector3(0, 0, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 0, 2),
    new Vector3(0, 0, 3),
  ]);
  
  export class Curve extends Object3D {
    points = [
      new Mesh(BOX_GEOMETRY, new VertexMaterial(0xff0000)),
      new Mesh(BOX_GEOMETRY, new VertexMaterial(0x00ff00)),
      new Mesh(BOX_GEOMETRY, new VertexMaterial(0x00ff00)),
      new Mesh(BOX_GEOMETRY, new VertexMaterial(0xff0000)),
    ];
  
    controls = new Object3D();
  
    constructor() {
      super();
  
      this.controls.add(...this.points);
  
      const pointsV3 = this.points.map((v) => v.position);
      const line = new Line(LINE_GEOMETRY, new LineMaterial(pointsV3));
      this.controls.add(line);
  
      const handleLines = new LineSegments(
        HANDLE_LINES_GEOMETRY,
        new HandleMaterial(pointsV3)
      );
      this.controls.add(handleLines);
  
      this.thickLine = new Mesh(
        PLANE_GEOMETRY,
        new ExtrudeMaterial(pointsV3, 0xff0000)
      );
      this.thickLine.material.side = DoubleSide;
      this.thickLine.material.transparent = true;
      this.thickLine.material.uniforms.uAlpha.value = 0.5;
      this.extrusion = new Mesh(EXTRUDE_GEOMETRY, new ExtrudeMaterial(pointsV3));
      this.extrusion.frustrumCulled = false;
    }
    getA() {
      return this.points[0].position;
    }
    getB() {
      return this.points[1].position;
    }
    getC() {
      return this.points[2].position;
    }
    getD() {
      return this.points[3].position;
    }
  }
  