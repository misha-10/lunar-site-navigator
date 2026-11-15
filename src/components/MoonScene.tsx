import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import {
  RotateCcw,
  Compass,
  Eye,
  MapPin,
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { lunarLatLonToVector3 } from '../utils/coordinates';
import { MoonGlobe } from './MoonGlobe';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export interface MoonSceneProps {
  className?: string;
  wireframe?: boolean;
}

export const MoonScene: React.FC<MoonSceneProps> = ({
  className = '',
  wireframe = false,
}) => {
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const [isWireframe, setIsWireframe] = useState<boolean>(wireframe);
  const { selectedSite } = useMission();

  // Default camera configuration facing the tilted lunar South Pole
  const defaultCamera = {
    position: [0, 0, 4.8] as [number, number, number],
    fov: 45,
  };

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleFocusSouthPole = () => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object;
      // World position of South Pole with -1.15 rad tilt: (0, -0.735, +1.643)
      const southPoleDir = new THREE.Vector3(0, -0.735, 1.643).normalize();
      const targetPos = southPoleDir.multiplyScalar(4.6);
      camera.position.copy(targetPos);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleFocusSelectedSite = () => {
    if (controlsRef.current && selectedSite) {
      const camera = controlsRef.current.object;
      // Get base position on sphere (radius 1.8)
      const basePos = lunarLatLonToVector3(
        selectedSite.latitude,
        selectedSite.longitude,
        1.8
      );
      // Apply the Moon group's axial tilt rotation: [-1.15, 0, 0]
      basePos.applyEuler(new THREE.Euler(-1.15, 0, 0));

      // Position camera along the vector facing the landing site
      const camPos = basePos.clone().normalize().multiplyScalar(4.5);
      camera.position.copy(camPos);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[440px] rounded-lg border border-[#263449] bg-[#080D18] overflow-hidden flex flex-col select-none ${className}`}
    >
      {/* Top HUD Overlay Bar */}
      <div className="absolute top-0 inset-x-0 z-10 p-3.5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-[#080D18]/90 via-[#080D18]/40 to-transparent">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
          <div>
            <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
              3D Lunar South Pole Globe
            </h2>
            <p className="text-[10px] font-mono text-slate-400">
              NASA LRO Surface Map • Candidate Landing Sites
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {selectedSite && (
            <Badge variant="cyan" hasDot>
              Target: {selectedSite.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Main 3D WebGL Canvas */}
      <div className="flex-1 w-full h-full relative">
        <Canvas
          camera={{
            position: defaultCamera.position,
            fov: defaultCamera.fov,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          className="w-full h-full"
        >
          {/* Deep Space Background Color */}
          <color attach="background" args={['#080D18']} />

          {/* Distant Space Field Stars */}
          <Stars
            radius={90}
            depth={50}
            count={1400}
            factor={3.5}
            saturation={0}
            fade
            speed={0.5}
          />

          {/* 3D Moon Mesh, Realistic Lighting & Landing Site Markers */}
          <MoonGlobe wireframe={isWireframe} />

          {/* Camera Controls with Sensible Distance Limits */}
          <OrbitControls
            ref={controlsRef}
            enableRotate={true}
            enableZoom={true}
            enablePan={false}
            rotateSpeed={0.8}
            zoomSpeed={0.8}
            enableDamping={true}
            dampingFactor={0.06}
            minDistance={2.4} // Prevent clipping inside sphere (r = 1.8)
            maxDistance={9.5} // Sensible outer limit
          />
        </Canvas>
      </div>

      {/* Bottom Control & Status Overlay Bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 p-3 flex flex-wrap items-center justify-between gap-3 pointer-events-none bg-gradient-to-t from-[#080D18]/95 via-[#080D18]/60 to-transparent">
        {/* Navigation Hint */}
        <div className="pointer-events-auto flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="hidden sm:inline">CONTROLS:</span>
          <span className="px-1.5 py-0.5 rounded bg-[#101827] border border-[#263449] text-slate-300">
            Click Marker to Target
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#101827] border border-[#263449] text-slate-300">
            Drag to Orbit
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#101827] border border-[#263449] text-slate-300 hidden md:inline">
            Scroll to Zoom
          </span>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Focus Selected Target Site */}
          <Button
            size="xs"
            variant="secondary"
            onClick={handleFocusSelectedSite}
            title="Orient camera to center the selected landing site"
          >
            <MapPin className="w-3 h-3 text-[#38BDF8]" />
            <span>Target Site</span>
          </Button>

          {/* Focus South Pole Shortcut */}
          <Button
            size="xs"
            variant="secondary"
            onClick={handleFocusSouthPole}
            title="Orient camera to focus directly on lunar South Pole"
          >
            <Compass className="w-3 h-3 text-[#38BDF8]" />
            <span>South Pole</span>
          </Button>

          {/* Wireframe Toggle */}
          <Button
            size="xs"
            variant={isWireframe ? 'amber' : 'secondary'}
            onClick={() => setIsWireframe(!isWireframe)}
            title="Toggle geometry wireframe"
          >
            <Eye className="w-3 h-3" />
            <span>{isWireframe ? 'Solid' : 'Wireframe'}</span>
          </Button>

          {/* Reset Camera Button */}
          <Button
            size="xs"
            variant="secondary"
            onClick={handleResetCamera}
            title="Reset camera distance and orientation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset View</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MoonScene;
