// Validates data/places.json. Run: node tools/check-places.mjs
import {readFileSync} from "node:fs";

const places = JSON.parse(readFileSync(new URL("../data/places.json", import.meta.url)));
const world = JSON.parse(readFileSync(new URL("../data/countries-110m.json", import.meta.url)));
const countryNames = new Set(world.objects.countries.geometries.map(g => g.properties.name));

const errors = [], warnings = [], ids = new Set();
places.forEach((p, i) => {
  const at = `#${i} ${p.name || p.id || "(unnamed)"}`;
  for (const k of ["id", "name", "country", "lat", "lng", "status"]) if (p[k] === undefined || p[k] === "") errors.push(`${at}: missing "${k}"`);
  if (ids.has(p.id)) errors.push(`${at}: duplicate id "${p.id}"`);
  ids.add(p.id);
  if (p.id && !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${at}: id should be lowercase letters, digits and dashes`);
  if (!["visited", "wishlist"].includes(p.status)) errors.push(`${at}: status must be "visited" or "wishlist"`);
  if (typeof p.lat !== "number" || p.lat < -90 || p.lat > 90) errors.push(`${at}: bad lat`);
  if (typeof p.lng !== "number" || p.lng < -180 || p.lng > 180) errors.push(`${at}: bad lng`);
  if (p.status === "visited" && !Number.isInteger(p.year)) warnings.push(`${at}: visited place has no "year" (won't show on timeline)`);
  if (p.rating !== undefined && !(Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 5)) errors.push(`${at}: rating must be 1-5`);
  if (p.tags !== undefined && !Array.isArray(p.tags)) errors.push(`${at}: tags must be a list`);
  if (p.photos !== undefined && !Array.isArray(p.photos)) errors.push(`${at}: photos must be a list`);
  if (p.country && !countryNames.has(p.country)) warnings.push(`${at}: country "${p.country}" not in map shapes (won't be shaded; small countries are missing at this resolution)`);
});

warnings.forEach(w => console.log("warn  " + w));
errors.forEach(e => console.log("ERROR " + e));
console.log(`${places.length} places, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
