(() => {
  const MAX_SCRIPT_SIZE = 50000;
  const result = {
    canvases: [],
    relatedScripts: [],
    webglInfo: []
  };

  // --- Find all canvas elements ---
  document.querySelectorAll('canvas').forEach((canvas, i) => {
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    const parentSelector = parent
      ? parent.tagName.toLowerCase() + (parent.classList[0] ? '.' + parent.classList[0] : '')
      : 'body';

    const entry = {
      id: 'canvas-' + i,
      width: canvas.width,
      height: canvas.height,
      displayWidth: Math.round(rect.width),
      displayHeight: Math.round(rect.height),
      parentSelector,
      contextType: null,
      styles: {}
    };

    // Detect context type.
    // getContext() returns the existing context if the same type was already acquired,
    // or null if a different type was acquired. It only creates a new context if none
    // exists yet. By extraction time the page is fully rendered, so canvases almost
    // always have their context already acquired — getContext() just returns it.
    // We try webgl2 first (superset of webgl), then webgl, then 2d.
    try {
      if (canvas.getContext('webgl2')) entry.contextType = 'webgl2';
      else if (canvas.getContext('webgl')) entry.contextType = 'webgl';
      else if (canvas.getContext('2d')) entry.contextType = '2d';
      else entry.contextType = 'unknown';
    } catch (e) {
      // Some browsers throw when probing a context type that conflicts with
      // an already-acquired context. This confirms the canvas is active.
      entry.contextType = 'unknown (already acquired)';
    }

    // Get parent styles (positioning context)
    try {
      const cs = getComputedStyle(canvas);
      const pcs = parent ? getComputedStyle(parent) : null;
      entry.styles = {
        position: cs.position !== 'static' ? cs.position : undefined,
        zIndex: cs.zIndex !== 'auto' ? cs.zIndex : undefined,
        opacity: cs.opacity !== '1' ? cs.opacity : undefined,
        pointerEvents: cs.pointerEvents,
        width: cs.width,
        height: cs.height
      };
      if (pcs) {
        entry.parentStyles = {
          position: pcs.position !== 'static' ? pcs.position : undefined,
          width: pcs.width,
          height: pcs.height,
          overflow: pcs.overflow !== 'visible' ? pcs.overflow : undefined
        };
      }
      Object.keys(entry.styles).forEach(k => entry.styles[k] === undefined && delete entry.styles[k]);
      if (entry.parentStyles) {
        Object.keys(entry.parentStyles).forEach(k => entry.parentStyles[k] === undefined && delete entry.parentStyles[k]);
      }
    } catch (e) {}

    // Try to capture a static frame as data URL (for reference)
    try {
      entry.staticFrame = canvas.toDataURL('image/png').substring(0, 200) + '...(truncated)';
    } catch (e) {
      entry.staticFrame = '(CORS or tainted canvas — cannot capture)';
    }

    result.canvases.push(entry);
  });

  // --- Extract WebGL shader source from page scripts ---
  // Look for inline scripts containing shader keywords
  const shaderKeywords = /\b(gl_Position|gl_FragColor|gl_FragCoord|void\s+main\s*\(\s*\)|uniform\s+|varying\s+|attribute\s+|precision\s+highp|#version\s+\d+)\b/;
  const webglKeywords = /\b(createShader|shaderSource|compileShader|createProgram|attachShader|linkProgram|WebGLRenderer|THREE\.Renderer|new\s+Renderer|fragmentShader|vertexShader)\b/;

  document.querySelectorAll('script:not([src])').forEach((script, i) => {
    const text = script.textContent || '';
    if (text.length < 10) return;

    if (shaderKeywords.test(text) || webglKeywords.test(text)) {
      result.relatedScripts.push({
        id: 'inline-script-' + i,
        type: 'inline',
        size: text.length,
        containsShaders: shaderKeywords.test(text),
        containsWebGL: webglKeywords.test(text),
        preview: text.substring(0, 500) + (text.length > 500 ? '...' : '')
      });
    }
  });

  // --- Check external scripts for WebGL/shader content ---
  // We can't read cross-origin script content, but we can list them
  document.querySelectorAll('script[src]').forEach((script, i) => {
    const src = script.src || '';
    // Flag likely WebGL-related scripts by name
    const lowerSrc = src.toLowerCase();
    if (/three|ogl|pixi|babylon|p5|regl|twgl|webgl|shader|gl-matrix|cannon|ammo/.test(lowerSrc)) {
      result.relatedScripts.push({
        id: 'external-script-' + i,
        type: 'external',
        src,
        likelyWebGL: true
      });
    }
  });

  // --- Extract shader strings from JS modules via performance entries ---
  // Check loaded module scripts for WebGL library patterns
  try {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      if (entry.initiatorType === 'script') {
        const name = entry.name.toLowerCase();
        if (/ogl|three|webgl|shader|pixi|babylon/.test(name)) {
          result.relatedScripts.push({
            id: 'module-' + result.relatedScripts.length,
            type: 'module',
            src: entry.name,
            size: entry.transferSize || 'unknown',
            likelyWebGL: true
          });
        }
      }
    }
  } catch (e) {}

  // --- Try to extract shader source from global scope ---
  // Common patterns: window.__SHADERS, exposed shader strings
  const globalShaderPatterns = ['__SHADERS', '_shaders', 'shaderSource', 'vertexShader', 'fragmentShader'];
  for (const key of globalShaderPatterns) {
    try {
      const val = window[key];
      if (val && typeof val === 'string' && val.length > 20 && shaderKeywords.test(val)) {
        result.webglInfo.push({
          source: 'window.' + key,
          type: typeof val,
          size: val.length,
          preview: val.substring(0, 500)
        });
      } else if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          if (typeof v === 'string' && shaderKeywords.test(v)) {
            result.webglInfo.push({
              source: 'window.' + key + '.' + k,
              type: 'string',
              size: v.length,
              preview: v.substring(0, 500)
            });
          }
        }
      }
    } catch (e) {}
  }

  // --- Summary ---
  result.summary = {
    totalCanvases: result.canvases.length,
    webglCanvases: result.canvases.filter(c => c.contextType?.includes('webgl')).length,
    canvas2d: result.canvases.filter(c => c.contextType === '2d').length,
    relatedScriptsFound: result.relatedScripts.length,
    shaderSourcesFound: result.webglInfo.length,
    recommendation: result.canvases.length > 0
      ? 'Canvas elements detected. Run extract-shaders.js to extract GLSL shader source from JS bundles. For production builds, shader source is typically bundled and minified. The WebGL component can be reconstructed using the detected library + extracted shaders + uniform setup.'
      : 'No canvas elements found.'
  };

  return JSON.stringify(result);
})()
