'use client';

import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface ModelProps {
  isHovered: boolean;
}

function Model({ isHovered }: ModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/3d_model/repaircoin_3d.glb');

  // Auto-rotation animation
  useFrame((_state, delta) => {
    if (groupRef.current) {
      if (isHovered) {
        // Faster rotation on hover
        groupRef.current.rotation.y += delta * 0.8;
      } else {
        // Slow continuous rotation
        groupRef.current.rotation.y += delta * 0.3;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2} />
    </group>
  );
}

function Loader() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ffcc00] to-[#ff9900] animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-[#191919] flex items-center justify-center">
          <span className="text-4xl sm:text-5xl font-bold text-[#ffcc00]">RCN</span>
        </div>
      </div>
    </div>
  );
}

export default function RepairCoin3DModel() {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className="relative h-[350px] lg:h-[500px] w-full flex items-center justify-center overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        style={{ width: '120%', height: '120%' }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />

          {/* 3D Model */}
          <Model isHovered={isHovered} />

          {/* Environment for reflections */}
          <Environment preset="sunset" />

          {/* Optional: Enable user controls */}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={false}
          />
        </Suspense>
      </Canvas>

      {/* Loading fallback shown outside Canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <Suspense fallback={<Loader />}>
          <div style={{ display: 'none' }} />
        </Suspense>
      </div>
    </div>
  );
}

// Preload the 3D model
useGLTF.preload('/3d_model/repaircoin_3d.glb');
