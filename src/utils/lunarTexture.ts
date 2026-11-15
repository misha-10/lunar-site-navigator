import * as THREE from 'three';

/**
 * Generates a clean, subtle procedural lunar surface texture
 * used as an immediate fallback if no external texture file is loaded.
 */
export function createProceduralLunarTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Base lunar surface tone
  ctx.fillStyle = '#8c9298';
  ctx.fillRect(0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let seed = 12345;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Multi-frequency surface regolith roughness
      const noise1 = (rand() - 0.5) * 22;
      const noise2 = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 12;

      // Slight latitude modulation
      const latNorm = Math.abs(y / height - 0.5) * 2;
      const polarBrightening = latNorm > 0.65 ? (latNorm - 0.65) * 25 : 0;

      const val = Math.max(0, Math.min(255, 140 + noise1 + noise2 + polarBrightening));

      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
