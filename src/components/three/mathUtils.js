import * as THREE from 'three'

/**
 * Converts geographical latitude and longitude to 3D Cartesian coordinates on a sphere.
 * Three.js standard coordinate system: Y is up, Z is toward the viewer, X is right.
 * Perfectly aligns with standard equirectangular textures on SphereGeometry.
 *
 * @param {number} lat - Latitude in degrees (-90 to 90)
 * @param {number} lon - Longitude in degrees (-180 to 180)
 * @param {number} radius - Radius of the sphere
 * @returns {THREE.Vector3}
 */
export function latLonToVector3(lat, lon, radius = 2.0) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)

  return new THREE.Vector3(x, y, z)
}

/**
 * Creates an elevated 3D Catmull-Rom spline curve between two points on the sphere.
 * The curve arcs above the surface based on the angular distance between points,
 * ensuring short regional connections stay close to the surface while long
 * intercontinental links arc gracefully without penetrating the globe.
 *
 * @param {THREE.Vector3} p1 - Start point on sphere surface
 * @param {THREE.Vector3} p2 - End point on sphere surface
 * @param {number} globeRadius - Base radius of the globe
 * @param {number} numPoints - Interpolation sample count
 * @returns {THREE.CatmullRomCurve3}
 */
export function createArcSpline(p1, p2, globeRadius = 2.0, numPoints = 60) {
  const distance = p1.distanceTo(p2)
  // Arc elevation: proportional to chord distance, clamped between 0.04 (short regional) and 0.55 (intercontinental)
  const maxElevation = Math.min(Math.max(distance * 0.18, 0.04), 0.55)

  // Midpoint elevated above surface
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
  const midLength = mid.length()

  if (midLength > 0.0001) {
    mid.normalize().multiplyScalar(globeRadius + maxElevation)
  } else {
    // Antipodal fallback
    const normal = new THREE.Vector3(0, 1, 0).cross(p1).normalize()
    mid.copy(normal).multiplyScalar(globeRadius + maxElevation)
  }

  // 1/4 and 3/4 control points for smooth trajectory
  const q1 = new THREE.Vector3().addVectors(p1, mid).multiplyScalar(0.5)
  q1.normalize().multiplyScalar(globeRadius + maxElevation * 0.72)

  const q2 = new THREE.Vector3().addVectors(mid, p2).multiplyScalar(0.5)
  q2.normalize().multiplyScalar(globeRadius + maxElevation * 0.72)

  return new THREE.CatmullRomCurve3([p1, q1, mid, q2, p2])
}

/**
 * Calculates the exact camera distance needed to fit the Earth and all its elevated arcs
 * with balanced, elegant breathing room across any aspect ratio (wide desktop, laptop, mobile).
 *
 * @param {number} aspect - Canvas aspect ratio (width / height)
 * @param {number} fovDegrees - Vertical field of view in degrees (default 42)
 * @param {number} boundingRadius - Total radius of globe + highest arcs + atmosphere
 * @param {number} paddingFactor - Margin factor (default 1.16)
 * @returns {number}
 */
export function calculateCameraDistance(aspect, fovDegrees = 42, boundingRadius = 2.75, paddingFactor = 1.16) {
  const verticalHalfFov = (fovDegrees * Math.PI) / 360
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect)

  const distV = (boundingRadius * paddingFactor) / Math.sin(verticalHalfFov)
  const distH = (boundingRadius * paddingFactor) / Math.sin(horizontalHalfFov)

  return Math.max(distV, distH)
}

/**
 * Creates a sparse, elegant 3D starfield for the cosmos background inside the globe viewport.
 *
 * @param {number} count - Number of star particles
 * @param {number} radius - Sphere radius for star placement
 * @returns {THREE.Points}
 */

export function createStarfield(count = 800, radius = 35) {
  // Circular blurred star texture so stars render as soft, round, luminous pinpricks
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.35, 'rgba(210, 240, 255, 0.75)')
  grad.addColorStop(1, 'rgba(10, 20, 40, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 16, 16)
  const starTexture = new THREE.CanvasTexture(canvas)

  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = radius * (0.85 + Math.random() * 0.3)

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

    const colorType = Math.random()
    if (colorType > 0.82) {
      colors[i * 3] = 0.55; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1.0 // cyan tint
    } else if (colorType > 0.68) {
      colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.78; colors[i * 3 + 2] = 1.0 // violet tint
    } else {
      const b = 0.7 + Math.random() * 0.3
      colors[i * 3] = b; colors[i * 3 + 1] = b; colors[i * 3 + 2] = b // white
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 0.38,
    map: starTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  return new THREE.Points(geometry, material)
}

/**
 * Creates a custom photorealistic Earth shader material combining daytime NASA Blue Marble
 * imagery with night-side golden city lights and atmospheric fresnel rim lighting.
 *
 * @param {THREE.Texture} dayTexture - High-resolution daylight Earth texture
 * @param {THREE.Texture} nightTexture - Night city lights texture
 * @param {THREE.Vector3} sunDirection - World-space direction of solar illumination
 * @returns {THREE.ShaderMaterial}
 */
export function createEarthShaderMaterial(dayTexture, nightTexture, sunDirection = new THREE.Vector3(3.5, 2.5, 4.5)) {
  const normalizedSun = sunDirection.clone().normalize()

  return new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunDirection: { value: normalizedSun },
      rimColor: { value: new THREE.Color(0x25d9f8) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      uniform vec3 rimColor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 worldNormal = normalize(vNormal);
        float NdotL = dot(worldNormal, normalize(sunDirection));

        // Smooth transition across twilight terminator
        float dayFactor = smoothstep(-0.10, 0.25, NdotL);

        vec4 daySample = texture2D(dayTexture, vUv);
        vec4 nightSample = texture2D(nightTexture, vUv);

        // Daylight: rich natural diffuse shading
        float diffuse = clamp(NdotL, 0.0, 1.0) * 0.80 + 0.35;
        vec3 daySide = daySample.rgb * diffuse;

        // Night side: deep oceanic blue base (preserves visible topography) + warm golden city lights
        vec3 nightOcean = daySample.rgb * vec3(0.18, 0.25, 0.38);
        vec3 cityLights = nightSample.rgb * vec3(1.4, 1.15, 0.7) * 2.2;
        vec3 nightSide = nightOcean + cityLights;

        vec3 finalColor = mix(nightSide, daySide, dayFactor);

        // Atmospheric limb glow (fresnel)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(worldNormal, viewDir), 0.0), 3.0);
        finalColor += rimColor * fresnel * 0.60;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  })
}

/**
 * Outer atmospheric Fresnel glow shell.
 *
 * @returns {THREE.ShaderMaterial}
 */
export function createAtmosphereShaderMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
        gl_FragColor = vec4(0.145, 0.85, 0.97, 1.0) * intensity * 0.85;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  })
}

/**
 * Generates an ultra-crisp procedural Earth dark-navy canvas texture with continental land contours.
 * Serves as an infallible offline/fallback texture.
 *
 * @returns {THREE.CanvasTexture}
 */
export function createProceduralEarthTexture() {
  const width = 2048
  const height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // 1. Deep ocean background
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height)
  oceanGrad.addColorStop(0, '#070E1A')
  oceanGrad.addColorStop(0.5, '#0A1526')
  oceanGrad.addColorStop(1, '#070E1A')
  ctx.fillStyle = oceanGrad
  ctx.fillRect(0, 0, width, height)

  // 2. Latitude and Longitude subtle coordinate lines
  ctx.strokeStyle = 'rgba(34, 48, 72, 0.45)'
  ctx.lineWidth = 1

  // Parallels (Latitudes)
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Meridians (Longitudes)
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Equator emphasis
  ctx.strokeStyle = 'rgba(37, 217, 248, 0.25)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()

  // 3. Procedural simplified continental masses
  const landmasses = [
    { x1: -165, x2: -55, y1: 15, y2: 72 }, // North America
    { x1: -85, x2: -35, y1: -55, y2: 12 }, // South America
    { x1: -10, x2: 40, y1: 36, y2: 71 },   // Europe
    { x1: -18, x2: 52, y1: -35, y2: 37 },  // Africa
    { x1: 40, x2: 145, y1: 5, y2: 75 },   // Asia
    { x1: 68, x2: 90, y1: 8, y2: 34 },    // India
    { x1: 95, x2: 140, y1: -10, y2: 25 }, // Southeast Asia
    { x1: 112, x2: 178, y1: -45, y2: -11 }, // Australia & NZ
    { x1: 125, x2: 146, y1: 30, y2: 45 }, // Japan & Korea
  ]

  ctx.fillStyle = '#18263D'
  const step = 8
  for (let y = 0; y < height; y += step) {
    const lat = 90 - (y / height) * 180
    for (let x = 0; x < width; x += step) {
      const lon = (x / width) * 360 - 180

      let isLand = false
      for (const m of landmasses) {
        if (lon >= m.x1 && lon <= m.x2 && lat >= m.y1 && lat <= m.y2) {
          const noise = Math.sin(lon * 0.1) * Math.cos(lat * 0.1) + Math.sin(lon * 0.04)
          if (noise > -0.55) {
            isLand = true
            break
          }
        }
      }

      if (isLand) {
        ctx.fillStyle = 'rgba(28, 44, 69, 0.85)'
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}
