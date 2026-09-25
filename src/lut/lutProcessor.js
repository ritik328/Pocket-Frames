/**
 * Pocket Frames - High-Performance WebGL2 3D LUT Processor
 * GPU hardware-accelerated trilinear interpolation with CPU fallback
 */

const VS_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FS_3D_SOURCE = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_image;
uniform sampler3D u_lut;
uniform float u_lutSize;
uniform float u_intensity;

void main() {
  vec4 orig = texture(u_image, v_texCoord);
  vec3 clampedRgb = clamp(orig.rgb, 0.0, 1.0);
  
  // Exact half-texel offset for 3D LUT texture sampling
  vec3 lutCoord = (clampedRgb * (u_lutSize - 1.0) + 0.5) / u_lutSize;
  vec3 graded = texture(u_lut, lutCoord).rgb;
  
  fragColor = vec4(mix(orig.rgb, graded, u_intensity), orig.a);
}
`;

class WebGl2LutEngine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false
    });

    this.isSupported = Boolean(this.gl);
    if (!this.isSupported) {
      console.warn('[LutProcessor] WebGL2 not supported on this browser. Falling back to CPU 2D engine.');
      return;
    }

    this.initGL();
  }

  initGL() {
    const gl = this.gl;
    // Compile shaders
    const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_3D_SOURCE);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('[LutProcessor] Program link error:', gl.getProgramInfoLog(this.program));
      this.isSupported = false;
      return;
    }

    // Uniform locations
    this.uImageLoc = gl.getUniformLocation(this.program, 'u_image');
    this.uLutLoc = gl.getUniformLocation(this.program, 'u_lut');
    this.uLutSizeLoc = gl.getUniformLocation(this.program, 'u_lutSize');
    this.uIntensityLoc = gl.getUniformLocation(this.program, 'u_intensity');

    // Quad geometry (standard upright texture mapping)
    // Position: [-1, 1] top-left to [1, -1] bottom-right
    // TexCoords: [0, 0] top-left to [1, 1] bottom-right
    const vertices = new Float32Array([
      // a_pos(x, y), a_tex(u, v)
      -1.0,  1.0,   0.0, 0.0,
      -1.0, -1.0,   0.0, 1.0,
       1.0,  1.0,   1.0, 0.0,
       1.0, -1.0,   1.0, 1.0,
    ]);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(this.program, 'a_position');
    const aTexLoc = gl.getAttribLocation(this.program, 'a_texCoord');

    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);

    gl.enableVertexAttribArray(aTexLoc);
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 16, 8);

    gl.bindVertexArray(null);

    // Textures
    this.imageTexture = gl.createTexture();
    this.lutTexture = gl.createTexture();
    this.cachedLutId = null;
  }

  compileShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[LutProcessor] Shader compile error:', gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  uploadLut(lut) {
    if (this.cachedLutId === lut.id) return;
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);

    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    // Upload 3D texture using Uint8Array for guaranteed browser support
    const size = lut.size;
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA,
      size,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      lut.uint8Rgba
    );

    this.cachedLutId = lut.id;
  }

  render(sourceElement, lut, intensity, targetCanvas = null) {
    const gl = this.gl;
    const width = sourceElement.naturalWidth || sourceElement.width;
    const height = sourceElement.naturalHeight || sourceElement.height;

    const outCanvas = targetCanvas || document.createElement('canvas');
    if (outCanvas.width !== width || outCanvas.height !== height) {
      outCanvas.width = width;
      outCanvas.height = height;
    }

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    // 1. Upload 2D image texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceElement);

    // 2. Upload 3D LUT texture
    this.uploadLut(lut);

    // 3. Set uniforms
    gl.uniform1i(this.uImageLoc, 0);
    gl.uniform1i(this.uLutLoc, 1);
    gl.uniform1f(this.uLutSizeLoc, lut.size);
    gl.uniform1f(this.uIntensityLoc, Math.max(0, Math.min(1, intensity)));

    // 4. Draw quad
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Copy to output 2D canvas
    const ctx = outCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.canvas, 0, 0);

    return outCanvas;
  }
}

/**
 * CPU Fallback Trilinear Interpolation Engine
 */
function renderCpuFallback(sourceElement, lut, intensity, targetCanvas = null) {
  const width = sourceElement.naturalWidth || sourceElement.width;
  const height = sourceElement.naturalHeight || sourceElement.height;

  const canvas = targetCanvas || document.createElement('canvas');
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceElement, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const len = data.length;

  const N = lut.size;
  const N1 = N - 1;
  const table = lut.rgbData;
  const Nsq = N * N;

  const w = Math.max(0, Math.min(1, intensity));
  const invW = 1.0 - w;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const rf = (r / 255) * N1;
    const gf = (g / 255) * N1;
    const bf = (b / 255) * N1;

    const r0 = rf | 0;
    const r1 = r0 < N1 ? r0 + 1 : N1;
    const dr = rf - r0;
    const invDr = 1.0 - dr;

    const g0 = gf | 0;
    const g1 = g0 < N1 ? g0 + 1 : N1;
    const dg = gf - g0;
    const invDg = 1.0 - dg;

    const b0 = bf | 0;
    const b1 = b0 < N1 ? b0 + 1 : N1;
    const db = bf - b0;
    const invDb = 1.0 - db;

    const b0_Nsq = b0 * Nsq;
    const b1_Nsq = b1 * Nsq;
    const g0_N = g0 * N;
    const g1_N = g1 * N;

    const i000 = (r0 + g0_N + b0_Nsq) * 3;
    const i100 = (r1 + g0_N + b0_Nsq) * 3;
    const i010 = (r0 + g1_N + b0_Nsq) * 3;
    const i110 = (r1 + g1_N + b0_Nsq) * 3;
    const i001 = (r0 + g0_N + b1_Nsq) * 3;
    const i101 = (r1 + g0_N + b1_Nsq) * 3;
    const i011 = (r0 + g1_N + b1_Nsq) * 3;
    const i111 = (r1 + g1_N + b1_Nsq) * 3;

    const w000 = invDr * invDg * invDb;
    const w100 = dr    * invDg * invDb;
    const w010 = invDr * dg    * invDb;
    const w110 = dr    * dg    * invDb;
    const w001 = invDr * invDg * db;
    const w101 = dr    * invDg * db;
    const w011 = invDr * dg    * db;
    const w111 = dr    * dg    * db;

    const lutR = (
      table[i000] * w000 + table[i100] * w100 +
      table[i010] * w010 + table[i110] * w110 +
      table[i001] * w001 + table[i101] * w101 +
      table[i011] * w011 + table[i111] * w111
    ) * 255;

    const lutG = (
      table[i000 + 1] * w000 + table[i100 + 1] * w100 +
      table[i010 + 1] * w010 + table[i110 + 1] * w110 +
      table[i001 + 1] * w001 + table[i101 + 1] * w101 +
      table[i011 + 1] * w011 + table[i111 + 1] * w111
    ) * 255;

    const lutB = (
      table[i000 + 2] * w000 + table[i100 + 2] * w100 +
      table[i010 + 2] * w010 + table[i110 + 2] * w110 +
      table[i001 + 2] * w001 + table[i101 + 2] * w101 +
      table[i011 + 2] * w011 + table[i111 + 2] * w111
    ) * 255;

    data[i]     = (r * invW + lutR * w) | 0;
    data[i + 1] = (g * invW + lutG * w) | 0;
    data[i + 2] = (b * invW + lutB * w) | 0;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

let glEngineInstance = null;

function getGlEngine() {
  if (!glEngineInstance) {
    glEngineInstance = new WebGl2LutEngine();
  }
  return glEngineInstance;
}

/**
 * Public LUT Application Function
 * @param {HTMLImageElement|HTMLCanvasElement} sourceElement - Clean source photograph
 * @param {CubeLut} lut - Parsed .cube LUT
 * @param {number} intensity - 0.0 to 1.0 blend
 * @param {HTMLCanvasElement} [targetCanvas] - Optional reuse canvas
 * @returns {HTMLCanvasElement}
 */
export function applyLut(sourceElement, lut, intensity = 1.0, targetCanvas = null) {
  if (!sourceElement || !lut) return sourceElement;

  if (intensity <= 0.0) {
    // Zero intensity = pure pass-through
    const width = sourceElement.naturalWidth || sourceElement.width;
    const height = sourceElement.naturalHeight || sourceElement.height;
    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceElement, 0, 0);
    return canvas;
  }

  const engine = getGlEngine();
  if (engine.isSupported) {
    try {
      return engine.render(sourceElement, lut, intensity, targetCanvas);
    } catch (err) {
      console.warn('[LutProcessor] WebGL2 render failed, attempting CPU fallback:', err);
      return renderCpuFallback(sourceElement, lut, intensity, targetCanvas);
    }
  }

  return renderCpuFallback(sourceElement, lut, intensity, targetCanvas);
}

/**
 * Generate a thumbnail preview for a LUT using a test patch or image
 */
export function generateLutThumbnail(lut, baseImage = null, size = 80) {
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = size;
  thumbCanvas.height = size;
  const ctx = thumbCanvas.getContext('2d');

  if (baseImage) {
    // Downscale base image to thumbnail
    ctx.drawImage(baseImage, 0, 0, size, size);
  } else {
    // Generate a sleek multi-tone gradient swatch showing highlights, skin, and shadows
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#f5e4cb'); // Warm skin highlight
    grad.addColorStop(0.35, '#d69f7e'); // Midtone
    grad.addColorStop(0.7, '#648877'); // Foliage
    grad.addColorStop(1, '#2c3e50'); // Deep shadow
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Apply LUT to thumbnail at 100%
  return applyLut(thumbCanvas, lut, 1.0);
}
