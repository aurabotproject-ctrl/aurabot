// @ts-nocheck
/* ClassCard landing page — procedural Aurabot hero, scroll-beat controller.
   Three.js is pulled from a CDN at runtime so the app takes no new npm
   dependency. initLandingBot() returns a cleanup function; call it on unmount. */

const CDN = [
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

let pending = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    let i = 0;
    (function next() {
      if (i >= CDN.length) return reject(new Error('three.js failed to load'));
      const t = document.createElement('script');
      t.src = CDN[i++];
      t.onload = () => (window.THREE ? resolve() : next());
      t.onerror = next;
      document.head.appendChild(t);
    })();
  });
  return pending;
}

export function initLandingBot() {
  let disposed = false;
  let rafA = 0, rafB = 0, rendererRef = null;
  const offs = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };

  loadThree().then(() => { if (!disposed) start(); }).catch(() => {});

  function start(){
    var host = document.getElementById('bot');
    if(!host) return;

  var C = { orange:0xC7304F,   /* shell — the poster raspberry            */
            orangeD:0x99213C,  /* shell shadow tone                       */
            dark:0x241B33,     /* joints: deep plum, not black            */
            darkS:0x181125,
            cyan:0xF2E8D8,     /* optics — cream, matching the type       */
            magenta:0x9E2050, white:0xFFFFFF };

  var host = document.getElementById('bot');
  var renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  rendererRef = renderer;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, innerWidth/innerHeight, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xe8ecff, 0x161c3c, 0.40));
  var key = new THREE.DirectionalLight(0xfff4e6, 1.06); key.position.set(6, 11, 9); scene.add(key);
  var fill = new THREE.DirectionalLight(0x8fa6d8, 0.34); fill.position.set(-9, 3, 6); scene.add(fill);
  var rimA = new THREE.DirectionalLight(0xf4667f, 0.50); rimA.position.set(-5, 5, -8); scene.add(rimA);
  var rimB = new THREE.DirectionalLight(0xb8c8ee, 0.38); rimB.position.set(7, 2, -7); scene.add(rimB);

  /* ---------- toon materials ---------- */
  function col(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
  function ramp(steps){
    var d = new Uint8Array(steps);
    for(var i=0;i<steps;i++) d[i] = Math.round(48 + 207*Math.pow(i/(steps-1), 0.80));
    var t = new THREE.DataTexture(d, steps, 1, THREE.LuminanceFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }
  var RAMP = ramp(3);
  function toon(color){ return new THREE.MeshToonMaterial({color:col(color), gradientMap:RAMP}); }
  function flat(color){ return new THREE.MeshBasicMaterial({color:col(color)}); }

  var M = {
    shell:   toon(C.orange),
    shellD:  toon(C.orangeD),
    rubber:  toon(C.dark),
    rubberS: toon(C.darkS),
    screen:  flat(0x0A0E24),
    eye:     flat(C.cyan),
    heart:   toon(C.orange)
  };

  /* ---------- ink outline (inverted hull, normal-pushed) ---------- */
  var OUTLINE = new THREE.ShaderMaterial({
    uniforms:{ w:{value:0.042} },
    vertexShader:
      "uniform float w;\n" +
      "void main(){ vec3 p = position + normalize(normal) * w;\n" +
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }",
    fragmentShader:
      "void main(){ gl_FragColor = vec4(0.020,0.030,0.085,1.0); }",
    side: THREE.BackSide
  });

  /* ---------- rounded box geometry (no addons) ---------- */
  function roundedBox(w,h,dp,r,seg){
    seg = seg||10;
    r = Math.min(r, Math.min(w,h,dp)/2 - 0.0001);
    var g = new THREE.BoxBufferGeometry(w,h,dp,seg,seg,seg);
    var p = g.attributes.position;
    var hx=w/2-r, hy=h/2-r, hz=dp/2-r;
    var v = new THREE.Vector3(), q = new THREE.Vector3();
    for(var i=0;i<p.count;i++){
      v.set(p.getX(i),p.getY(i),p.getZ(i));
      q.set(
        Math.max(-hx,Math.min(hx,v.x)),
        Math.max(-hy,Math.min(hy,v.y)),
        Math.max(-hz,Math.min(hz,v.z))
      );
      var dv = v.clone().sub(q);
      if(dv.lengthSq()>1e-9){ dv.normalize().multiplyScalar(r); v.copy(q).add(dv); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  function addMesh(parent, geo, material, x,y,z, noOutline){
    var m = new THREE.Mesh(geo, material);
    m.position.set(x||0,y||0,z||0);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    if(!noOutline){
      var o = new THREE.Mesh(geo, OUTLINE);   // child: inherits any later rotation/scale
      o.castShadow = false; o.receiveShadow = false;
      m.add(o);
    }
    return m;
  }
  /* rounded-rect frame: outer rounded rect with a rounded-rect hole, extruded */
  function rrShape(w,h,r){
    var sh = new THREE.Shape(), x=-w/2, y=-h/2;
    sh.moveTo(x+r, y);
    sh.lineTo(x+w-r, y);      sh.quadraticCurveTo(x+w, y, x+w, y+r);
    sh.lineTo(x+w, y+h-r);    sh.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    sh.lineTo(x+r, y+h);      sh.quadraticCurveTo(x, y+h, x, y+h-r);
    sh.lineTo(x, y+r);        sh.quadraticCurveTo(x, y, x+r, y);
    return sh;
  }
  function bezelGeo(w,h,r,tw,depth){
    var outer = rrShape(w,h,r);
    outer.holes.push(new THREE.Path(rrShape(w-2*tw, h-2*tw, Math.max(0.02,r-tw)).getPoints(40)));
    var g = new THREE.ExtrudeBufferGeometry(outer, {depth:depth, bevelEnabled:true,
      bevelThickness:0.03, bevelSize:0.03, bevelSegments:2, curveSegments:16});
    g.computeVertexNormals();
    return g;
  }

  /* ---------- canvas texture: AUROBOT wordmark ---------- */
  function wordmark(text){
    var cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 256;
    var g = cv.getContext('2d');
    g.clearRect(0,0,cv.width,cv.height);
    g.fillStyle = '#1b1b1e';
    g.font = '900 168px Helvetica, Arial, sans-serif';
    g.textAlign='center'; g.textBaseline='middle';
    g.letterSpacing = '8px';
    g.fillText(text, cv.width/2, cv.height/2+6);
    var t = new THREE.CanvasTexture(cv);
    t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ---------- heart shape ---------- */
  function heartGeo(s, depth){
    var sh = new THREE.Shape();
    sh.moveTo(0,-0.75);
    sh.bezierCurveTo(0.75,-0.20, 1.05, 0.42, 0.55, 0.80);
    sh.bezierCurveTo(0.26, 1.02, 0.05, 0.86, 0, 0.62);
    sh.bezierCurveTo(-0.05, 0.86, -0.26, 1.02, -0.55, 0.80);
    sh.bezierCurveTo(-1.05, 0.42, -0.75,-0.20, 0,-0.75);
    var g = new THREE.ExtrudeBufferGeometry(sh, {
      depth: depth, bevelEnabled:true, bevelThickness:0.02, bevelSize:0.02, bevelSegments:3, curveSegments:36
    });
    g.scale(s,s,1);
    g.center();
    return g;
  }

  /* ================= MODEL ================= */
  var robot = new THREE.Group();
  var PARTS = [];                       // for explode
  function part(group, dir){ PARTS.push({o:group, base:group.position.clone(), dir:dir.clone()}); return group; }

  /* ---- TORSO ---- */
  var torso = new THREE.Group(); torso.position.set(0,0,0); robot.add(torso);
  addMesh(torso, roundedBox(2.55, 2.45, 1.55, 0.52, 14), M.shell, 0, 0, 0);

  // chest: black monitor sunk into the shell behind a bezel
  addMesh(torso, bezelGeo(1.86, 1.30, 0.20, 0.17, 0.17), M.shell, 0, 0.30, 0.755);
  addMesh(torso, roundedBox(1.62, 1.06, 0.09, 0.06, 5), M.screen, 0, 0.30, 0.785, true);
  var heart = addMesh(torso, heartGeo(0.44, 0.05), M.heart, 0, 0.30, 0.835);

  // wordmark
  var wm = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(1.42, 0.355),
    new THREE.MeshBasicMaterial({map:wordmark('AUROBOT'), transparent:true})
  );
  wm.position.set(0,-0.70,0.792); wm.renderOrder = 2;
  torso.add(wm);

  // backpack
  var pack = new THREE.Group(); pack.position.set(0, 0.16, -1.20); torso.add(pack);
  addMesh(pack, roundedBox(1.66, 1.48, 0.80, 0.28, 12), M.shellD, 0, 0, 0);
  addMesh(pack, roundedBox(1.02, 0.26, 0.14, 0.07, 5), M.rubber, 0, 0.34, -0.41);   // lid seam
  addMesh(pack, roundedBox(0.20, 0.22, 0.14, 0.05, 4), M.rubber, -0.34, -0.22, -0.41); // clasps
  addMesh(pack, roundedBox(0.20, 0.22, 0.14, 0.05, 4), M.rubber,  0.34, -0.22, -0.41);
  var hg = new THREE.CylinderBufferGeometry(0.075, 0.075, 0.58, 14); hg.rotateZ(Math.PI/2);
  addMesh(pack, hg, M.rubber, 0, 0.82, -0.10);                                       // grab handle
  // shoulder straps over the torso
  addMesh(torso, roundedBox(0.24, 1.34, 0.16, 0.07, 5), M.rubber, -0.62, 0.50, 0.735).rotation.z =  0.08;
  addMesh(torso, roundedBox(0.24, 1.34, 0.16, 0.07, 5), M.rubber,  0.62, 0.50, 0.735).rotation.z = -0.08;

  // neck
  addMesh(torso, new THREE.CylinderBufferGeometry(0.30,0.32,0.30,28), M.rubber, 0, 1.28, 0);
  addMesh(torso, new THREE.CylinderBufferGeometry(0.36,0.36,0.10,28), M.shell, 0, 1.44, 0);

  /* ---- HEAD ---- */
  var head = new THREE.Group(); head.position.set(0, 2.50, 0); robot.add(head);
  part(head, new THREE.Vector3(0,1,0));
  addMesh(head, roundedBox(3.25, 2.30, 1.48, 0.46, 16), M.shell, 0, 0, 0);
  // visor: screen sunk behind a bezel
  addMesh(head, bezelGeo(2.86, 1.80, 0.34, 0.19, 0.19), M.shell, 0, 0.05, 0.715);
  addMesh(head, roundedBox(2.54, 1.48, 0.09, 0.10, 5), M.screen, 0, 0.05, 0.745, true);
  // eyes
  var eyeG = new THREE.CylinderBufferGeometry(0.42, 0.42, 0.06, 44);
  eyeG.rotateX(Math.PI/2);
  var eyeL = addMesh(head, eyeG, M.eye, -0.60, 0.05, 0.800);
  var eyeR = addMesh(head, eyeG, M.eye,  0.60, 0.05, 0.800);
  // ears
  function ear(sign){
    var g = new THREE.Group(); g.position.set(sign*1.66, 0.02, 0.05); head.add(g);
    var c = new THREE.CylinderBufferGeometry(0.40,0.40,0.30,32);
    c.rotateZ(Math.PI/2);
    addMesh(g, c, M.shell, 0,0,0);
    addMesh(g, new THREE.TorusBufferGeometry(0.22,0.06,12,28), M.shellD, sign*0.16, 0, 0).rotation.y = Math.PI/2;
    return g;
  }
  ear(-1); ear(1);
  // antenna
  var ant = new THREE.Group(); ant.position.set(0, 1.02, 0.0); head.add(ant);
  addMesh(ant, new THREE.CylinderBufferGeometry(0.055,0.075,1.05,18), M.rubber, 0, 0.52, 0);
  addMesh(ant, new THREE.SphereBufferGeometry(0.17, 28, 20), M.rubber, 0, 1.10, 0);

  /* ---- ribbed sleeve helpers ---- */
  function sleeveX(parent, sign, from, to, r0, r1){
    var len = Math.abs(to-from), n = Math.max(2, Math.round(len/0.30)), step = len/n;
    for(var i=0;i<n;i++){
      var t = n>1 ? i/(n-1) : 0, r = r0 + (r1-r0)*t;
      var c = sign*(from + step*(i+0.5));
      var link = new THREE.CylinderBufferGeometry(r*0.84, r*0.84, step*1.04, 22); link.rotateZ(Math.PI/2);
      addMesh(parent, link, M.rubber, c, 0, 0);
      var rib = new THREE.CylinderBufferGeometry(r, r, 0.17, 22); rib.rotateZ(Math.PI/2);
      addMesh(parent, rib, M.rubberS, c, 0, 0);
    }
  }
  function sleeveY(parent, from, to, r0, r1){
    var len = Math.abs(to-from), n = Math.max(2, Math.round(len/0.32)), step = len/n;
    for(var i=0;i<n;i++){
      var t = n>1 ? i/(n-1) : 0, r = r0 + (r1-r0)*t;
      var c = from - step*(i+0.5);
      addMesh(parent, new THREE.CylinderBufferGeometry(r*0.84, r*0.84, step*1.04, 22), M.rubber, 0, c, 0);
      addMesh(parent, new THREE.CylinderBufferGeometry(r, r, 0.18, 22), M.rubberS, 0, c, 0);
    }
  }

  /* ---- ARM: shoulder -> elbow -> wrist ---- */
  function buildArm(sign){
    var shoulder = new THREE.Group();
    shoulder.position.set(sign*1.22, 0.55, 0);
    torso.add(shoulder);
    part(shoulder, new THREE.Vector3(sign,0.15,0));

    addMesh(shoulder, new THREE.SphereBufferGeometry(0.34, 26, 20), M.shell, sign*0.10, 0, 0);
    sleeveX(shoulder, sign, 0.36, 1.06, 0.255, 0.238);

    // elbow
    var elbow = new THREE.Group();
    elbow.position.set(sign*1.10, 0, 0);
    shoulder.add(elbow);
    addMesh(elbow, new THREE.SphereBufferGeometry(0.245, 26, 20), M.rubber, 0, 0, 0);
    sleeveX(elbow, sign, 0.14, 0.86, 0.232, 0.212);

    // wrist
    var wrist = new THREE.Group();
    wrist.position.set(sign*0.94, 0, 0);
    elbow.add(wrist);
    addMesh(wrist, new THREE.SphereBufferGeometry(0.195, 22, 16), M.rubber, 0, 0, 0);

    var hand = new THREE.Group();
    wrist.add(hand);
    addMesh(hand, roundedBox(0.72, 0.52, 0.44, 0.19, 12), M.shell, sign*0.28, -0.02, 0);
    var fingers = [];
    function finger(len, rad, y, z, ang){
      var f = new THREE.Group();
      f.position.set(sign*0.56, y, z);
      var c = new THREE.CylinderBufferGeometry(rad*0.85, rad, len, 20);
      c.rotateZ(-sign*Math.PI/2);
      addMesh(f, c, M.shell, sign*len/2, 0, 0);
      addMesh(f, new THREE.SphereBufferGeometry(rad*0.9,16,12), M.shell, sign*len, 0, 0);
      f.rotation.z = sign*ang; f.userData.rest = sign*ang;
      hand.add(f); fingers.push(f);
      return f;
    }
    finger(0.40, 0.115, 0.07,  0.11, -0.04);
    finger(0.36, 0.110, 0.01, -0.05, -0.01);
    finger(0.28, 0.100,-0.14, -0.15,  0.28);   // thumb

    return {root:shoulder, shoulder:shoulder, elbow:elbow, wrist:wrist, hand:hand, fingers:fingers, sign:sign};
  }
  var armL = buildArm(-1), armR = buildArm(1);

  /* ---- LEG: hip -> knee -> ankle ---- */
  function buildLeg(sign){
    var hip = new THREE.Group();
    hip.position.set(sign*0.62, -1.20, 0);
    torso.add(hip);
    part(hip, new THREE.Vector3(sign*0.35,-1,0));

    addMesh(hip, new THREE.SphereBufferGeometry(0.30, 24, 18), M.rubber, 0, 0.04, 0);
    sleeveY(hip, -0.13, -0.50, 0.285, 0.276);

    var knee = new THREE.Group();
    knee.position.set(0, -0.56, 0);
    hip.add(knee);
    addMesh(knee, new THREE.SphereBufferGeometry(0.275, 26, 20), M.rubber, 0, 0, 0);
    sleeveY(knee, -0.12, -0.50, 0.272, 0.258);

    var ankle = new THREE.Group();
    ankle.position.set(0, -0.58, 0);
    knee.add(ankle);

    var boot = new THREE.Group(); ankle.add(boot);
    addMesh(boot, new THREE.CylinderBufferGeometry(0.30, 0.46, 0.74, 36), M.shell, 0, -0.31, 0);
    addMesh(boot, new THREE.SphereBufferGeometry(0.135, 20, 14), M.shell, 0, -0.16, 0.24);
    addMesh(boot, roundedBox(1.12, 0.56, 1.80, 0.26, 12), M.shell, 0, -0.78, 0.26);
    addMesh(boot, new THREE.SphereBufferGeometry(0.54, 28, 20), M.shell, 0, -0.76, 0.80).scale.set(1,0.60,0.92);

    return {root:hip, hip:hip, knee:knee, ankle:ankle, sign:sign};
  }
  var legL = buildLeg(-1), legR = buildLeg(1);

  part(torso, new THREE.Vector3(0,0.2,0));



  robot.position.y = 0.45;
  var rig = new THREE.Group(); rig.add(robot); scene.add(rig);

  /* ---------- a real ClassCard, prismatic (Rainbow) tier ----------
     Layout, palette and rarity styling mirror src/components/PokeCard.tsx
     and styles.css (.poke-card.prismatic). Swap CARD.art for the real
     artwork: drop an image beside this file and name it card-art.png.     */
  // the four tiers, straight out of the card file / styles.css
  var RARITIES = [
    {tag:'BRONZE', angle:160, body:0x8B5A2B, sheen:0.00,
     stops:[[0,'#d2a679'],[.4,'#a9744a'],[.7,'#c9986a'],[1,'#8b5a2b']],
     trim:'#8b5a2b', name:'#2a1808', hp:'#5a2a0a', sl:'#3a2410', sv:'#241206'},
    {tag:'SILVER', angle:160, body:0x7A9AB0, sheen:0.05,
     stops:[[0,'#d8e4ee'],[.4,'#a8bfcf'],[.7,'#e0eaf2'],[1,'#c0d4e4']],
     trim:'#7a9ab0', name:'#16232c', hp:'#2f4d5c', sl:'#26404c', sv:'#16232c'},
    {tag:'GOLD', angle:160, body:0xC07800, sheen:0.07,
     stops:[[0,'#ffe090'],[.3,'#f0b020'],[.6,'#ffd060'],[.8,'#e89010'],[1,'#ffdc80']],
     trim:'#c07800', name:'#1a1000', hp:'#8b0000', sl:'#5a3a00', sv:'#1a0800'},
    {tag:'PRISMATIC', angle:135, body:0xC080FF, sheen:0.13,
     stops:[[0,'#ffb3b3'],[.14,'#ffd9a0'],[.28,'#ffffa0'],[.42,'#b3ffb3'],
            [.57,'#a0e8ff'],[.71,'#b3b3ff'],[.85,'#e8b3ff'],[1,'#ffb3e8']],
     trim:'#c080ff', name:'#2a1030', hp:'#7a1050', sl:'#40204a', sv:'#240a2a'}
  ];
  var rarIdx = 3;

  var CARD = {
    name:'Rabbit', hp:120, type:'ANIMALS',
    desc:'Those narrowed eyes have seen every trick, every fake-out, and every suspicious rustle in the bushes. Cool under pressure, quick when it counts.',
    stats:[['HP',120],['Paw Patter',73],['Small Chomp',80]],
    moves:[['Paw Patter',73],['Small Chomp',80]],
    owner:'AURABOT PROJECT',
    art:'/aurabot-card-rabbit.png'
  };

  var card = new THREE.Group();
  var cardSheen = null, cardTex = null;
  (function(){
    var W = 520, H = 750, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var art = null;

    function rr(x,y,w,h,r){
      g.beginPath();
      g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
      g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
      g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
    }
    function rabbit(x,y,w,h){
      // stand-in artwork, drawn in code; replaced by card-art.png when present
      var cx = x+w/2, base = y+h;
      g.save();
      g.fillStyle = 'rgba(255,255,255,.55)'; rr(x,y,w,h,12); g.fill();
      g.translate(cx, base);
      var s = h/150;
      g.scale(s,s);
      g.fillStyle = '#f7f2e8'; g.strokeStyle = '#3a2f4a'; g.lineWidth = 3.4;
      // ears
      [[-19,-1],[13,1]].forEach(function(e){
        g.save(); g.translate(e[0],-88); g.rotate(e[1]*0.22);
        g.beginPath(); g.ellipse(0,-30,10,34,0,0,6.284); g.fill(); g.stroke();
        g.fillStyle = '#f0a5b8';
        g.beginPath(); g.ellipse(0,-30,4.6,24,0,0,6.284); g.fill();
        g.fillStyle = '#f7f2e8'; g.restore();
      });
      // body + head
      g.beginPath(); g.ellipse(0,-30,34,32,0,0,6.284); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(-2,-80,27,24,0,0,6.284); g.fill(); g.stroke();
      // face
      g.fillStyle = '#3a2f4a';
      g.beginPath(); g.ellipse(-12,-84,3.6,4.6,0,0,6.284); g.fill();
      g.beginPath(); g.ellipse(8,-84,3.6,4.6,0,0,6.284); g.fill();
      g.fillStyle = '#e0768f';
      g.beginPath(); g.moveTo(-2,-74); g.lineTo(3,-74); g.lineTo(0.5,-70); g.closePath(); g.fill();
      g.strokeStyle = '#3a2f4a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0.5,-70); g.quadraticCurveTo(-4,-66,-8,-69); g.stroke();
      g.beginPath(); g.moveTo(0.5,-70); g.quadraticCurveTo(5,-66,9,-69); g.stroke();
      g.fillStyle = 'rgba(240,165,184,.55)';
      g.beginPath(); g.ellipse(-19,-76,5,3.4,0,0,6.284); g.fill();
      g.beginPath(); g.ellipse(15,-76,5,3.4,0,0,6.284); g.fill();
      // feet + tail
      g.fillStyle = '#f7f2e8'; g.strokeStyle = '#3a2f4a'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(-18,-6,13,7,0,0,6.284); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(16,-6,13,7,0,0,6.284); g.fill(); g.stroke();
      g.beginPath(); g.arc(32,-34,9,0,6.284); g.fill(); g.stroke();
      g.restore();
    }

    function draw(){
      g.clearRect(0,0,W,H);
      var R = RARITIES[rarIdx];
      // the tier's own gradient + trim
      var rad = R.angle * Math.PI/180;
      var gx = Math.cos(rad), gy = Math.sin(rad);
      var grad = g.createLinearGradient(W/2 - gx*W/2, H/2 - gy*H/2, W/2 + gx*W/2, H/2 + gy*H/2);
      R.stops.forEach(function(s2){ grad.addColorStop(s2[0], s2[1]); });
      rr(0,0,W,H,26); g.fillStyle = grad; g.fill();
      g.lineWidth = 12; g.strokeStyle = R.trim; rr(6,6,W-12,H-12,22); g.stroke();

      // sparkles (fixed positions so the card doesn't fizz)
      var stars = [[46,120,13],[470,96,11],[64,470,10],[452,520,12],[250,60,9],
                   [90,660,11],[430,676,10],[300,300,9],[160,208,8],[380,240,9]];
      g.font = '700 18px Nunito, sans-serif'; g.textAlign = 'center';
      stars.forEach(function(p2,i){
        g.globalAlpha = .55; g.fillStyle = ['#ffffff','#ffe6ff','#e0f6ff'][i%3];
        g.font = '700 ' + (p2[2]+6) + 'px Nunito, sans-serif';
        g.fillText('\u2726', p2[0], p2[1]); g.globalAlpha = 1;
      });

      // header: name + HP
      g.textAlign = 'left'; g.fillStyle = R.name;
      g.font = '800 30px Archivo, Helvetica, sans-serif';
      g.fillText(CARD.name.toUpperCase(), 32, 52);
      g.textAlign = 'right';
      var hp = CARD.hp + ' HP';
      g.font = '800 21px Nunito, sans-serif';
      var wid = g.measureText(hp).width + 26;
      g.fillStyle = 'rgba(255,255,255,.66)'; rr(W-32-wid, 26, wid, 32, 16); g.fill();
      g.fillStyle = R.hp; g.fillText(hp, W-45, 49);

      // art box
      var ax = 26, ay = 74, aw = W-52, ah = 250;
      g.fillStyle = 'rgba(255,255,255,.35)'; rr(ax,ay,aw,ah,16); g.fill();
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.65)'; rr(ax,ay,aw,ah,16); g.stroke();
      if(art){
        g.save(); rr(ax,ay,aw,ah,16); g.clip();
        var sc = Math.min(aw/art.width, ah/art.height);
        var dw = art.width*sc, dh = art.height*sc;
        g.drawImage(art, ax+(aw-dw)/2, ay+(ah-dh)/2, dw, dh);
        g.restore();
      } else {
        rabbit(ax+6, ay+6, aw-12, ah-12);
      }
      // type badge
      g.font = '800 15px Nunito, sans-serif'; g.textAlign = 'right';
      var tw = g.measureText(CARD.type).width + 18;
      g.fillStyle = 'rgba(0,0,0,.38)'; rr(ax+aw-12-tw, ay+ah-34, tw, 24, 8); g.fill();
      g.fillStyle = '#fff'; g.fillText(CARD.type, ax+aw-21, ay+ah-16);

      // description
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.45)'; rr(26, 332, W-52, 82, 10); g.fill();
      g.fillStyle = R.sv; g.font = 'italic 500 17px Nunito, sans-serif';
      var words = CARD.desc.split(' '), line = '', ly = 354;
      words.forEach(function(word){
        if(g.measureText(line+word).width > W-96){ g.fillText(line, 40, ly); line = word+' '; ly += 22; }
        else line += word+' ';
      });
      g.fillText(line, 40, ly);

      // stats
      var sx = 26, sw = (W-52-16)/3;
      CARD.stats.forEach(function(st, i){
        var x = sx + i*(sw+8);
        g.fillStyle = 'rgba(255,255,255,.48)'; rr(x, 428, sw, 62, 9); g.fill();
        g.textAlign = 'center';
        g.fillStyle = R.sl; g.font = '800 13px Nunito, sans-serif';
        g.fillText(st[0], x+sw/2, 450);
        g.fillStyle = R.sv; g.font = '900 28px Archivo, Helvetica, sans-serif';
        g.fillText(String(st[1]), x+sw/2, 480);
      });

      // moves
      CARD.moves.forEach(function(mv, i){
        var y = 506 + i*52;
        g.fillStyle = 'rgba(255,255,255,.45)'; rr(26, y, W-52, 44, 11); g.fill();
        g.textAlign = 'left'; g.fillStyle = R.sv;
        g.font = '700 19px Nunito, sans-serif'; g.fillText(mv[0], 42, y+29);
        g.textAlign = 'right'; g.fillStyle = R.hp;
        g.font = '900 26px Archivo, Helvetica, sans-serif'; g.fillText(String(mv[1]), W-42, y+31);
      });

      // footer
      g.textAlign = 'left'; g.fillStyle = R.sl;
      g.font = '800 15px Nunito, sans-serif';
      g.fillText(R.tag, 32, H-30);
      g.textAlign = 'right'; g.fillStyle = R.sl;
      g.font = 'italic 500 15px Nunito, sans-serif';
      g.fillText(CARD.owner, W-32, H-30);

      if(cardTex) cardTex.needsUpdate = true;
    }
    draw();

    cardTex = new THREE.CanvasTexture(cv);
    if (THREE.sRGBEncoding) cardTex.encoding = THREE.sRGBEncoding;
    cardTex.anisotropy = 8;

    // real artwork if it's sitting beside this file
    if(CARD.art){
      var im = new Image();
      im.onload = function(){ art = im; draw(); };
      im.onerror = function(){};
      im.src = CARD.art;
    }
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

    // 260x375 in the app -> same aspect here
    var CW = 2.15, CH = CW * (375/260);
    var body = new THREE.Mesh(roundedBox(CW, CH, 0.05, 0.09, 8),
      new THREE.MeshToonMaterial({color:col(0xC080FF), gradientMap:RAMP}));
    card.add(body);
    body.add(new THREE.Mesh(roundedBox(CW, CH, 0.05, 0.09, 8), OUTLINE));

    var face = new THREE.Mesh(new THREE.PlaneBufferGeometry(CW*0.94, CH*0.955),
      new THREE.MeshBasicMaterial({map:cardTex}));
    face.position.z = 0.031; card.add(face);

    // holo sheen that drifts across the face (the prismShift animation, in 3D)
    var sc = document.createElement('canvas'); sc.width = 256; sc.height = 8;
    var sg = sc.getContext('2d');
    var sgr = sg.createLinearGradient(0,0,256,0);
    ['#ff0055','#ff9900','#ffee00','#33ff88','#00ccff','#7755ff','#ff44cc','#ff0055']
      .forEach(function(c2,i,arr){ sgr.addColorStop(i/(arr.length-1), c2); });
    sg.fillStyle = sgr; sg.fillRect(0,0,256,8);
    var sTex = new THREE.CanvasTexture(sc);
    sTex.wrapS = sTex.wrapT = THREE.RepeatWrapping; sTex.repeat.set(2,1);
    cardSheen = new THREE.Mesh(new THREE.PlaneBufferGeometry(CW*0.94, CH*0.955),
      new THREE.MeshBasicMaterial({map:sTex, transparent:true, opacity:0.13,
                                   blending:THREE.AdditiveBlending, depthWrite:false}));
    cardSheen.position.z = 0.036; card.add(cardSheen);

    var back = new THREE.Mesh(new THREE.PlaneBufferGeometry(CW*0.94, CH*0.955),
      new THREE.MeshToonMaterial({color:col(0x151D44), gradientMap:RAMP}));
    back.position.z = -0.031; back.rotation.y = Math.PI; card.add(back);

    card.scale.setScalar(0.001); card.visible = false;
    scene.add(card);                       // world space: blends from his hand to the showcase

    window.__setRarity = function(i){
      rarIdx = i; draw();
      body.material.color.copy(col(RARITIES[i].body));
      cardSheen.material.opacity = RARITIES[i].sheen;
    };
    [].forEach.call(document.querySelectorAll('.rb'), function(b2){
      b2.addEventListener('click', function(){
        [].forEach.call(document.querySelectorAll('.rb'), function(o){
          o.classList.remove('is-on'); o.removeAttribute('aria-pressed');
        });
        b2.classList.add('is-on'); b2.setAttribute('aria-pressed','true');
        window.__setRarity(+b2.dataset.r);
      });
    });
  })();

  /* ================= poses ================= */
  function armPose(name, s, t){
    // returns shoulder/elbow/wrist targets for one arm (s = +1 right, -1 left)
    switch(name){
      case 'wave':   return {lift:s*0.52, fwd:-s*0.16, roll:-0.30, ey:-s*0.12,
                             ez:s*(1.00 + Math.sin(t*6.4)*0.32), wr:-s*(0.10 + Math.sin(t*6.4-0.6)*0.24)};
      case 'point':  return {lift:s*0.10, fwd:-0.72, roll:0, ey:-s*0.10, ez:s*0.05, wr:-s*0.05};
      case 'present':return {lift:-s*0.42, fwd:-0.95, roll:0, ey:-s*1.15, ez:s*0.16, wr:-s*0.12};
      case 'guard':  return {lift:-s*0.86, fwd:-0.55 + Math.sin(t*4.6)*0.30*(s>0?1:-1),
                             roll:0, ey:-s*1.45, ez:s*0.18, wr:-s*0.20};
      case 'down':   return {lift:-s*(1.10 + Math.sin(t*1.3)*0.025), fwd:-0.06 + Math.sin(t*1.1)*0.03,
                             roll:0, ey:-s*(0.40 + Math.sin(t*1.3-0.8)*0.05), ez:s*0.04, wr:-s*0.08};
      case 'open':   return {lift:-s*0.62, fwd:-0.34, roll:0, ey:-s*0.55, ez:s*0.10, wr:-s*0.14};
      default:       return {lift:s*(0.06 + Math.sin(t*1.35)*0.03), fwd:0, roll:0,
                             ey:-s*(0.16 + Math.sin(t*1.35-0.9)*0.07), ez:0, wr:-s*0.06};
    }
  }
  function lerpPose(a, b, w){
    var o = {}; for(var k in a) o[k] = a[k] + (b[k]-a[k])*w; return o;
  }

  // one entry per section, in document order
  var BEATS = [
    {id:'hero',     x: 3.15, y:-0.30, yaw:-0.34, dist:18.6, camY:0.95, R:'wave',    L:'down',    legs:'idle',  card:0, ex:0, show:0},
    {id:'collect',  x:-13.5, y:-0.25, yaw: 0.46, dist:16.8, camY:0.90, R:'present', L:'open',    legs:'idle',  card:1, ex:0, show:1},
    {id:'shop',     x: 3.55, y:-0.25, yaw:-0.46, dist:17.8, camY:0.90, R:'open',    L:'present', legs:'idle',  card:0, ex:0, show:0},
    {id:'arena',    x:-3.00, y:-0.25, yaw: 0.30, dist:17.0, camY:0.85, R:'guard',   L:'guard',   legs:'brace', card:0, ex:0, show:0},
    {id:'build',    x: 2.95, y:-0.40, yaw:-0.34, dist:23.0, camY:1.10, R:'down',    L:'down',    legs:'idle',  card:0, ex:0.85, show:0},
    {id:'projects', x:-3.05, y:-0.25, yaw: 0.36, dist:17.6, camY:0.90, R:'point',   L:'down',    legs:'march', card:0, ex:0, show:0},
    {id:'teachers', x: 0.00, y:-0.85, yaw: 0.00, dist:22.4, camY:0.75, R:'wave',    L:'down',    legs:'idle',  card:0, ex:0, show:0, eye:1}
  ];
  var sections = BEATS.map(function(b){ return document.getElementById(b.id); });

  function stage(){
    var y = scrollY + innerHeight*0.5, n = sections.length;
    var c = sections.map(function(el){ return el.offsetTop + el.offsetHeight*0.5; });
    if(y <= c[0]) return 0;
    if(y >= c[n-1]) return n-1;
    for(var i=0;i<n-1;i++){
      if(y < c[i+1]) return i + (y - c[i]) / Math.max(1, c[i+1]-c[i]);
    }
    return n-1;
  }
  function smooth(x){ return x*x*(3-2*x); }

  /* ================= springs / smoothing ================= */
  function Spring(k,d,x0){ this.k=k; this.d=d; this.x=x0||0; this.v=0; }
  Spring.prototype.step = function(target, dt){
    var n = dt > 0.02 ? 2 : 1, h = dt/n;
    for(var i=0;i<n;i++){ this.v += ((target-this.x)*this.k - this.v*this.d)*h; this.x += this.v*h; }
    return this.x;
  };
  function ease(cur, tgt, rate, dt){ return cur + (tgt-cur)*(1-Math.exp(-rate*dt)); }
  function clamp(v,lo,hi){ return v<lo?lo:(v>hi?hi:v); }

  var S = {
    Rz:new Spring(210,26), Rx:new Spring(210,26), Rey:new Spring(230,27), Rez:new Spring(230,27), Rw:new Spring(240,26),
    Lz:new Spring(210,26), Lx:new Spring(210,26), Ley:new Spring(230,27), Lez:new Spring(230,27), Lw:new Spring(240,26),
    antZ:new Spring(70,6), antX:new Spring(70,6), headY:new Spring(90,12)
  };

  /* ================= pointer look ================= */
  var mx = 0, my = 0;
  on(window, 'pointermove', function(e){
    mx = (e.clientX/innerWidth - 0.5) * 2;
    my = (e.clientY/innerHeight - 0.5) * 2;
  }, {passive:true});

  /* ================= animation ================= */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clock = new THREE.Clock();
  var exAmt = 0, gaitPhase = 0, cur = {x:0, y:-0.2, yaw:0, dist:17.5, camY:0.45};
  var HAND = new THREE.Vector3(), SHOW = new THREE.Vector3(), CAMPOS = new THREE.Vector3();
  var EYE_A = col(0xF2E8D8), EYE_B = col(0x2F7FC1);   // cream / hieroglyph blue
  var cue = document.getElementById('cue');

  function frame(){
    if(disposed) return;
    rafA = requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    var amp = reduce ? 0.3 : 1;

    var st = stage(), i0 = Math.floor(st), i1 = Math.min(BEATS.length-1, i0+1), w = smooth(st - i0);
    var A = BEATS[i0], B = BEATS[i1];

    // body placement + camera
    cur.x    = ease(cur.x,    A.x    + (B.x-A.x)*w,    3.4, dt);
    cur.y    = ease(cur.y,    A.y    + (B.y-A.y)*w,    3.4, dt);
    cur.yaw  = ease(cur.yaw,  A.yaw  + (B.yaw-A.yaw)*w,3.0, dt);
    cur.dist = ease(cur.dist, A.dist + (B.dist-A.dist)*w, 2.6, dt);
    cur.camY = ease(cur.camY, A.camY + (B.camY-A.camY)*w, 2.6, dt);

    var breathe = Math.sin(t*1.3);
    rig.position.set(cur.x, cur.y + breathe*0.05*amp, 0);
    rig.rotation.y = cur.yaw + mx*0.16;
    camera.position.set(0, cur.camY, cur.dist);
    camera.lookAt(0, cur.camY - 0.15, 0);

    // head: look toward the pointer, lagged
    head.rotation.y = S.headY.step(mx*0.34 - rig.rotation.y*0.35, dt);
    head.rotation.x = ease(head.rotation.x, my*0.16 + 0.02, 4, dt);
    head.rotation.z = ease(head.rotation.z, -mx*0.05, 3, dt);
    ant.rotation.z  = S.antZ.step(-head.rotation.y*0.55 - mx*0.10, dt)*amp;
    ant.rotation.x  = S.antX.step(breathe*0.09 + head.rotation.x*0.8, dt)*amp;
    torso.rotation.y = ease(torso.rotation.y, mx*0.10, 3, dt);
    torso.rotation.x = ease(torso.rotation.x, -breathe*0.013*amp, 4, dt);

    var blink = (t % 4.9) > 4.74 ? 0.08 : 1;
    eyeL.scale.y = eyeR.scale.y = blink;

    // arms: blend the two neighbouring beats' poses, then spring toward them
    function drive(A2, K, s){
      var p = lerpPose(armPose(A2.a, s, t), armPose(A2.b, s, t), w);
      A2.arm.shoulder.rotation.z = K.z.step(p.lift, dt);
      A2.arm.shoulder.rotation.x = K.x.step(p.fwd, dt);
      A2.arm.shoulder.rotation.y = ease(A2.arm.shoulder.rotation.y, p.roll, 5, dt);
      A2.arm.elbow.rotation.y    = K.ey.step(p.ey, dt);
      A2.arm.elbow.rotation.z    = K.ez.step(p.ez, dt);
      A2.arm.wrist.rotation.y    = K.w.step(p.wr, dt);
      for(var i=0;i<A2.arm.fingers.length;i++){
        var f = A2.arm.fingers[i];
        f.rotation.z = ease(f.rotation.z, f.userData.rest + Math.sin(t*1.6+i)*0.05*amp, 3, dt);
      }
    }
    drive({arm:armR, a:A.R, b:B.R}, {z:S.Rz, x:S.Rx, ey:S.Rey, ez:S.Rez, w:S.Rw},  1);
    drive({arm:armL, a:A.L, b:B.L}, {z:S.Lz, x:S.Lx, ey:S.Ley, ez:S.Lez, w:S.Lw}, -1);

    // legs
    var marching = (A.legs==='march' && w<0.5) || (B.legs==='march' && w>=0.5);
    var bracing  = (A.legs==='brace' && w<0.5) || (B.legs==='brace' && w>=0.5);
    gaitPhase += dt * (marching ? 3.0 : 0);
    function leg(L, off){
      var s = L.sign, hipT, kneeT, rate;
      if(marching){
        var ph = gaitPhase + off, sw = Math.sin(ph);
        hipT = sw*0.44; kneeT = Math.max(0,-Math.sin(ph-0.7))*0.85 + 0.12; rate = 12;
      } else if(bracing){
        hipT = 0.10 + s*0.05; kneeT = 0.30 + Math.sin(t*4.6)*0.05; rate = 5;
      } else {
        hipT = (0.05 + breathe*0.02)*amp; kneeT = (0.10 + breathe*0.03)*amp; rate = 3.2;
      }
      L.hip.rotation.x   = ease(L.hip.rotation.x, hipT, rate, dt);
      L.knee.rotation.x  = ease(L.knee.rotation.x, kneeT, rate*0.92, dt);
      L.ankle.rotation.x = ease(L.ankle.rotation.x, clamp(-(hipT+kneeT), -0.45, 0.35), rate*0.8, dt);
      L.hip.rotation.z   = ease(L.hip.rotation.z, s*(bracing ? 0.16 : 0.02), 3, dt);
    }
    leg(legL, 0); leg(legR, Math.PI);

    // the card: rides in his hand, then takes the stage as he walks off
    var cardW = A.card + (B.card - A.card)*w;
    var showW = (A.show||0) + ((B.show||0) - (A.show||0))*w;
    card.visible = cardW > 0.01;
    if(card.visible){
      armR.hand.updateWorldMatrix(true, false);
      HAND.set(1.55, 0.42, 0.42).applyMatrix4(armR.hand.matrixWorld);
      SHOW.set(-3.30, 0.30, 3.10);
      card.position.lerpVectors(HAND, SHOW, showW);
      var cs = ease(card.scale.x, cardW * (1 + showW*0.55), 6, dt);
      card.scale.setScalar(Math.max(0.001, cs));
      if(cardSheen) cardSheen.material.map.offset.x = (t*0.09) % 1;
      card.lookAt(camera.getWorldPosition(CAMPOS));
      card.rotateY(Math.sin(t*0.85)*(0.30 - showW*0.14));
      card.rotateZ(0.10 + Math.sin(t*1.25)*0.06 - showW*0.10);
    }

    // eye colour: cream everywhere, lapis blue where cream would fight the copy
    var ew = (A.eye||0) + ((B.eye||0) - (A.eye||0))*w;
    M.eye.color.copy(EYE_A).lerp(EYE_B, ew);

    // explode for the build-a-bot beat
    exAmt = ease(exAmt, A.ex + (B.ex - A.ex)*w, 3.5, dt);
    for(var j=0;j<PARTS.length;j++){
      var pr = PARTS[j];
      pr.o.position.copy(pr.base).addScaledVector(pr.dir, exAmt*1.15);
    }
    robot.rotation.y = ease(robot.rotation.y, exAmt*t*0.35 % 6.283, 2, dt);

    if(cue) cue.style.opacity = scrollY > 80 ? 0 : 0.9;
    renderer.render(scene, camera);
  }
  frame();

  on(window, 'resize', function(){
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* ================= one gesture = one beat ================= */
  var snapOn = innerWidth > 820 && !reduce;
  var idx = 0, animating = false, lastNav = 0;

  function tops(){ return sections.map(function(el){ return el.offsetTop; }); }
  function nearest(){
    var T = tops(), y = scrollY, best = 0, bd = Infinity;
    for(var i=0;i<T.length;i++){ var d = Math.abs(T[i]-y); if(d<bd){ bd=d; best=i; } }
    return best;
  }
  function goTo(i){
    i = Math.max(0, Math.min(sections.length-1, i));
    var startY = scrollY, endY = tops()[i];
    if(Math.abs(endY-startY) < 2){ idx = i; dots(); return; }
    idx = i; dots(); animating = true;
    var t0 = performance.now();
    var dur = Math.min(1150, 480 + Math.abs(endY-startY)*0.32);
    (function step(now){
      var p = Math.min(1, (now-t0)/dur);
      var e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;   // easeInOutCubic
      scrollTo(0, startY + (endY-startY)*e);
      if(p < 1) requestAnimationFrame(step); else animating = false;
    })(t0);
  }
  function nav(dir){
    var now = performance.now();
    if(animating || now - lastNav < 260) return;
    lastNav = now; goTo(idx + dir);
  }

  var dotWrap = document.getElementById('dots'), dotEls = [];
  BEATS.forEach(function(b, i){
    var d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Go to ' + b.id);
    d.onclick = function(){ goTo(i); };
    dotWrap.appendChild(d); dotEls.push(d);
  });
  function dots(){
    dotEls.forEach(function(d, i){ d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
  }
  dots();

  if(snapOn){
    on(window, 'wheel', function(e){
      if(!snapOn) return;
      e.preventDefault();
      if(Math.abs(e.deltaY) < 6) return;
      nav(e.deltaY > 0 ? 1 : -1);
    }, {passive:false});

    var ty = 0;
    on(window, 'touchstart', function(e){ ty = e.touches[0].clientY; }, {passive:true});
    on(window, 'touchend', function(e){
      var dy = ty - e.changedTouches[0].clientY;
      if(Math.abs(dy) > 55) nav(dy > 0 ? 1 : -1);
    }, {passive:true});
  }

  on(window, 'keydown', function(e){
    var k = e.key;
    if(k === 'ArrowDown' || k === 'PageDown' || k === ' '){ e.preventDefault(); nav(1); }
    else if(k === 'ArrowUp' || k === 'PageUp'){ e.preventDefault(); nav(-1); }
    else if(k === 'Home'){ e.preventDefault(); goTo(0); }
    else if(k === 'End'){ e.preventDefault(); goTo(sections.length-1); }
  });

  window.__ccGoTo = function(id){
    var i = sections.map(function(el){ return el.id; }).indexOf(id);
    if(i >= 0) goTo(i);
  };

  var settle;
  on(window, 'scroll', function(){
    if(animating) return;
    clearTimeout(settle);
    settle = setTimeout(function(){ idx = nearest(); dots(); }, 140);
  }, {passive:true});

  /* copy drifts with the beat — parallax between states */
  (function drift(){
    if(disposed) return;
    rafB = requestAnimationFrame(drift);
    var mid = scrollY + innerHeight*0.5;
    for(var i=0;i<sections.length;i++){
      var el = sections[i], colEl = el.firstElementChild;
      var d = (el.offsetTop + el.offsetHeight*0.5 - mid) / innerHeight;
      if(Math.abs(d) > 1.3){ if(colEl.style.opacity !== '0') colEl.style.opacity = '0'; continue; }
      colEl.style.transform = 'translateY(' + (d * -46).toFixed(1) + 'px)';
      colEl.style.opacity = String(Math.max(0, 1 - Math.abs(d)*1.18).toFixed(3));
    }
  })();

  /* reveal-on-scroll for the copy */
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('in'); });
  }, {threshold:0.18});
  [].forEach.call(document.querySelectorAll('.rv'), function(el, i){
    el.style.transitionDelay = (i%6)*45 + 'ms';
    io.observe(el);
  });

  window.__ready = true;
  
  }

  return function cleanup() {
    disposed = true;
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    offs.forEach((f) => f());
    if (rendererRef) {
      rendererRef.dispose();
      const el = rendererRef.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      rendererRef = null;
    }
    delete window.__ccGoTo;
    delete window.__setRarity;
  };
}
