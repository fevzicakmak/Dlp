import * as THREE from 'three';

export class TextureGenerator {
  private static textureCache: Map<string, THREE.CanvasTexture> = new Map();
  private static bumpCache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Generates or retrieves a procedural wood grain texture with rich wood fibers, growth rings, and warm tones.
   */
  public static getWoodTexture(baseColorHex: string, grainDirection: 'length' | 'width' | 'none' = 'length'): THREE.CanvasTexture {
    const key = `wood_${baseColorHex}_${grainDirection}`;
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    const width = 1024;
    const height = 1024;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      return fallback;
    }

    // Parse base color
    const baseColor = new THREE.Color(baseColorHex);
    const r = Math.floor(baseColor.r * 255);
    const g = Math.floor(baseColor.g * 255);
    const b = Math.floor(baseColor.b * 255);

    // Create ImageData for pixel-level procedural wood grain
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const isHorizontal = grainDirection === 'width';
    const frequency = 0.015;
    const ringFrequency = 0.05;

    // Fast pseudo-random noise generator
    const pseudoNoise = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = isHorizontal ? y : x;
        const v = isHorizontal ? x : y;

        // Wood grain wave formula
        const grainWave = Math.sin(u * frequency + Math.sin(v * 0.02) * 8);
        const ring = Math.sin(u * ringFrequency + grainWave * 3 + pseudoNoise(Math.floor(u / 8), Math.floor(v / 8)) * 1.5);
        
        // Micro fibers
        const microFiber = (pseudoNoise(u * 2, v * 0.1) - 0.5) * 0.25;

        // Fiber intensity factor (-1 to 1)
        const factor = ring * 0.2 + microFiber + grainWave * 0.1;

        // Apply shade / highlight to base color
        const shade = factor > 0 ? 1 - factor * 0.25 : 1 - factor * 0.35;
        
        const pr = Math.min(255, Math.max(0, Math.floor(r * shade)));
        const pg = Math.min(255, Math.max(0, Math.floor(g * shade * 0.96)));
        const pb = Math.min(255, Math.max(0, Math.floor(b * shade * 0.92)));

        const idx = (y * width + x) * 4;
        data[idx] = pr;
        data[idx + 1] = pg;
        data[idx + 2] = pb;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Add subtle soft gradient overlay for organic depth
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    this.textureCache.set(key, texture);
    return texture;
  }

  /**
   * Generates a matching bump/normal map for realistic tactile wood grain reflections
   */
  public static getWoodBumpMap(grainDirection: 'length' | 'width' | 'none' = 'length'): THREE.CanvasTexture {
    const key = `bump_${grainDirection}`;
    if (this.bumpCache.has(key)) {
      return this.bumpCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 512;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const isHorizontal = grainDirection === 'width';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = isHorizontal ? y : x;
        const v = isHorizontal ? x : y;
        const grainWave = Math.sin(u * 0.03 + Math.sin(v * 0.02) * 6);
        const ring = Math.sin(u * 0.1 + grainWave * 2);
        const val = Math.floor((ring * 0.5 + 0.5) * 255);

        const idx = (y * width + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const bumpTex = new THREE.CanvasTexture(canvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(1, 1);
    bumpTex.needsUpdate = true;

    this.bumpCache.set(key, bumpTex);
    return bumpTex;
  }
}
