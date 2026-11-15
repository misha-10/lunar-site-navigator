import * as THREE from 'three';

/**
 * LunaScope Lunar Coordinate System Specification
 * ------------------------------------------------
 * Reference Standard: IAU Mean Earth / Polar Axis (ME) Reference Frame
 *
 * Latitude (phi):
 *  - Range: -90.0° to +90.0°
 *  - 0° = Lunar Equator
 *  - +90° = North Pole
 *  - -90° = South Pole (Artemis exploration envelope: -80° to -90°S)
 *
 * Longitude (lambda):
 *  - Range: 0.0° to 360.0° East (or -180.0° to +180.0°)
 *  - 0° = Lunar Prime Meridian (facing Earth at mean libration)
 *  - 90°E = Eastern limb (Mare Crisium)
 *  - 180° = Lunar Far Side center
 *  - 270°E (90°W) = Western limb (Oceanus Procellarum)
 *
 * Three.js SphereGeometry Mapping:
 *  - In Three.js default SphereGeometry(radius, ...):
 *    - Polar axis = Y-axis: North Pole (+Y), South Pole (-Y).
 *    - Equatorial plane = XZ-plane.
 *    - Equirectangular texture U=0.5 (Prime Meridian) maps to +X axis.
 *    - Texture U=0.75 (90° East) maps to -Z axis.
 *    - Texture U=0.25 (270° East / 90° West) maps to +Z axis.
 *    - Texture U=1.0 / 0.0 (180° Far Side) maps to -X axis.
 *
 * Mathematical Transformation:
 *  Let phi_rad = latitude in radians, lambda_rad = longitude in radians:
 *    x = R * cos(phi_rad) * cos(lambda_rad)
 *    y = R * sin(phi_rad)
 *    z = -R * cos(phi_rad) * sin(lambda_rad)
 *
 * Validation against known reference locations (R = 1.0):
 *  - North Pole (90°N, 0°E):      x = 0.00,  y = +1.00, z = 0.00
 *  - South Pole (90°S, 0°E):      x = 0.00,  y = -1.00, z = 0.00
 *  - Prime Meridian (0°N, 0°E):   x = +1.00, y = 0.00,  z = 0.00
 *  - East Limb (0°N, 90°E):       x = 0.00,  y = 0.00,  z = -1.00
 *  - Far Side (0°N, 180°E):       x = -1.00, y = 0.00,  z = 0.00
 *  - West Limb (0°N, 270°E):      x = 0.00,  y = 0.00,  z = +1.00
 */

/**
 * Converts lunar latitude and longitude into 3D Cartesian coordinates on a Moon sphere.
 *
 * @param latDeg Latitude in decimal degrees (-90 to +90)
 * @param lonDeg Longitude in decimal degrees (0 to 360, or -180 to +180)
 * @param radius Sphere radius in Three.js units (default: 1.8)
 * @param elevationOffset Radial offset multiplier to prevent surface clipping (default: 1.012)
 * @returns THREE.Vector3 position
 */
export function lunarLatLonToVector3(
  latDeg: number,
  lonDeg: number,
  radius = 1.8,
  elevationOffset = 1.015
): THREE.Vector3 {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const effectiveRadius = radius * elevationOffset;

  const x = effectiveRadius * Math.cos(latRad) * Math.cos(lonRad);
  const y = effectiveRadius * Math.sin(latRad);
  const z = -effectiveRadius * Math.cos(latRad) * Math.sin(lonRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Inverse conversion: calculates lunar latitude and longitude from a 3D position vector.
 *
 * @param position THREE.Vector3 coordinates on or near the sphere
 * @returns Object with latitude (-90 to +90) and longitude (0 to 360) in degrees
 */
export function vector3ToLunarLatLon(
  position: THREE.Vector3
): { latitude: number; longitude: number } {
  const r = position.length();
  if (r === 0) return { latitude: 0, longitude: 0 };

  const latRad = Math.asin(Math.max(-1, Math.min(1, position.y / r)));
  const latDeg = (latRad * 180) / Math.PI;

  // Invert the forward equations:
  // x = r * cos(lat) * cos(lon)
  // z = -r * cos(lat) * sin(lon) => -z = r * cos(lat) * sin(lon)
  // atan2(-z, x) gives lonRad
  const lonRad = Math.atan2(-position.z, position.x);
  let lonDeg = (lonRad * 180) / Math.PI;
  if (lonDeg < 0) lonDeg += 360;

  return {
    latitude: Math.round(latDeg * 1000) / 1000,
    longitude: Math.round(lonDeg * 1000) / 1000,
  };
}

/**
 * Computes normal orientation vector pointing outward from sphere center.
 */
export function getSurfaceNormal(position: THREE.Vector3): THREE.Vector3 {
  return position.clone().normalize();
}
