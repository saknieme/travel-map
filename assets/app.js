// Travel map: loads data/places.json and renders map, list, detail and timeline.
// Places are edited in data/places.json (see CLAUDE.md); the page itself never writes data.

const WORLD_COUNTRIES = 195;
const $ = s => document.querySelector(s);
const fold = s => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const fmtCoord = (lat, lng) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;

let places = [], countryShapes = [];
let filter = "all", year = null, query = "", selId = null;

// ---------- Map ----------
const map = L.map("map", {zoomControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 18});
L.control.zoom({position: "topright"}).addTo(map);
const ResetControl = L.Control.extend({
  options: {position: "topright"},
  onAdd() {
    const bar = L.DomUtil.create("div", "leaflet-bar");
    const a = L.DomUtil.create("a", "", bar);
    a.href = "#"; a.innerHTML = "⤢"; a.title = "Show all places"; a.setAttribute("role", "button");
    L.DomEvent.on(a, "click", e => { L.DomEvent.preventDefault(e); fitAll(); });
    return bar;
  }
});
new ResetControl().addTo(map);

// Esri light/dark gray canvas (no API key needed) with a separate label layer; follows the system color scheme.
const dark = matchMedia("(prefers-color-scheme: dark)");
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const tiles = L.tileLayer("", {maxNativeZoom: 16, maxZoom: 18, attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"}).addTo(map);
const labels = L.tileLayer("", {maxNativeZoom: 16, maxZoom: 18, pane: "shadowPane"}).addTo(map);
function setTiles() {
  const shade = dark.matches ? "Dark" : "Light";
  tiles.setUrl(`${ESRI}/World_${shade}_Gray_Base/MapServer/tile/{z}/{y}/{x}`);
  labels.setUrl(`${ESRI}/World_${shade}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`);
}
setTiles();
dark.addEventListener("change", () => { setTiles(); paintCountries(); });

const countryLayer = L.geoJSON(null, {interactive: false}).addTo(map);
const markers = new Map();

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function paintCountries() {
  const vis = new Set(places.filter(p => p.status === "visited").map(p => p.country));
  const color = css("--land-visited");
  countryLayer.clearLayers();
  countryLayer.addData(countryShapes.filter(f => vis.has(f.properties.name)));
  countryLayer.setStyle({color, weight: 1, opacity: .6, fillColor: color, fillOpacity: dark.matches ? .18 : .22});
}

function visible(p) {
  if (filter !== "all" && p.status !== filter) return false;
  if (year && p.year !== year) return false;
  if (query) {
    const hay = fold([p.name, p.country, p.notes, ...(p.tags || [])].join(" "));
    if (!hay.includes(query)) return false;
  }
  return true;
}

function drawPins() {
  for (const p of places) {
    let m = markers.get(p.id);
    if (!m) {
      m = L.marker([p.lat, p.lng], {keyboard: true, title: p.name}).addTo(map);
      m.on("click", () => select(p.id));
      markers.set(p.id, m);
    }
    const sel = p.id === selId, show = visible(p);
    const size = sel ? 30 : 22;
    m.setIcon(L.divIcon({className: `pin ${p.status}${sel ? " sel" : ""}${show ? "" : " dim"}`, html: "<i></i>", iconSize: [size, size]}));
    m.setZIndexOffset(sel ? 1000 : p.status === "visited" ? 100 : 0);
    m.unbindTooltip();
    if (show) m.bindTooltip(esc(p.name), {className: "pin-label", direction: "right", offset: [10, 0], permanent: sel});
  }
}

function fitAll() {
  const pts = places.filter(visible);
  if (!pts.length) { map.setView([30, 10], 2); return; }
  map.flyToBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), {padding: [40, 40], maxZoom: 5, duration: .6});
}
function flyTo(p) { map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 6), {duration: .6}); }

// ---------- Panel ----------
const WX = {0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌧️", 61: "🌦️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 77: "🌨️", 80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "❄️", 95: "⛈️", 96: "⛈️", 99: "⛈️"};

function renderDetail() {
  const p = places.find(x => x.id === selId);
  if (!p) { $("#detail").innerHTML = `<p class="hint">Select a place on the map or in the list.</p>`; return; }
  const v = p.status === "visited";
  const r = Math.max(0, Math.min(5, p.rating || 0));
  const facts = v
    ? `${p.when ? `<dt>When</dt><dd>${esc(p.when)}</dd>` : ""}${r ? `<dt>Rating</dt><dd aria-label="${r} of 5">${"★".repeat(r)}<span style="opacity:.3">${"★".repeat(5 - r)}</span></dd>` : ""}`
    : `${p.priority ? `<dt>Priority</dt><dd>${esc(p.priority)}</dd>` : ""}${p.season ? `<dt>Best time</dt><dd>${esc(p.season)}</dd>` : ""}`;
  const photos = (p.photos || []).length
    ? `<div class="photos">${p.photos.map(src => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Photo from ${esc(p.name)}" loading="lazy"></a>`).join("")}</div>` : "";
  const where = encodeURIComponent(`${p.name}, ${p.country}`);
  const plan = encodeURIComponent(`Help me plan a trip to ${p.name}, ${p.country}.${p.season ? ` Best time: ${p.season}.` : ""}${p.notes ? ` My notes: ${p.notes}` : ""}${p.tags?.length ? ` Interests: ${p.tags.join(", ")}.` : ""}`);
  const btns = v
    ? `<a class="btn" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=12/${p.lat}/${p.lng}" target="_blank" rel="noopener">Open in map ↗</a>`
    : `<a class="btn claude" href="https://claude.ai/new?q=${plan}" target="_blank" rel="noopener">✦ Plan this trip ↗</a>
       <a class="btn" href="https://www.booking.com/searchresults.html?ss=${where}" target="_blank" rel="noopener">Find stays ↗</a>
       <button class="btn" data-a="weather">Weather</button>`;
  $("#detail").innerHTML = `
    <div class="top"><div><h2>${esc(p.name)}</h2><div class="coords">${esc(p.country)} · ${fmtCoord(p.lat, p.lng)}</div></div>
    <span class="badge ${p.status}">${v ? "Visited" : "Wishlist"}</span></div>
    ${facts ? `<dl class="facts">${facts}</dl>` : ""}
    ${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ""}
    ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    ${photos}
    <div class="btnrow">${btns}</div>
    <div id="wx"></div>`;
}

async function showWeather(p) {
  const box = $("#wx");
  box.innerHTML = `<p class="hint">Loading forecast…</p>`;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
    const d = (await (await fetch(url)).json()).daily;
    if (selId !== p.id) return;
    box.innerHTML = `<div class="wx">${d.time.map((t, i) => `<div>
      <span>${new Date(t + "T12:00").toLocaleDateString(undefined, {weekday: "short"})}</span>
      <b aria-hidden="true">${WX[d.weather_code[i]] || "·"}</b>
      <span>${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</span></div>`).join("")}</div>
      <p class="hint" style="margin-top:4px">5-day forecast · Open-Meteo</p>`;
  } catch {
    if (selId === p.id) box.innerHTML = `<p class="hint">Couldn’t load the forecast right now.</p>`;
  }
}
$("#detail").addEventListener("click", e => {
  if (e.target.closest("[data-a]")?.dataset.a === "weather") showWeather(places.find(x => x.id === selId));
});

function renderList() {
  const groups = [["visited", "Visited"], ["wishlist", "Wishlist"]];
  let html = "";
  for (const [st, label] of groups) {
    const items = places.filter(p => p.status === st && visible(p))
      .sort((a, b) => st === "visited" ? (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    if (!items.length) continue;
    html += `<li><h3>${label} · ${items.length}</h3></li>`;
    html += items.map(p => `<li><button class="item" data-id="${esc(p.id)}" aria-current="${p.id === selId}">
      <span class="dot ${st === "visited" ? "v" : "w"}"></span>
      <span><div class="nm">${esc(p.name)}</div><div class="sub">${esc(p.country)}</div></span>
      <span class="yr">${st === "visited" ? esc(p.year ?? "") : esc(p.season ?? "")}</span></button></li>`).join("");
  }
  $("#list").innerHTML = html || `<li class="hint" style="padding:12px">${places.length ? "No places match. Try another filter." : "No places yet."}</li>`;
}
$("#list").addEventListener("click", e => {
  const b = e.target.closest(".item"); if (!b) return;
  select(b.dataset.id); flyTo(places.find(p => p.id === b.dataset.id));
});

function renderStats() {
  const v = places.filter(p => p.status === "visited");
  const nC = new Set(v.map(p => p.country)).size;
  const pct = Math.round(nC / WORLD_COUNTRIES * 100);
  $("#stats").innerHTML = `
    <div class="stat"><strong>${v.length}</strong><span>Places visited</span></div>
    <div class="stat"><strong>${nC}</strong><span>Countries</span></div>
    <div class="stat"><strong>${pct}%</strong><span>Of the world</span><div class="meter"><i style="width:${Math.max(pct, 1)}%"></i></div></div>
    <div class="stat"><strong>${places.length - v.length}</strong><span>On wishlist</span></div>`;
}

// ---------- Timeline ----------
function renderTimeline() {
  const ys = places.filter(p => p.status === "visited" && p.year).map(p => p.year);
  const now = new Date().getFullYear();
  const first = ys.length ? Math.min(...ys) : now, last = Math.max(now, ...ys);
  const yrs = Array.from({length: last - first + 1}, (_, i) => first + i);
  const x = i => yrs.length === 1 ? 500 : 30 + i * 940 / (yrs.length - 1);
  const half = Math.min(40, 470 / yrs.length);
  let svg = `<line class="axis" x1="20" x2="980" y1="30" y2="30"/>`;
  yrs.forEach((y, i) => {
    const n = ys.filter(v => v === y).length;
    const dots = Array.from({length: n}, (_, j) => `<circle class="trip" cx="${(j - (n - 1) / 2) * 12}" cy="30" r="5" opacity="${year && year !== y ? .3 : 1}"/>`).join("");
    svg += `<g class="tick" data-y="${y}" transform="translate(${x(i)},0)"><rect class="hit" x="${-half}" width="${half * 2}" height="54"/>${dots}
      <text class="yr${y === year ? " on" : ""}" y="52" text-anchor="middle">${y}</text></g>`;
  });
  $("#tl").innerHTML = svg;
  $("#tlinfo").innerHTML = year ? `Showing ${year} · <button class="linkbtn" id="clr">Show all years</button>` : "Click a year to filter";
  $("#clr")?.addEventListener("click", () => { year = null; renderAll(); });
}
$("#tl").addEventListener("click", e => {
  const t = e.target.closest(".tick"); if (!t) return;
  const y = +t.dataset.y; year = year === y ? null : y; renderAll();
});

// ---------- Export ----------
const COLS = ["id", "name", "country", "lat", "lng", "status", "year", "when", "rating", "priority", "season", "notes", "tags"];
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toCSV() {
  const cell = v => { const s = Array.isArray(v) ? v.join("; ") : String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [COLS.join(","), ...places.map(p => COLS.map(c => cell(p[c])).join(","))].join("\n");
}
document.querySelectorAll("[data-export]").forEach(b => b.onclick = () => {
  const stamp = new Date().toISOString().slice(0, 10);
  if (b.dataset.export === "json") download(`travel-map-${stamp}.json`, JSON.stringify(places, null, 2), "application/json");
  else download(`travel-map-${stamp}.csv`, "﻿" + toCSV(), "text/csv");
  b.closest("details").open = false;
});
document.addEventListener("click", e => { const d = $(".export"); if (d.open && !d.contains(e.target)) d.open = false; });

// ---------- Glue ----------
function select(id) {
  selId = id;
  history.replaceState(null, "", id ? `#${encodeURIComponent(id)}` : location.pathname);
  renderDetail(); renderList(); drawPins();
}
function renderAll() { renderStats(); renderDetail(); renderList(); drawPins(); renderTimeline(); }
document.querySelectorAll(".chip").forEach(c => c.onclick = () => {
  filter = c.dataset.f; document.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === c)); renderAll();
});
$("#q").addEventListener("input", e => { query = fold(e.target.value.trim()); renderList(); drawPins(); });
let tt;
function toast(m) { const el = $("#toast"); el.textContent = m; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => el.hidden = true, 3200); }
new ResizeObserver(() => map.invalidateSize()).observe($("#map"));

(async function init() {
  map.setView([30, 10], 2);
  try {
    const [pl, world] = await Promise.all([
      fetch("data/places.json", {cache: "no-cache"}).then(r => r.json()),
      fetch("data/countries-110m.json").then(r => r.json())
    ]);
    places = pl;
    countryShapes = topojson.feature(world, world.objects.countries).features;
  } catch (err) {
    toast(location.protocol === "file:" ? "Open this page through a web server (see CLAUDE.md), not as a file." : "Couldn’t load places.");
    console.error(err);
    return;
  }
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const latest = places.filter(p => p.status === "visited").sort((a, b) => (b.year || 0) - (a.year || 0))[0];
  selId = places.some(p => p.id === fromHash) ? fromHash : latest?.id ?? null;
  paintCountries(); renderAll();
  const p = places.find(x => x.id === fromHash);
  if (p) map.setView([p.lat, p.lng], 6);
  else if (places.length) map.fitBounds(L.latLngBounds(places.map(p => [p.lat, p.lng])), {padding: [40, 40], maxZoom: 5});
})();
