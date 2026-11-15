import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useMission } from '../context/MissionContext';
import { createProceduralLunarTexture } from '../utils/lunarTexture';
import { LandingSiteMarker } from './LandingSiteMarker';

export interface MoonGlobeProps {
  radius?: number;
  wireframe?: boolean;
}

export const MoonGlobe: React.FC<MoonGlobeProps> = ({
  radius = 1.8,
  wireframe = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { allSites, selectedSite, selectSiteById } = useMission();
  const [texture, setTexture] = useState<THREE.Texture>(() =>
    createProceduralLunarTexture(512, 256)
  );

  // Load official high-res NASA lunar surface texture from public directory
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/moon_1024.jpg',
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.wrapS = THREE.RepeatWrapping;
        loadedTex.wrapT = THREE.ClampToEdgeWrapping;
        setTexture(loadedTex);
      },
      undefined,
      () => {
        // Fallback already set
      }
    );
  }, []);

  const sitesToRender = useMemo(() => {
    const list = [...allSites];
    if (selectedSite && !allSites.some((s) => s.id === selectedSite.id)) {
      list.push(selectedSite);
    }
    return list;
  }, [allSites, selectedSite]);

  return (
    <group>
      {/* 1. Realistic Multi-Directional Lighting for Polar Visibility */}
      {/* Primary Grazing Solar Directional Light illuminating the South Polar region */}
      <directionalLight
        position={[5, 1, 5]}
        intensity={2.6}
        color="#FFFBF0"
      />

      {/* Secondary Soft Solar Fill from opposite angle */}
      <directionalLight
        position={[-4, 3, 2]}
        intensity={0.6}
        color="#E2E8F0"
      />

      {/* Earthshine Fill from space */}
      <directionalLight
        position={[0, -5, 3]}
        intensity={0.4}
        color="#93C5FD"
      />

      {/* Ambient Light ensuring night-side terrain remains discernible */}
      <ambientLight intensity={0.18} color="#94A3B8" />

      {/* 2. Spherical Moon Mesh & Landing Site Markers */}
      {/* Axial tilt (-1.15 rad / ~66°) orients the South Pole directly toward the viewer */}
      <group rotation={[-1.15, 0, 0]}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.88}
            metalness={0.02}
            wireframe={wireframe}
          />
        </mesh>

        {/* 3. Surface Landing Site Markers */}
        {sitesToRender.map((site) => (
          <LandingSiteMarker
            key={site.id}
            site={site}
            radius={radius}
            isSelected={selectedSite?.id === site.id}
            onSelect={selectSiteById}
          />
        ))}
      </group>
    </group>
  );
};

export default MoonGlobe;
