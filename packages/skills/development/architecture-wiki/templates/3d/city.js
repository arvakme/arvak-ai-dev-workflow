import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const DATA = await fetch("../data.json").then((r) => r.json());
const FLOWS = DATA.flows || [];
const WIKI = DATA.wiki || {};
const N = {};
DATA.nodes.forEach((n) => {
  n.w ??= 1.1;
  n.d ??= 1.1;
  n.h ??= 0.8;
  N[n.code] = n;
});
const DIST = {};
DATA.districts.forEach((d) => (DIST[d.id] = d));

const TINTS = ["#3E7A5E", "#C9704A", "#557FA8", "#9A6FB4", "#B08F4C", "#BE5560"];
const tintOf = {};
DATA.districts.forEach((d, i) => (tintOf[d.id] = d.tint || TINTS[i % TINTS.length]));

const PAPER = "#FBFAF4";
const PAPER_DIM = "#E7E3D5";
const INK = "#20261F";
const HSCALE = 1.05;
const PLATFORM = 0.03;
const motionOK = !matchMedia("(prefers-reduced-motion: reduce)").matches;

const ic = (name, s = 13) =>
  `<svg class="ic" style="width:${s}px;height:${s}px"><use href="#ic-${name}"/></svg>`;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  const r = Math.round(A[0] * t + B[0] * (1 - t));
  const g = Math.round(A[1] * t + B[1] * (1 - t));
  const bl = Math.round(A[2] * t + B[2] * (1 - t));
  return (r << 16) + (g << 8) + bl;
}
function col(hex, tPaper = 0.4, paper = PAPER_DIM) {
  return mixHex(hex, paper, tPaper);
}

function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) =>
    /\.md(#|$)/.test(u) && !/^https?:/.test(u)
      ? `<a class="wl" data-href="${u}">${t}</a>`
      : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  return s;
}
function mdRender(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const lines = body.split("\n"), out = [];
  let i = 0, para = [], h1seen = false;
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  while (i < lines.length) {
    const L = lines[i];
    if (/^```/.test(L)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue;
    }
    const h = L.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flush();
      if (h[1].length === 1 && !h1seen) { h1seen = true; i++; continue; }
      out.push(`<h${h[1].length} data-h="${esc(h[2].trim())}">${inline(h[2])}</h${h[1].length}>`); i++; continue;
    }
    if (/^\s*[-*]\s+/.test(L)) {
      flush(); const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(L)) {
      flush(); const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`); continue;
    }
    if (/^\|/.test(L) && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || "")) {
      flush(); const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      out.push(`<table><thead><tr>${cells(rows[0]).map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>` +
        rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") + "</tbody></table>");
      continue;
    }
    if (/^>\s?/.test(L)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`); continue;
    }
    if (/^---+\s*$/.test(L)) { flush(); out.push("<hr>"); i++; continue; }
    if (/^\s*$/.test(L)) { flush(); i++; continue; }
    para.push(L); i++;
  }
  flush();
  return `<div class="md-body">${out.join("")}</div>`;
}

const HEALTH_GRADES = [[90, "健康", "var(--accent)"], [75, "尚可", "#B08F4C"], [60, "亚健康", "#C9704A"], [0, "高危", "var(--warn)"]];
function healthScore() {
  const h = DATA.health;
  if (!h) return null;
  const n = h.files || 100;
  const cuts = [
    [Math.min(25, (h.dead ?? 0) / n * 500), `清理 ${h.dead} 个死文件`],
    [Math.min(15, (h.deadExports ?? 0) / n * 8), `删除 ${h.deadExports} 个未用导出`],
    [Math.min(25, (h.cycles ?? 0) * 6), `拆开 ${h.cycles} 条循环依赖`],
    [Math.min(25, (h.breaks ?? 0) * 8), `修复 ${h.breaks} 处断裂引用`],
    [Math.min(5, (h.suspects ?? 0) * .5), `逐一确认 ${h.suspects} 个疑似死文件`],
  ];
  const score = Math.max(0, Math.round(100 - cuts.reduce((s, [c]) => s + c, 0)));
  const [, grade, color] = HEALTH_GRADES.find(([t]) => score >= t);
  return { score, grade, color, cuts };
}
const HS = healthScore();
const HEALTH_SECTIONS = { dead: "死代码", cycles: "循环依赖", hotspot: "高危热点", breaks: "断点" };

const STAT_ICONS = [["语言", "globe"], ["行数", "file"], ["文件", "folder"], ["模块", "cube"], ["入口", "gateway"]];
const statIcon = (k) => (STAT_ICONS.find(([p]) => k.includes(p)) || [0, "sparkle"])[1];
document.getElementById("hdr").innerHTML =
  `<div class="brand">${DATA.meta.logo || ""}<div class="v">${esc(DATA.meta.title)}</div></div>` +
  `<div class="statbar">` + DATA.meta.stats.map(([k, v, tip]) =>
    `<div class="stat"${tip ? ` title="${esc(tip)}"` : ""}>${ic(statIcon(k), 12)}<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`
  ).join(`<span class="sep"></span>`) + `</div>` +
  (WIKI["health.md"]
    ? `<button id="btnHealth" class="vitals-btn"${HS ? ` style="--hc:${HS.color}"` : ""}>${ic("shield")}体检报告${HS ? `<span class="score">${HS.score}</span>` : ""}</button>`
    : "") +
  `<span class="proto">PROTOTYPE 3D</span>` +
  `<div class="spacer"></div>
   <div class="ops">
     <button id="btnPlay" class="primary">${ic("play")}播放</button>
     <button id="btnStep">${ic("stepfwd")}单步</button>
     <button id="btnReset">${ic("reset")}重置视角</button>
   </div>`;

if (DATA.meta.logo) {
  const img = DATA.meta.logo.match(/src="(data:[^"]+)"/);
  if (img) {
    const l = document.createElement("link");
    l.rel = "icon"; l.href = img[1];
    document.head.appendChild(l);
  }
}

const adj = {};
const addAdj = (a, b) => { (adj[a] ??= new Set()).add(b); (adj[b] ??= new Set()).add(a); };
DATA.links.forEach((l) => addAdj(l.from, l.to));
FLOWS.forEach((f) => f.steps.forEach((s) => addAdj(s.from, s.to)));

function pageBody(pageRef) {
  if (!pageRef) return "";
  const [path, anchor] = pageRef.split("#");
  const raw = WIKI[path];
  if (!raw) return `<p>页面不存在：${esc(path)}</p>`;
  const html = mdRender(raw);
  return html;
}
function srcList(arr) {
  if (!arr?.length) return "";
  const repo = DATA.meta.repoUrl;
  return `<ul>` + arr.map((p) => {
    const href = repo ? `${repo}/${p}` : null;
    return `<li class="src">${href ? `<a href="${href}" target="_blank" rel="noopener"><code>${esc(p)}</code></a>` : `<code>${esc(p)}</code>`}</li>`;
  }).join("") + `</ul>`;
}

let activeFlow = -1;
let selected = null;
let relTab = false;
let playTimer = null;
let beat = -1;

const navEl = document.getElementById("nav");
const panelEl = document.getElementById("panel");
const flowbar = document.getElementById("flowbar");

function buildNav() {
  let html = `<div class="filter"><div class="sbox"><svg class="ic sic"><use href="#ic-search"/></svg><input id="q" placeholder="搜索模块"></div></div>`;
  for (const d of DATA.districts) {
    const nodes = DATA.nodes.filter((n) => n.district === d.id);
    html += `<div class="grp" data-dist="${d.id}" style="color:${tintOf[d.id]}">${ic(d.icon && document.querySelector(`#ic-${d.icon}`) ? d.icon : "cube")}${esc(d.label)}<span class="ct">${nodes.length}</span></div><div class="grpbody">`;
    for (const n of nodes) {
      html += `<div class="item" data-code="${n.code}"><span class="code">${n.code}</span><span>${esc(n.short || n.name)}</span>${n.health ? `<span class="hdot"></span>` : ""}</div>`;
    }
    html += `</div>`;
  }
  navEl.innerHTML = html;
  navEl.querySelector("#q").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    navEl.querySelectorAll(".item").forEach((el) => {
      const n = N[el.dataset.code];
      const hit = !q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || (n.short || "").includes(q);
      el.classList.toggle("hid", !hit);
    });
  };
  navEl.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => select(el.dataset.code, true);
  });
  navEl.querySelectorAll(".grp").forEach((el) => {
    el.onclick = () => selectDistrict(el.dataset.dist);
  });
}

function syncFlowbar() {
  flowbar.hidden = false;
  flowbar.innerHTML = `<button data-i="-1" class="${activeFlow < 0 ? "on" : ""}">总览</button>` +
    FLOWS.map((f, i) => `<button data-i="${i}" class="${activeFlow === i ? "on" : ""}">${esc(f.title)}</button>`).join("");
  flowbar.querySelectorAll("button").forEach((b) => {
    b.onclick = () => setFlow(+b.dataset.i);
  });
}

function setFlow(i) {
  stopPlay();
  activeFlow = i;
  beat = -1;
  syncFlowbar();
  rebuildEdges();
  if (i >= 0) {
    selected = null;
    relTab = false;
    renderPanel();
    focusCodes(new Set(FLOWS[i].steps.flatMap((s) => [s.from, s.to])));
  } else {
    focusCodes(null);
    renderPanel();
  }
}

function renderPanel() {
  document.getElementById("tabPage").classList.toggle("on", !relTab);
  document.getElementById("tabRel").classList.toggle("on", relTab);
  if (activeFlow >= 0 && !selected) {
    const F = FLOWS[activeFlow];
    panelEl.innerHTML = `<div class="kicker">场景</div><h2>${esc(F.title)}</h2>
      <h3>步骤</h3>
      <ul class="steps">${F.steps.map((s, i) =>
        `<li class="${i === beat ? "now" : ""}" data-i="${i}"><span class="no">${i + 1}</span><span>${esc(s.title)} · ${s.from} → ${s.to}</span></li>`
      ).join("")}</ul>
      ${pageBody(F.page)}`;
    panelEl.querySelectorAll(".steps li").forEach((el) => {
      el.onclick = () => showBeat(+el.dataset.i);
    });
    bindWikiLinks();
    return;
  }
  if (selected && N[selected]) {
    const n = N[selected];
    if (relTab) {
      const up = DATA.links.filter((l) => l.to === n.code);
      const down = DATA.links.filter((l) => l.from === n.code);
      const flows = FLOWS.map((f, i) => ({ f, i, n: f.steps.filter((s) => s.from === n.code || s.to === n.code).length })).filter((x) => x.n);
      panelEl.innerHTML = `<div class="kicker">${esc(DIST[n.district]?.label || "")}</div><h2>${esc(n.name)}</h2>
        <h3>上游</h3>${up.length ? `<ul>${up.map((l) => `<li><button class="chip" data-code="${l.from}">${l.from}</button> ${esc(l.label || "")}</li>`).join("")}</ul>` : "<p>无</p>"}
        <h3>下游</h3>${down.length ? `<ul>${down.map((l) => `<li><button class="chip" data-code="${l.to}">${l.to}</button> ${esc(l.label || "")}</li>`).join("")}</ul>` : "<p>无</p>"}
        <h3>参与场景</h3>${flows.length ? `<div class="chips">${flows.map((x) => `<button class="chip" data-flow="${x.i}">${esc(x.f.title)}</button>`).join("")}</div>` : "<p>无</p>"}`;
      panelEl.querySelectorAll("[data-code]").forEach((b) => b.onclick = () => select(b.dataset.code, true));
      panelEl.querySelectorAll("[data-flow]").forEach((b) => b.onclick = () => setFlow(+b.dataset.flow));
      return;
    }
    const health = n.health?.length
      ? `<div class="chips">${n.health.map((h) => `<span class="chip hchip">${HEALTH_SECTIONS[h] || h}</span>`).join("")}</div>` : "";
    panelEl.innerHTML = `<div class="kicker">${esc(DIST[n.district]?.label || "")} · ${n.code}</div>
      <h2>${esc(n.name)}</h2>${health}
      ${n.sources?.length ? `<h3>关键出处</h3>${srcList(n.sources)}` : ""}
      ${pageBody(n.page)}`;
    bindWikiLinks();
    return;
  }
  panelEl.innerHTML = `<div class="kicker">系统</div><h2>${esc(DATA.meta.headline || DATA.meta.title)}</h2>
    ${pageBody("system.md")}
    <h3>分区</h3>
    <div class="chips">${DATA.districts.map((d) => `<button class="chip" data-dist="${d.id}">${esc(d.label)}</button>`).join("")}</div>`;
  panelEl.querySelectorAll("[data-dist]").forEach((b) => b.onclick = () => selectDistrict(b.dataset.dist));
  bindWikiLinks();
}
function bindWikiLinks() {
  panelEl.querySelectorAll(".wl").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const href = a.dataset.href;
      const node = DATA.nodes.find((n) => n.page && n.page.split("#")[0] === href.split("#")[0]);
      if (node) select(node.code, true);
      else {
        selected = null;
        panelEl.innerHTML = `<div class="kicker">Wiki</div><h2>${esc(href)}</h2>${pageBody(href)}`;
        bindWikiLinks();
      }
    };
  });
}

document.getElementById("tabPage").onclick = () => { relTab = false; renderPanel(); };
document.getElementById("tabRel").onclick = () => { relTab = true; renderPanel(); };
document.getElementById("handleNav").onclick = () => document.body.classList.toggle("nav-off");
document.getElementById("handleAside").onclick = () => document.body.classList.toggle("aside-off");

const btnHealth = document.getElementById("btnHealth");
if (btnHealth) {
  btnHealth.onclick = () => {
    const dlg = document.getElementById("healthDlg");
    const cuts = HS ? HS.cuts.filter((c) => c[0] > 0).map((c) => `<div>${esc(c[1])}</div>`).join("") : "";
    document.getElementById("healthBody").innerHTML =
      `<button class="hclose" id="hclose">${ic("x")}</button>
       <div class="hhead">体检报告</div>
       ${HS ? `<div class="vitals" style="--hc:${HS.color}"><div class="gscore">${HS.score}<span style="font-size:10px;color:var(--ink-soft)"> 分</span></div>
         <div class="vmeta"><div class="vgrade">${HS.grade}</div><div class="vadvice">${cuts}</div>
         <div class="vstats">
           <div class="vstat"><div class="vv">${DATA.health.dead}</div><div class="vk">死文件</div></div>
           <div class="vstat"><div class="vv">${DATA.health.cycles}</div><div class="vk">循环</div></div>
           <div class="vstat"><div class="vv">${DATA.health.breaks}</div><div class="vk">断点</div></div>
           <div class="vstat"><div class="vv">${DATA.health.suspects}</div><div class="vk">疑似</div></div>
         </div></div></div>` : ""}
       ${mdRender(WIKI["health.md"])}`;
    dlg.showModal();
    document.getElementById("hclose").onclick = () => dlg.close();
  };
}

/* ── 三维城：插画积木，不是写实沙盘 ── */
const stage = document.getElementById("stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#F2EFE6");

let viewH = 16.6;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -80, 80);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.id = "label-layer";
stage.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.maxPolarAngle = 1.22;
controls.minPolarAngle = 0.55;
controls.minDistance = 12;
controls.maxDistance = 70;
controls.screenSpacePanning = true;

const GX = Math.ceil(Math.max(...DATA.districts.map((d) => d.r[0] + d.r[2]))) + 1.2;
const GY = Math.ceil(Math.max(...DATA.districts.map((d) => d.r[1] + d.r[3]))) + 1.2;
const cx = GX / 2, cz = GY / 2;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GX + 10, GY + 10),
  new THREE.MeshBasicMaterial({ color: "#F2EFE6" })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(cx, 0, cz);
scene.add(ground);

const gridPts = [];
for (let i = 0; i <= Math.floor(GX); i++) gridPts.push(i, 0.006, 0, i, 0.006, GY);
for (let j = 0; j <= Math.floor(GY); j++) gridPts.push(0, 0.006, j, GX, 0.006, j);
scene.add(new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3)),
  new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.08 })
));

const city = new THREE.Group();
scene.add(city);
const pickables = [];
const nodeGroup = {};
const labels = {};
const labelObj = {};
let hovered = null;
let flowRuns = [];

function hexColor(n) { return new THREE.Color(n); }
function basic(c, extra = {}) {
  return new THREE.MeshBasicMaterial({ color: hexColor(c), ...extra });
}
function faceMats(tint, ext = false) {
  const top = mixHex(tint, PAPER, 0.26);
  const right = mixHex(tint, PAPER_DIM, 0.50);
  const left = mixHex(tint, PAPER_DIM, 0.58);
  const front = mixHex(tint, PAPER_DIM, 0.70);
  const back = mixHex(tint, PAPER_DIM, 0.62);
  const bot = mixHex(tint, PAPER_DIM, 0.82);
  const extra = ext ? { transparent: true, opacity: 0.4 } : {};
  const mk = (c) => basic(c, extra);
  return [mk(right), mk(left), mk(top), mk(bot), mk(front), mk(back)];
}
function edgeColor(tint) { return mixHex(tint, INK, 0.52); }
function addEdges(parent, geometry, tint, dashed = false) {
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color: edgeColor(tint), dashSize: 0.07, gapSize: 0.055, transparent: true, opacity: 0.7 })
    : new THREE.LineBasicMaterial({ color: edgeColor(tint), transparent: true, opacity: 0.72 });
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), mat);
  if (dashed) e.computeLineDistances();
  parent.add(e);
  return e;
}
function contactShadow(parent, w, d) {
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.18, d * 1.18),
    basic(mixHex(INK, PAPER, 0.12), { transparent: true, opacity: 0.14 })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(0.08, 0.004, 0.08);
  parent.add(sh);
}
function roofY(n) {
  if ((n.form || "box") === "stack") return PLATFORM + 4 * 0.22 * HSCALE + 0.04;
  return PLATFORM + n.h * HSCALE;
}
function addPick(mesh, code) {
  mesh.userData.code = code;
  pickables.push(mesh);
}

function graphicBox(parent, w, h, d, y0, tint, ext, code, ox = 0, oz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, faceMats(tint, ext));
  mesh.position.set(ox, y0 + h / 2, oz);
  parent.add(mesh);
  addEdges(mesh, geo, tint, ext);
  addPick(mesh, code);
  return mesh;
}

for (const d of DATA.districts) {
  const [x, y, w, h] = d.r;
  const tint = tintOf[d.id];
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.1, h - 0.1),
    basic(mixHex(tint, PAPER, 0.14))
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x + w / 2, 0.01, y + h / 2);
  floor.userData.district = d.id;
  g.add(floor);
  pickables.push(floor);
  const borderPts = [
    x + 0.08, 0.014, y + 0.08,
    x + w - 0.08, 0.014, y + 0.08,
    x + w - 0.08, 0.014, y + h - 0.08,
    x + 0.08, 0.014, y + h - 0.08,
    x + 0.08, 0.014, y + 0.08,
  ];
  const border = new THREE.Line(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(borderPts, 3)),
    new THREE.LineDashedMaterial({ color: edgeColor(tint), dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.55 })
  );
  border.computeLineDistances();
  g.add(border);
  const tag = document.createElement("div");
  tag.className = "dlabel";
  tag.textContent = d.label;
  const lab = new CSS2DObject(tag);
  lab.position.set(x + w / 2, 0.02, y + h - 0.28);
  g.add(lab);
  city.add(g);
}

for (const n of DATA.nodes) {
  const g = new THREE.Group();
  g.position.set(n.x + n.w / 2, 0, n.y + n.d / 2);
  g.userData.code = n.code;
  const tint = tintOf[n.district];
  const form = n.form || "box";
  const H = n.h * HSCALE;
  const ext = form === "external";
  contactShadow(g, n.w, n.d);
  if (form === "stack") {
    for (let i = 0; i < 4; i++) {
      graphicBox(g, n.w * 0.94, 0.16 * HSCALE, n.d * 0.94, PLATFORM + i * 0.22 * HSCALE, tint, false, n.code);
    }
  } else if (form === "slabs") {
    const hh = Math.max(H, 0.7);
    graphicBox(g, n.w * 0.4, hh, n.d * 0.88, PLATFORM, tint, false, n.code, -n.w * 0.28, 0);
    graphicBox(g, n.w * 0.4, hh * 0.78, n.d * 0.88, PLATFORM, tint, false, n.code, 0.06, 0.04);
    graphicBox(g, n.w * 0.34, hh * 0.55, n.d * 0.78, PLATFORM, tint, false, n.code, n.w * 0.34, -0.03);
  } else if (form === "cylinder") {
    const geo = new THREE.CylinderGeometry(n.w * 0.42, n.w * 0.42, H, 24);
    const mesh = new THREE.Mesh(geo, [
      basic(mixHex(tint, PAPER_DIM, 0.62)),
      basic(mixHex(tint, PAPER, 0.26)),
      basic(mixHex(tint, PAPER, 0.26)),
    ]);
    mesh.position.y = PLATFORM + H / 2;
    g.add(mesh);
    addEdges(mesh, geo, tint);
    addPick(mesh, n.code);
  } else {
    graphicBox(g, n.w, H, n.d, PLATFORM, tint, ext, n.code);
  }
  if (n.health?.length) {
    const badge = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      basic(0xBE5560)
    );
    badge.position.set(n.w * 0.32, roofY(n) + 0.1, -n.d * 0.32);
    g.add(badge);
  }
  const el = document.createElement("div");
  el.className = "nlabel";
  const icon = n.icon && document.querySelector(`#ic-${n.icon}`) ? n.icon : "cube";
  el.innerHTML = `${ic(icon, 11)}<span class="code">${n.code}</span>${esc(n.short || n.name)}`;
  el.onclick = (e) => { e.stopPropagation(); select(n.code); };
  const lab = new CSS2DObject(el);
  lab.position.set(0, 0.02, n.d / 2 + 0.38);
  g.add(lab);
  labels[n.code] = el;
  labelObj[n.code] = lab;
  city.add(g);
  nodeGroup[n.code] = g;
}

const linkGroup = new THREE.Group();
const flowGroup = new THREE.Group();
city.add(linkGroup, flowGroup);
const pulse = new THREE.Mesh(
  new THREE.SphereGeometry(0.11, 16, 16),
  basic(0xFBFAF4)
);
pulse.visible = false;
scene.add(pulse);
const pulseCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.055, 12, 12),
  basic(0x3E7A5E)
);
pulse.add(pulseCore);

function attachY(n) {
  return PLATFORM + n.h * HSCALE * 0.52;
}
function port(n, toward, y) {
  const c = new THREE.Vector3(n.x + n.w / 2, y, n.y + n.d / 2);
  const dir = new THREE.Vector3(toward.x - c.x, 0, toward.z - c.z);
  if (dir.lengthSq() < 1e-6) return c;
  dir.normalize();
  const kx = (n.w / 2 + 0.02) / Math.max(Math.abs(dir.x), 1e-6);
  const kz = (n.d / 2 + 0.02) / Math.max(Math.abs(dir.z), 1e-6);
  return c.add(dir.multiplyScalar(Math.min(kx, kz)));
}
function curveOf(from, to, via, kind = "flow") {
  const a = N[from], b = N[to];
  if (!a || !b) return null;
  const hint = via?.[0]
    ? new THREE.Vector3(via[0][0], 0, via[0][1])
    : new THREE.Vector3((a.x + a.w / 2 + b.x + b.w / 2) / 2, 0, (a.y + a.d / 2 + b.y + b.d / 2) / 2);
  const p0 = port(a, hint, attachY(a));
  const p1 = port(b, hint, attachY(b));
  const lift = kind === "flow"
    ? Math.max(roofY(a), roofY(b)) + 0.5
    : Math.max(attachY(a), attachY(b)) + 0.28;
  if (via?.length) {
    return new THREE.CatmullRomCurve3([p0, ...via.map(([x, z]) => new THREE.Vector3(x, lift, z)), p1]);
  }
  const mid = new THREE.Vector3((p0.x + p1.x) / 2, lift, (p0.z + p1.z) / 2);
  return new THREE.QuadraticBezierCurve3(p0, mid, p1);
}

function tubeMesh(curve, radius, color, extra = {}) {
  const segs = Math.max(24, Math.ceil(curve.getLength() * 12));
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, segs, radius, 8, false),
    basic(color, extra)
  );
}
function flowArrow(curve, color) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 10), basic(color));
  const t = curve.getTangent(0.93).normalize();
  cone.position.copy(curve.getPoint(0.93));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t);
  return cone;
}
function clearGroup(g) {
  while (g.children.length) {
    const o = g.children.pop();
    o.traverse((x) => {
      x.geometry?.dispose?.();
      const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : [];
      for (const m of ms) { m.map?.dispose?.(); m.dispose?.(); }
    });
  }
}
function setLinkDim(on) {
  linkGroup.traverse((o) => {
    if (o.material && "opacity" in o.material) {
      o.material.transparent = true;
      o.material.opacity = on ? 0.16 : 0.72;
    }
  });
}
function paintFlow() {
  flowRuns.forEach((r, i) => {
    const hot = beat === i;
    const on = beat < 0 || hot;
    r.core.material.color.setHex(hot ? 0x2C5E47 : 0x3E7A5E);
    r.core.material.transparent = !on;
    r.core.material.opacity = on ? 1 : 0.22;
    r.halo.visible = hot;
    r.arrow.material.color.setHex(on ? 0x3E7A5E : 0xB5C1B0);
    r.arrow.material.transparent = !on;
    r.arrow.material.opacity = on ? 1 : 0.22;
  });
}

function rebuildEdges() {
  clearGroup(linkGroup);
  clearGroup(flowGroup);
  flowRuns = [];
  for (const l of DATA.links) {
    const c = curveOf(l.from, l.to, l.via, "link");
    if (!c) continue;
    const mesh = tubeMesh(c, 0.07, 0x20261F, { transparent: true, opacity: 0.7 });
    mesh.userData.link = l;
    linkGroup.add(mesh);
  }
  if (activeFlow >= 0) {
    FLOWS[activeFlow].steps.forEach((s) => {
      const c = curveOf(s.from, s.to, s.via);
      if (!c) return;
      const halo = tubeMesh(c, 0.14, 0xF7F3E8, { transparent: true, opacity: 0.4, depthWrite: false });
      const core = tubeMesh(c, 0.075, 0x3E7A5E);
      const arrow = flowArrow(c, 0x3E7A5E);
      halo.visible = false;
      flowGroup.add(halo, core, arrow);
      flowRuns.push({ curve: c, core, halo, arrow });
    });
    paintFlow();
  }
  setLinkDim(activeFlow >= 0);
}

let pulseCurve = null;
let pulseT = 0;

function showBeat(k) {
  const F = FLOWS[activeFlow];
  if (!F) return;
  beat = k;
  const s = F.steps[k];
  paintFlow();
  focusCodes(new Set([s.from, s.to]));
  pulseCurve = flowRuns[k]?.curve || null;
  pulseT = 0;
  pulse.visible = !!pulseCurve && motionOK;
  renderPanel();
}
function curBeats() { return activeFlow >= 0 ? FLOWS[activeFlow].steps : []; }
function setPlayLabel(on) {
  const b = document.getElementById("btnPlay");
  b.innerHTML = on ? `${ic("play")}暂停` : `${ic("play")}播放`;
}
function stopPlay() {
  if (playTimer) { clearTimeout(playTimer); playTimer = null; }
  pulse.visible = false;
  pulseCurve = null;
  setPlayLabel(false);
}
function playNext() {
  const steps = curBeats();
  if (!steps.length) return;
  showBeat((beat + 1) % steps.length);
  if (playTimer) playTimer = setTimeout(playNext, 1100);
}
document.getElementById("btnPlay").onclick = () => {
  if (playTimer) { stopPlay(); return; }
  if (activeFlow < 0) setFlow(0);
  playTimer = setTimeout(() => {}, 0);
  setPlayLabel(true);
  playNext();
};
document.getElementById("btnStep").onclick = () => {
  stopPlay();
  if (activeFlow < 0) setFlow(0);
  showBeat((beat + 1) % curBeats().length);
};

function setGroupOpacity(g, op) {
  const ext = N[g.userData.code]?.form === "external";
  const target = op * (ext ? 0.42 : 1);
  g.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!("opacity" in m)) continue;
      m.transparent = target < 0.99;
      m.opacity = target;
    }
  });
}
function focusCodes(set) {
  for (const n of DATA.nodes) {
    const on = !set || set.has(n.code);
    setGroupOpacity(nodeGroup[n.code], on ? 1 : 0.38);
    labels[n.code].classList.toggle("dim", !on);
  }
}

const selRing = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x3E7A5E, transparent: true, opacity: 0.9 })
);
selRing.visible = false;
scene.add(selRing);
function ringGeom(n) {
  const hw = n.w / 2 + 0.18, hd = n.d / 2 + 0.18;
  const y = 0.02;
  const p = [ -hw,y,-hd, hw,y,-hd, hw,y,hd, -hw,y,hd, -hw,y,-hd ];
  selRing.geometry.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
}

function select(code) {
  selected = code;
  relTab = false;
  navEl.querySelectorAll(".item").forEach((el) => el.classList.toggle("sel", el.dataset.code === code));
  for (const [c, el] of Object.entries(labels)) el.classList.toggle("sel", c === code);
  if (code && N[code]) {
    const n = N[code];
    selRing.visible = true;
    selRing.position.set(n.x + n.w / 2, 0, n.y + n.d / 2);
    ringGeom(n);
    focusCodes(new Set([code, ...(adj[code] || [])]));
  } else {
    selRing.visible = false;
    if (activeFlow < 0) focusCodes(null);
  }
  renderPanel();
}
function selectDistrict(id) {
  selected = null;
  selRing.visible = false;
  const set = new Set(DATA.nodes.filter((n) => n.district === id).map((n) => n.code));
  focusCodes(set);
  const d = DIST[id];
  panelEl.innerHTML = `<div class="kicker">分区</div><h2>${esc(d.label)}</h2>${pageBody(d.page)}
    <h3>包含模块</h3><div class="chips">${[...set].map((c) => `<button class="chip" data-code="${c}">${c} ${esc(N[c].short)}</button>`).join("")}</div>`;
  panelEl.querySelectorAll("[data-code]").forEach((b) => b.onclick = () => select(b.dataset.code));
  bindWikiLinks();
}

const homeTarget = new THREE.Vector3(cx, 0.15, cz);
function applyHome() {
  const sph = new THREE.Spherical(36, 1.02, Math.PI / 4);
  camera.position.setFromSpherical(sph).add(homeTarget);
  controls.target.copy(homeTarget);
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}
applyHome();

document.getElementById("btnReset").onclick = () => {
  stopPlay();
  select(null);
  activeFlow = -1;
  beat = -1;
  syncFlowbar();
  rebuildEdges();
  focusCodes(null);
  applyHome();
  renderPanel();
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let down = null;
function ndc(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
}
function hitAt(ev) {
  ndc(ev);
  raycaster.setFromCamera(mouse, camera);
  return raycaster.intersectObjects(pickables, true)[0];
}
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
  down = null;
  if (moved) return;
  const hit = hitAt(e);
  if (hit?.object.userData.code) select(hit.object.userData.code);
  else if (hit?.object.userData.district) selectDistrict(hit.object.userData.district);
  else select(null);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (down) return;
  const hit = hitAt(e);
  const code = hit?.object.userData.code || null;
  renderer.domElement.style.cursor = code || hit?.object.userData.district ? "pointer" : "";
  if (code === hovered) return;
  if (hovered && nodeGroup[hovered]) nodeGroup[hovered].position.y = 0;
  hovered = code;
  if (code && motionOK && nodeGroup[code] && code !== selected) {
    nodeGroup[code].position.y = 0.06;
  }
});

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const aspect = w / Math.max(h, 1);
  camera.left = -viewH * aspect;
  camera.right = viewH * aspect;
  camera.top = viewH;
  camera.bottom = -viewH;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
new ResizeObserver(resize).observe(stage);
resize();



const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  controls.update();
  if (pulse.visible && pulseCurve) {
    pulseT = (pulseT + dt * 0.9) % 1;
    pulse.position.copy(pulseCurve.getPoint(pulseT));
  }
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

buildNav();
syncFlowbar();
rebuildEdges();
renderPanel();
tick();
