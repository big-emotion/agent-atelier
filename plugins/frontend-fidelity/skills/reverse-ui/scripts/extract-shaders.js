(async () => {
  const MAX_BUNDLE_SIZE = 5000000; // 5MB max per bundle
  const CONTEXT_CHARS = 300; // chars before/after shader for context

  const result = {
    shaders: [],
    inaccessibleBundles: [],
    libraries: []
  };

  // GLSL detection patterns
  const GLSL_MARKERS = /\b(gl_Position|gl_FragColor|gl_FragCoord|gl_PointSize)\b/;
  const GLSL_KEYWORDS = /\b(precision\s+(highp|mediump|lowp)|uniform\s+\w+|varying\s+\w+|attribute\s+\w+|void\s+main\s*\(\s*\))/;
  const WEBGL_LIBS = /\b(three|ogl|pixi|babylon|regl|twgl|p5)\b/i;

  // --- Step 1: Find all JS bundles loaded by the page ---

  const scriptUrls = new Set();
  const origin = location.origin;

  // From performance entries
  try {
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.initiatorType === 'script' || (entry.name.endsWith('.js') || entry.name.includes('.js?'))) {
        scriptUrls.add(entry.name);
      }
    }
  } catch (e) {}

  // From script tags
  document.querySelectorAll('script[src]').forEach(s => {
    if (s.src) scriptUrls.add(s.src);
  });

  // Also check module preloads
  document.querySelectorAll('link[rel="modulepreload"]').forEach(l => {
    if (l.href) scriptUrls.add(l.href);
  });

  // Detect libraries from URLs
  for (const url of scriptUrls) {
    const match = url.toLowerCase().match(WEBGL_LIBS);
    if (match) {
      result.libraries.push({ name: match[1], url });
    }
  }

  // --- Step 2: Fetch same-origin bundles and search for shaders ---

  for (const url of scriptUrls) {
    // Only fetch same-origin scripts (CORS restriction)
    if (!url.startsWith(origin) && !url.startsWith('/')) {
      // Check if it's a WebGL-related bundle worth noting
      if (WEBGL_LIBS.test(url)) {
        result.inaccessibleBundles.push({ url, reason: 'cross-origin' });
      }
      continue;
    }

    let text;
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const contentLength = parseInt(resp.headers.get('content-length') || '0');
      if (contentLength > MAX_BUNDLE_SIZE) {
        result.inaccessibleBundles.push({ url, reason: 'too large (' + contentLength + ' bytes)' });
        continue;
      }
      text = await resp.text();
      if (text.length > MAX_BUNDLE_SIZE) {
        text = text.substring(0, MAX_BUNDLE_SIZE);
      }
    } catch (e) {
      result.inaccessibleBundles.push({ url, reason: e.message });
      continue;
    }

    // Skip if no GLSL markers at all
    if (!GLSL_MARKERS.test(text) && !GLSL_KEYWORDS.test(text)) continue;

    // --- Step 3: Extract shader strings ---

    // Strategy: find backtick-delimited strings containing GLSL
    const backtickRegex = /`([\s\S]*?)`/g;
    let match;
    while ((match = backtickRegex.exec(text)) !== null) {
      const candidate = match[1];
      if (candidate.length < 20 || candidate.length > 20000) continue;
      if (!GLSL_MARKERS.test(candidate) && !GLSL_KEYWORDS.test(candidate)) continue;

      // Classify shader type
      let type = 'unknown';
      if (/gl_Position/.test(candidate)) type = 'vertex';
      if (/gl_FragColor|gl_FragCoord|fragColor/.test(candidate)) type = 'fragment';

      // Extract uniforms from the shader source
      const uniforms = [];
      const uniformRegex = /uniform\s+(\w+)\s+(\w+)/g;
      let uMatch;
      while ((uMatch = uniformRegex.exec(candidate)) !== null) {
        uniforms.push({ type: uMatch[1], name: uMatch[2] });
      }

      // Get surrounding context for uniform setup
      const shaderStart = match.index;
      const contextBefore = text.substring(Math.max(0, shaderStart - CONTEXT_CHARS), shaderStart);
      const contextAfter = text.substring(shaderStart + match[0].length, shaderStart + match[0].length + CONTEXT_CHARS);

      // Try to find variable name assigned to this shader
      const varNameMatch = contextBefore.match(/(?:const|let|var)\s+(\w+)\s*=\s*$/);
      const varName = varNameMatch ? varNameMatch[1] : undefined;

      result.shaders.push({
        type,
        varName,
        source: candidate.trim(),
        uniforms,
        bundleUrl: url,
        contextBefore: contextBefore.trim(),
        contextAfter: contextAfter.trim()
      });
    }

    // Also try single/double quoted strings (less common for shaders, but possible in minified code)
    // Only if we haven't found any shaders via backticks
    if (result.shaders.length === 0) {
      const quotedRegex = /(["'])((?:[^"'\\]|\\[\s\S]){50,}?)\1/g;
      while ((match = quotedRegex.exec(text)) !== null) {
        const candidate = match[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        if (!GLSL_MARKERS.test(candidate) && !GLSL_KEYWORDS.test(candidate)) continue;

        let type = 'unknown';
        if (/gl_Position/.test(candidate)) type = 'vertex';
        if (/gl_FragColor|gl_FragCoord|fragColor/.test(candidate)) type = 'fragment';

        const uniforms = [];
        const uniformRegex = /uniform\s+(\w+)\s+(\w+)/g;
        let uMatch;
        while ((uMatch = uniformRegex.exec(candidate)) !== null) {
          uniforms.push({ type: uMatch[1], name: uMatch[2] });
        }

        result.shaders.push({
          type,
          source: candidate.trim(),
          uniforms,
          bundleUrl: url,
          note: 'extracted from quoted string (possibly minified)'
        });
      }
    }

    // --- Step 4: Extract uniform setup blocks near shader usage ---

    // Look for OGL/Three.js uniform configuration patterns
    const uniformBlockRegex = /uniforms\s*:\s*\{([\s\S]{10,2000}?)\}/g;
    while ((match = uniformBlockRegex.exec(text)) !== null) {
      const block = match[1];
      // Only include if it contains value assignments
      if (/value\s*:/.test(block)) {
        // Check if this block is near one of our extracted shaders (within 5000 chars)
        const blockPos = match.index;
        const isNearShader = result.shaders.some(s => {
          const shaderPos = text.indexOf(s.source.substring(0, 50));
          return shaderPos >= 0 && Math.abs(shaderPos - blockPos) < 5000;
        });

        if (isNearShader) {
          // Parse individual uniform entries
          const entries = [];
          const entryRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^}]+)\}/g;
          let eMatch;
          while ((eMatch = entryRegex.exec(block)) !== null) {
            entries.push({
              name: eMatch[1],
              defaultValue: eMatch[2].trim()
            });
          }

          if (entries.length > 0) {
            // Attach to the nearest shader
            for (const shader of result.shaders) {
              if (!shader.uniformSetup) {
                shader.uniformSetup = entries;
                break;
              }
            }
          }
        }
      }
    }
  }

  // --- Summary ---
  result.summary = {
    totalShaders: result.shaders.length,
    vertexShaders: result.shaders.filter(s => s.type === 'vertex').length,
    fragmentShaders: result.shaders.filter(s => s.type === 'fragment').length,
    librariesDetected: result.libraries.map(l => l.name),
    bundlesSearched: scriptUrls.size,
    inaccessible: result.inaccessibleBundles.length
  };

  return JSON.stringify(result);
})()
