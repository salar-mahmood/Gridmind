"use client";

import React, { useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import * as THREE from 'three';

// --- Main Hero Component ---
export const WovenLightHero = () => {
  const textControls = useAnimation();
  const buttonControls = useAnimation();

  useEffect(() => {
    textControls.start(i => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1 + 1.5,
        duration: 1.2,
        ease: [0.2, 0.65, 0.3, 0.9]
      }
    }));
    buttonControls.start({
        opacity: 1,
        transition: { delay: 2.5, duration: 1 }
    });

  }, [textControls, buttonControls]);

  const headline = "GridMind";

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black dark:bg-white">
      <WovenCanvas />
      <HeroNav />
      <div className="relative z-10 text-center px-4">
        <h1 className="text-6xl md:text-8xl text-white dark:text-slate-900" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 0 50px rgba(255, 255, 255, 0.3)' }}>
            {headline.split(" ").map((word, i) => (
                <span key={i} className="inline-block">
                    {word.split("").map((char, j) => (
                        <motion.span key={j} custom={i * 5 + j} initial={{ opacity: 0, y: 50 }} animate={textControls} style={{ display: 'inline-block' }}>
                            {char}
                        </motion.span>
                    ))}
                    {i < headline.split(" ").length - 1 && <span>&nbsp;</span>}
                </span>
            ))}
        </h1>
        <motion.p
          custom={headline.length}
          initial={{ opacity: 0, y: 30 }}
          animate={textControls}
          className="mx-auto mt-6 max-w-xl text-lg text-slate-300 dark:text-slate-600"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          An interactive tapestry of light and motion, crafted with code and creativity.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={buttonControls} className="mt-10">
          <a href="/dashboard" className="inline-block rounded-full border-2 border-white/20 bg-white/10 px-8 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 dark:border-slate-800/20 dark:bg-slate-800/5 dark:text-slate-800 dark:hover:bg-slate-800/10 cursor-pointer" style={{ fontFamily: "'Inter', sans-serif" }}>
            Open Dashboard
          </a>
        </motion.div>
      </div>
    </div>
  );
};

// --- Navigation Component ---
const HeroNav = () => {
    return (
        <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1, duration: 1 } }}
            className="absolute top-0 left-0 right-0 z-20 p-6"
        >
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white dark:text-slate-800">⎎</span>
                    <span className="text-xl font-bold text-white dark:text-slate-800" style={{ fontFamily: "'Inter', sans-serif" }}>Woven</span>
                </div>
            </div>
        </motion.nav>
    );
};

// --- Three.js Canvas Component ---
const WovenCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // --- Scanlines ---
    const numLines = 45;
    const particlesPerLine = 120;
    const particleCount = numLines * particlesPerLine;
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const geometry = new THREE.BufferGeometry();

    for (let line = 0; line < numLines; line++) {
        const y = -2.3 + (line / (numLines - 1)) * 4.6;
        for (let p = 0; p < particlesPerLine; p++) {
            const i = line * particlesPerLine + p;
            const x = -4.5 + (p / (particlesPerLine - 1)) * 9.0;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = 0;
            originalPositions[i * 3] = x;
            originalPositions[i * 3 + 1] = y;
            originalPositions[i * 3 + 2] = 0;

            const color = new THREE.Color();
            color.setHSL(0, 0, 0.55);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = 0;
            velocities[i * 3 + 2] = 0;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.01,
        vertexColors: true,
        blending: isDarkMode ? THREE.NormalBlending : THREE.AdditiveBlending,
        transparent: true,
        opacity: isDarkMode ? 1.0 : 0.8,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const handleMouseMove = (event: MouseEvent) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animationId: number;
    const animate = () => {
        animationId = requestAnimationFrame(animate);

        const mouseWorld = new THREE.Vector3(mouse.x * 3, mouse.y * 3, 0);

        for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            const currentPos = new THREE.Vector3(positions[ix], positions[iy], positions[iz]);
            const originalPos = new THREE.Vector3(originalPositions[ix], originalPositions[iy], originalPositions[iz]);
            const velocity = new THREE.Vector3(velocities[ix], velocities[iy], velocities[iz]);

            const dist2d = Math.sqrt(
                (positions[ix] - mouseWorld.x) ** 2 +
                (positions[iy] - mouseWorld.y) ** 2
            );
            if (dist2d < 0.18) {
                const force = (0.18 - dist2d) * 0.02;
                velocity.z += force;
            }

            // Return to original position
            const returnForce = new THREE.Vector3().subVectors(originalPos, currentPos).multiplyScalar(0.001);
            velocity.add(returnForce);

            // Damping
            velocity.multiplyScalar(0.95);

            positions[ix] += velocity.x;
            positions[iy] += velocity.y;
            positions[iz] += velocity.z;

            velocities[ix] = velocity.x;
            velocities[iy] = velocity.y;
            velocities[iz] = velocity.z;
        }
        geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const mountNode = mountRef.current;
    return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        if (mountNode) mountNode.removeChild(renderer.domElement);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};
