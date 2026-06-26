# Particle Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, dimmed Three.js particle background to all interior pages by extracting the hero's WovenCanvas into a reusable `ParticleBackground` component and mounting it in `AppShell`.

**Architecture:** Create `components/shared/ParticleBackground.tsx` — a lightweight clone of the hero's `WovenCanvas` with 15k particles, `opacity: 0.18`, `pointer-events: none`, and `position: fixed`. Mount it in `AppShell` before `<Nav />` in the non-hero branch. The hero's original `WovenCanvas` stays untouched.

**Tech Stack:** Next.js 14 App Router, Three.js, React, TypeScript, Framer Motion (already installed)

---

## File Map

| File | Change |
|------|--------|
| `components/shared/ParticleBackground.tsx` | **Create** — Three.js canvas, 15k particles, fixed, dimmed |
| `components/shared/AppShell.tsx` | **Modify** — add `<ParticleBackground />` to non-hero branch |

---

### Task 1: Create ParticleBackground component

**Files:**
- Create: `components/shared/ParticleBackground.tsx`

> No dedicated unit test: Three.js canvas components require WebGL which is unavailable in jsdom. Verification is a successful `next build` (no TS errors) + visual check in the browser.

- [ ] **Step 1: Create the file**

Create `components/shared/ParticleBackground.tsx` with this exact content:

```tsx
'use client'

import { useRef, useEffect } from 'react'
import * as THREE from 'three'

export function ParticleBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 5
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountRef.current.appendChild(renderer.domElement)

    const mouse = new THREE.Vector2(0, 0)
    const clock = new THREE.Clock()

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

    const particleCount = 15000
    const positions = new Float32Array(particleCount * 3)
    const originalPositions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)

    const geometry = new THREE.BufferGeometry()
    const torusKnot = new THREE.TorusKnotGeometry(1.5, 0.5, 200, 32)

    for (let i = 0; i < particleCount; i++) {
      const vertexIndex = i % torusKnot.attributes.position.count
      const x = torusKnot.attributes.position.getX(vertexIndex)
      const y = torusKnot.attributes.position.getY(vertexIndex)
      const z = torusKnot.attributes.position.getZ(vertexIndex)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z

      const color = new THREE.Color()
      color.setHSL(Math.random(), 0.8, isDarkMode ? 0.5 : 0.7)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      blending: isDarkMode ? THREE.NormalBlending : THREE.AdditiveBlending,
      transparent: true,
      opacity: isDarkMode ? 1.0 : 0.8,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      const mouseWorld = new THREE.Vector3(mouse.x * 3, mouse.y * 3, 0)

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3
        const iy = i * 3 + 1
        const iz = i * 3 + 2

        const currentPos = new THREE.Vector3(positions[ix], positions[iy], positions[iz])
        const originalPos = new THREE.Vector3(originalPositions[ix], originalPositions[iy], originalPositions[iz])
        const velocity = new THREE.Vector3(velocities[ix], velocities[iy], velocities[iz])

        const dist = currentPos.distanceTo(mouseWorld)
        if (dist < 1.0) {
          const force = (1.0 - dist) * 0.01
          const direction = new THREE.Vector3().subVectors(currentPos, mouseWorld).normalize()
          velocity.add(direction.multiplyScalar(force))
        }

        const returnForce = new THREE.Vector3().subVectors(originalPos, currentPos).multiplyScalar(0.001)
        velocity.add(returnForce)
        velocity.multiplyScalar(0.95)

        positions[ix] += velocity.x
        positions[iy] += velocity.y
        positions[iz] += velocity.z

        velocities[ix] = velocity.x
        velocities[iy] = velocity.y
        velocities[iz] = velocity.z
      }
      geometry.attributes.position.needsUpdate = true

      points.rotation.y = elapsedTime * 0.05
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    const mountNode = mountRef.current
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      if (mountNode) mountNode.removeChild(renderer.domElement)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        opacity: 0.18,
        pointerEvents: 'none',
      }}
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/theoneandonly/Suhaib && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add components/shared/ParticleBackground.tsx
git commit -m "feat: add ParticleBackground component (15k particles, fixed, dimmed)"
```

---

### Task 2: Mount ParticleBackground in AppShell

**Files:**
- Modify: `components/shared/AppShell.tsx`

Current non-hero branch (lines 13–29):
```tsx
return (
  <>
    <Nav />
    <motion.main ...>
      {children}
    </motion.main>
  </>
)
```

Target:
```tsx
return (
  <>
    <ParticleBackground />
    <Nav />
    <motion.main ...>
      {children}
    </motion.main>
  </>
)
```

- [ ] **Step 1: Add import to AppShell**

In `components/shared/AppShell.tsx`, add the import after the existing imports:

```tsx
import { ParticleBackground } from './ParticleBackground'
```

- [ ] **Step 2: Add `<ParticleBackground />` to the non-hero return**

Replace the `<>` return block so `<ParticleBackground />` is the first child:

```tsx
return (
  <>
    <ParticleBackground />
    <Nav />
    <motion.main
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-screen-2xl mx-auto px-4 py-6"
      style={{
        background: 'radial-gradient(ellipse at top left, rgba(56,189,248,0.04) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(167,139,250,0.04) 0%, transparent 60%)',
      }}
    >
      {children}
    </motion.main>
  </>
)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/theoneandonly/Suhaib && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Start dev server and do a visual check**

```bash
cd /Users/theoneandonly/Suhaib && npm run dev
```

Navigate to `http://localhost:3000/dashboard` — you should see the particle TorusKnot shape slowly rotating in the background, dimmed behind the dashboard content. Navigate to other pages (Optimize, Alerts, etc.) — particles should persist without re-initializing (fixed position canvas stays in DOM as routes change). Navigate to `/` — particles should NOT appear (hero has its own WovenCanvas).

- [ ] **Step 5: Commit**

```bash
git add components/shared/AppShell.tsx
git commit -m "feat: mount ParticleBackground in AppShell for all interior pages"
```
