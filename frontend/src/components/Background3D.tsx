import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

function GlassSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    // Slow rotation
    meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    meshRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.05) * 0.1;
  });

  return (
    <mesh ref={meshRef} scale={1.5}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshDistortMaterial
        color="#6366f1"
        distort={0.3}
        speed={1.5}
        roughness={0.1}
        metalness={0.8}
        clearcoat={1}
        clearcoatRoughness={0.1}
        transparent
        opacity={0.15}
      />
    </mesh>
  );
}

function FloatingParticles() {
  const groupRef = useRef<THREE.Group>(null);
  const particles = Array.from({ length: 20 }, (_) => ({
    position: [
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4,
    ] as [number, number, number],
    size: Math.random() * 0.05 + 0.02,
    speed: Math.random() * 0.5 + 0.5,
    color: Math.random() > 0.5 ? "#6366f1" : "#06b6d4",
  }));

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.02;
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <Float key={i} speed={p.speed} rotationIntensity={0.5} floatIntensity={1}>
          <mesh position={p.position}>
            <sphereGeometry args={[p.size, 16, 16]} />
            <meshBasicMaterial color={p.color} transparent opacity={0.3} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export const Background3D = () => {
  return (
    <div className="fixed inset-0 z-0 bg-[#06060c] pointer-events-none">
      <div className="absolute inset-0 bg-radial-[circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%]" />
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#06b6d4" />
          <GlassSphere />
          <FloatingParticles />
        </Suspense>
      </Canvas>
    </div>
  );
};
