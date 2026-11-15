import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { LunarSite } from '../types/mission';
import { lunarLatLonToVector3 } from '../utils/coordinates';

export interface LandingSiteMarkerProps {
  site: LunarSite;
  isSelected: boolean;
  onSelect: (siteId: string) => void;
  radius?: number;
}

export const LandingSiteMarker: React.FC<LandingSiteMarkerProps> = ({
  site,
  isSelected,
  onSelect,
  radius = 1.8,
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const pulseRingRef = useRef<THREE.Mesh>(null);

  // Compute 3D Cartesian position on the Moon sphere
  const position = useMemo(() => {
    return lunarLatLonToVector3(site.latitude, site.longitude, radius, 1.012);
  }, [site.latitude, site.longitude, radius]);

  // Compute normal orientation pointing radially outward from the Moon's center
  const orientation = useMemo(() => {
    const normal = position.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    return quat;
  }, [position]);

  // Pulsing animation for the active selection beacon
  useFrame(({ clock }) => {
    if (pulseRingRef.current && isSelected) {
      const t = clock.getElapsedTime() * 3.5;
      const scale = 1.0 + (Math.sin(t) + 1) * 0.25;
      pulseRingRef.current.scale.set(scale, scale, scale);
    }
  });

  const primaryColor = isSelected ? '#38BDF8' : '#FBBF24';

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(site.id);
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setIsHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={position} quaternion={orientation}>
      {/* 1. Base Target Disc on Surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <ringGeometry args={[0.015, 0.028, 24]} />
        <meshBasicMaterial
          color={primaryColor}
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 0.95 : 0.6}
        />
      </mesh>

      {/* 2. Elevated Pin Stem */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.07, 8]} />
        <meshBasicMaterial color={primaryColor} />
      </mesh>

      {/* 3. Glowing Beacon Bead / Pinhead */}
      <mesh
        position={[0, 0.075, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[isSelected ? 0.026 : 0.018, 16, 16]} />
        <meshBasicMaterial color={primaryColor} />
      </mesh>

      {/* 4. Active Pulsing Beacon Halo */}
      {isSelected && (
        <mesh
          ref={pulseRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.003, 0]}
        >
          <ringGeometry args={[0.032, 0.042, 32]} />
          <meshBasicMaterial
            color="#38BDF8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.65}
          />
        </mesh>
      )}

      {/* 5. Tooltip Tag (Visible on Hover or for Active Selected Site) */}
      {(isHovered || isSelected) && (
        <Html
          position={[0, 0.12, 0]}
          center
          distanceFactor={8}
          className="pointer-events-none select-none"
        >
          <div
            className={`px-2.5 py-1.5 rounded border text-[11px] font-mono shadow-2xl whitespace-nowrap backdrop-blur-md transition-all ${
              isSelected
                ? 'bg-[#101827]/95 border-[#38BDF8] text-white ring-1 ring-[#38BDF8]/50'
                : 'bg-[#080D18]/95 border-[#263449] text-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSelected ? 'bg-[#38BDF8] animate-pulse' : 'bg-[#FBBF24]'
                }`}
              />
              <span>{site.name}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {Math.abs(site.latitude).toFixed(2)}°S, {site.longitude.toFixed(2)}°E
            </div>
            {!isSelected && isHovered && (
              <div className="text-[9px] text-[#38BDF8] mt-1 font-semibold uppercase tracking-wider">
                Click to Target
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default LandingSiteMarker;
