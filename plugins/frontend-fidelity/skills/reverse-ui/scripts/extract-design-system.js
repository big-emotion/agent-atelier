(() => {
  const MAX_ELEMENTS = 500;
  const MAX_COLORS = 200;
  const MAX_COMPONENTS = 50;
  const MAX_ANIMATIONS = 100;
  const MAX_STATES = 100;

  const result = {
    meta: {
      url: location.href,
      title: document.title,
      extractedAt: new Date().toISOString(),
      inaccessibleStylesheets: [],
      totalElementsSampled: 0
    },
    colors: {
      cssCustomProperties: [],
      backgroundColors: [],
      textColors: [],
      borderColors: [],
      gradients: [],
      _truncated: false
    },
    typography: {
      fontFaces: [],
      fontFamiliesUsed: [],
      fontSizeScale: [],
      fontWeights: [],
      lineHeights: [],
      letterSpacings: [],
      detectedScaleRatio: null
    },
    spacing: {
      values: [],
      baseUnit: null,
      gaps: []
    },
    borders: {
      widths: [],
      styles: [],
      radii: []
    },
    shadows: {
      boxShadows: [],
      textShadows: [],
      dropShadows: []
    },
    animations: {
      keyframes: [],
      transitions: [],
      durations: [],
      easings: [],
      _truncated: false
    },
    breakpoints: {
      mediaQueries: [],
      widths: []
    },
    zIndex: {
      values: [],
      max: 0
    },
    components: [],
    layout: {
      gridPatterns: [],
      flexPatterns: [],
      containerWidths: []
    },
    icons: {
      inlineSvgCount: 0,
      svgSizes: [],
      iconFonts: []
    },
    states: {
      hover: [],
      focus: [],
      active: [],
      disabled: [],
      _truncated: false
    }
  };

  // --- Helpers ---

  function normalizeColor(val) {
    if (!val || val === 'transparent' || val === 'rgba(0, 0, 0, 0)' || val === 'initial' || val === 'inherit') return null;
    return val.trim();
  }

  function isColorValue(val) {
    if (!val) return false;
    return /^(#|rgb|hsl|oklch|oklab|lch|lab|color\(|hwb)/.test(val.trim()) ||
      /^(red|blue|green|black|white|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta|navy|teal|olive|maroon|aqua|lime|fuchsia|silver)$/i.test(val.trim());
  }

  function parsePxValue(val) {
    if (!val) return null;
    const match = val.match(/^([\d.]+)px$/);
    return match ? parseFloat(match[1]) : null;
  }

  function gcd(a, b) {
    a = Math.round(a);
    b = Math.round(b);
    if (b === 0) return a;
    return gcd(b, a % b);
  }

  function findBaseUnit(values) {
    const pxValues = values.map(parsePxValue).filter(v => v !== null && v > 0);
    if (pxValues.length < 3) return null;
    let base = pxValues[0];
    for (let i = 1; i < pxValues.length; i++) {
      base = gcd(base, pxValues[i]);
      if (base <= 1) return null;
    }
    return base >= 2 ? base + 'px' : null;
  }

  function detectScaleRatio(sizes) {
    const px = sizes.map(parsePxValue).filter(v => v !== null && v > 0).sort((a, b) => a - b);
    if (px.length < 4) return null;
    const ratios = [];
    for (let i = 1; i < px.length; i++) {
      ratios.push(px[i] / px[i - 1]);
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const variance = ratios.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ratios.length;
    if (variance > 0.05) return null;
    const known = [
      { name: 'minor second', ratio: 1.067 },
      { name: 'major second', ratio: 1.125 },
      { name: 'minor third', ratio: 1.2 },
      { name: 'major third', ratio: 1.25 },
      { name: 'perfect fourth', ratio: 1.333 },
      { name: 'augmented fourth', ratio: 1.414 },
      { name: 'perfect fifth', ratio: 1.5 },
      { name: 'golden ratio', ratio: 1.618 }
    ];
    const match = known.find(k => Math.abs(k.ratio - avg) < 0.05);
    return match ? `${avg.toFixed(3)} (${match.name})` : `${avg.toFixed(3)} (custom)`;
  }

  // --- Sample elements ---

  function sampleElements() {
    const all = document.querySelectorAll('*');
    if (all.length <= MAX_ELEMENTS) return Array.from(all);
    const seen = new Set();
    const sampled = [];
    for (const el of all) {
      const key = el.tagName + '.' + Array.from(el.classList).sort().join('.');
      if (!seen.has(key)) {
        seen.add(key);
        sampled.push(el);
        if (sampled.length >= MAX_ELEMENTS) break;
      }
    }
    return sampled;
  }

  // --- Traverse shadow DOM ---

  function collectAllElements() {
    const elements = sampleElements();
    // Also traverse open shadow roots
    const queue = [document.body];
    const shadowElements = [];
    while (queue.length > 0 && shadowElements.length < 100) {
      const node = queue.shift();
      if (!node) continue;
      if (node.shadowRoot) {
        const shadowChildren = node.shadowRoot.querySelectorAll('*');
        for (const child of shadowChildren) {
          shadowElements.push(child);
          queue.push(child);
        }
      }
      for (const child of (node.children || [])) {
        queue.push(child);
      }
    }
    return elements.concat(shadowElements.slice(0, 100));
  }

  // --- Extract from stylesheets ---

  function extractFromStylesheets() {
    const cssVars = new Map();
    const keyframes = [];
    const mediaQueries = new Map();
    const stateRules = { hover: [], focus: [], active: [], disabled: [] };
    const animationUsageMap = new Map();
    const transitionMap = new Map();
    const fontFaceMap = new Map();

    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules || sheet.rules;
      } catch (e) {
        result.meta.inaccessibleStylesheets.push(sheet.href || '(inline, cross-origin)');
        continue;
      }
      if (!rules) continue;

      processRules(rules, cssVars, keyframes, mediaQueries, stateRules, animationUsageMap, transitionMap, fontFaceMap);
    }

    // Merge usedBy into keyframes
    for (const kf of keyframes) {
      const usedBy = animationUsageMap.get(kf.name);
      if (usedBy) kf.usedBy = usedBy;
    }

    // CSS custom properties
    for (const [name, data] of cssVars) {
      if (result.colors.cssCustomProperties.length >= MAX_COLORS) {
        result.colors._truncated = true;
        break;
      }
      result.colors.cssCustomProperties.push({ name, value: data.value, usageCount: data.count });
    }

    // Keyframes
    result.animations.keyframes = keyframes.slice(0, MAX_ANIMATIONS);
    if (keyframes.length > MAX_ANIMATIONS) result.animations._truncated = true;

    // Media queries
    for (const [condition, count] of mediaQueries) {
      result.breakpoints.mediaQueries.push({ condition, ruleCount: count });
    }

    // Extract breakpoint widths
    const widthSet = new Set();
    for (const { condition } of result.breakpoints.mediaQueries) {
      const matches = condition.match(/(\d+(?:\.\d+)?)(px|em|rem)/g);
      if (matches) matches.forEach(m => widthSet.add(m));
    }
    result.breakpoints.widths = Array.from(widthSet).sort((a, b) => parseFloat(a) - parseFloat(b));

    // State rules
    for (const state of ['hover', 'focus', 'active', 'disabled']) {
      result.states[state] = stateRules[state].slice(0, MAX_STATES);
    }
    if (Object.values(stateRules).some(arr => arr.length > MAX_STATES)) {
      result.states._truncated = true;
    }

    // Font faces
    result.typography.fontFaces = Array.from(fontFaceMap.values()).map(f => ({
      family: f.family,
      weights: Array.from(f.weights).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b),
      src: f.src
    }));
  }

  function processRules(rules, cssVars, keyframes, mediaQueries, stateRules, animationUsageMap, transitionMap, fontFaceMap) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        // CSS custom properties
        const text = rule.style.cssText;
        const varMatches = text.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g);
        for (const m of varMatches) {
          const name = m[1];
          const value = m[2].trim();
          if (cssVars.has(name)) {
            cssVars.get(name).count++;
          } else {
            cssVars.set(name, { value, count: 1 });
          }
        }

        const selector = rule.selectorText;

        // Track animation usage for keyframe linkage
        if (selector) {
          const animName = rule.style.getPropertyValue('animation-name');
          if (animName && animName !== 'none' && animName !== '') {
            const entry = {
              selector,
              duration: rule.style.getPropertyValue('animation-duration') || '0s',
              delay: rule.style.getPropertyValue('animation-delay') || '0s',
              iterationCount: rule.style.getPropertyValue('animation-iteration-count') || '1',
              direction: rule.style.getPropertyValue('animation-direction') || 'normal',
              fillMode: rule.style.getPropertyValue('animation-fill-mode') || 'none',
              timingFunction: rule.style.getPropertyValue('animation-timing-function') || 'ease'
            };
            for (const name of animName.split(',').map(n => n.trim())) {
              if (!animationUsageMap.has(name)) animationUsageMap.set(name, []);
              animationUsageMap.get(name).push(entry);
            }
          }

          // Track transition properties for state rule linkage
          const transitionProp = rule.style.getPropertyValue('transition-property');
          if (transitionProp && transitionProp !== 'all' && transitionProp !== 'none' && transitionProp !== '') {
            const baseSel = selector.replace(/:(?:hover|focus(?:-visible|-within)?|active|disabled)/, '');
            if (baseSel === selector) {
              transitionMap.set(selector, {
                property: transitionProp,
                duration: rule.style.getPropertyValue('transition-duration') || '0s',
                delay: rule.style.getPropertyValue('transition-delay') || '0s',
                timingFunction: rule.style.getPropertyValue('transition-timing-function') || 'ease'
              });
            }
          }
        }

        // State rules
        if (selector) {
          const stateMap = {
            hover: /:hover/,
            focus: /:focus(?:-visible|-within)?/,
            active: /:active/,
            disabled: /:disabled/
          };
          for (const [state, regex] of Object.entries(stateMap)) {
            if (regex.test(selector)) {
              const props = {};
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                props[prop] = rule.style.getPropertyValue(prop);
              }
              const stateEntry = { selector, properties: props };
              // Attach transition timing from base rule
              const baseSelector = selector.replace(/:(?:hover|focus(?:-visible|-within)?|active|disabled)/, '');
              const baseTrans = transitionMap.get(baseSelector);
              if (baseTrans) stateEntry.transition = baseTrans;
              stateRules[state].push(stateEntry);
            }
          }
        }
      } else if (rule instanceof CSSKeyframesRule) {
        const frames = {};
        for (const kf of rule.cssRules) {
          const props = {};
          for (let i = 0; i < kf.style.length; i++) {
            const prop = kf.style[i];
            props[prop] = kf.style.getPropertyValue(prop);
          }
          frames[kf.keyText] = props;
        }
        keyframes.push({ name: rule.name, frames });
      } else if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
        const weight = rule.style.getPropertyValue('font-weight') || '400';
        const src = rule.style.getPropertyValue('src') || '';
        if (!fontFaceMap.has(family)) {
          fontFaceMap.set(family, { family, weights: new Set(), src: '' });
        }
        const entry = fontFaceMap.get(family);
        weight.split(/\s+/).forEach(w => entry.weights.add(w));
        if (!entry.src && src) entry.src = src.substring(0, 200);
      } else if (rule instanceof CSSMediaRule) {
        const condition = rule.conditionText || rule.media.mediaText;
        mediaQueries.set(condition, (mediaQueries.get(condition) || 0) + rule.cssRules.length);
        // Recurse into media rules
        processRules(rule.cssRules, cssVars, keyframes, mediaQueries, stateRules, animationUsageMap, transitionMap, fontFaceMap);
      } else if (rule.cssRules) {
        // Other grouping rules (@supports, @layer, etc.)
        processRules(rule.cssRules, cssVars, keyframes, mediaQueries, stateRules, animationUsageMap, transitionMap, fontFaceMap);
      }
    }
  }

  // --- Extract from computed styles ---

  function extractFromComputedStyles(elements) {
    const bgColors = new Set();
    const textColors = new Set();
    const borderColors = new Set();
    const gradients = new Set();
    const fontFamilies = new Set();
    const fontSizes = new Set();
    const fontWeights = new Set();
    const lineHeights = new Set();
    const letterSpacings = new Set();
    const spacingValues = new Set();
    const gapValues = new Set();
    const borderWidths = new Set();
    const borderStyles = new Set();
    const borderRadii = new Set();
    const boxShadows = new Set();
    const textShadows = new Set();
    const dropShadows = new Set();
    const zIndices = new Set();
    const transitionMap = new Map();
    const durationSet = new Set();
    const easingSet = new Set();
    const gridPatterns = new Map();
    const flexPatterns = new Map();
    const containerWidths = new Set();

    result.meta.totalElementsSampled = elements.length;

    for (const el of elements) {
      let cs;
      try {
        cs = getComputedStyle(el);
      } catch (e) { continue; }

      // Colors
      const bg = normalizeColor(cs.backgroundColor);
      if (bg) bgColors.add(bg);
      const tc = normalizeColor(cs.color);
      if (tc) textColors.add(tc);
      const bc = normalizeColor(cs.borderColor);
      if (bc && bc !== 'rgb(0, 0, 0)') borderColors.add(bc);

      // Gradients
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.includes('gradient')) {
        gradients.add(bgImg);
      }

      // Typography
      if (cs.fontFamily) fontFamilies.add(cs.fontFamily);
      if (cs.fontSize) fontSizes.add(cs.fontSize);
      if (cs.fontWeight) fontWeights.add(cs.fontWeight);
      if (cs.lineHeight && cs.lineHeight !== 'normal') lineHeights.add(cs.lineHeight);
      if (cs.letterSpacing && cs.letterSpacing !== 'normal') letterSpacings.add(cs.letterSpacing);

      // Spacing
      for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
                           'marginTop', 'marginRight', 'marginBottom', 'marginLeft']) {
        const v = cs[prop];
        if (v && v !== '0px') spacingValues.add(v);
      }
      if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') gapValues.add(cs.gap);
      if (cs.rowGap && cs.rowGap !== 'normal' && cs.rowGap !== '0px') gapValues.add(cs.rowGap);
      if (cs.columnGap && cs.columnGap !== 'normal' && cs.columnGap !== '0px') gapValues.add(cs.columnGap);

      // Borders
      const bw = cs.borderTopWidth;
      if (bw && bw !== '0px') borderWidths.add(bw);
      const bs = cs.borderTopStyle;
      if (bs && bs !== 'none') borderStyles.add(bs);
      const br = cs.borderRadius;
      if (br && br !== '0px') borderRadii.add(br);

      // Shadows
      if (cs.boxShadow && cs.boxShadow !== 'none') boxShadows.add(cs.boxShadow);
      if (cs.textShadow && cs.textShadow !== 'none') textShadows.add(cs.textShadow);
      const filter = cs.filter;
      if (filter && filter.includes('drop-shadow')) {
        const dsMatch = filter.match(/drop-shadow\([^)]+\)/g);
        if (dsMatch) dsMatch.forEach(ds => dropShadows.add(ds));
      }

      // Z-index
      if (cs.zIndex && cs.zIndex !== 'auto') {
        const z = parseInt(cs.zIndex, 10);
        if (!isNaN(z)) zIndices.add(z);
      }

      // Transitions
      if (cs.transitionProperty && cs.transitionProperty !== 'all' && cs.transitionProperty !== 'none') {
        const key = `${cs.transitionProperty}|${cs.transitionDuration}|${cs.transitionTimingFunction}`;
        transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
      }
      if (cs.transitionDuration && cs.transitionDuration !== '0s') durationSet.add(cs.transitionDuration);
      if (cs.animationDuration && cs.animationDuration !== '0s') durationSet.add(cs.animationDuration);
      if (cs.transitionTimingFunction) easingSet.add(cs.transitionTimingFunction);
      if (cs.animationTimingFunction) easingSet.add(cs.animationTimingFunction);

      // Layout
      const display = cs.display;
      if (display === 'grid' || display === 'inline-grid') {
        const key = `${cs.gridTemplateColumns}|${cs.gap || '0px'}`;
        gridPatterns.set(key, (gridPatterns.get(key) || 0) + 1);
      }
      if (display === 'flex' || display === 'inline-flex') {
        const key = `${cs.flexDirection}|${cs.flexWrap}|${cs.gap || '0px'}`;
        flexPatterns.set(key, (flexPatterns.get(key) || 0) + 1);
      }
      if (cs.maxWidth && cs.maxWidth !== 'none' && parsePxValue(cs.maxWidth)) {
        containerWidths.add(cs.maxWidth);
      }
    }

    // Populate results
    result.colors.backgroundColors = Array.from(bgColors).slice(0, MAX_COLORS);
    result.colors.textColors = Array.from(textColors).slice(0, MAX_COLORS);
    result.colors.borderColors = Array.from(borderColors).slice(0, MAX_COLORS);
    result.colors.gradients = Array.from(gradients).slice(0, 50);
    if (bgColors.size > MAX_COLORS || textColors.size > MAX_COLORS) result.colors._truncated = true;

    result.typography.fontFamiliesUsed = Array.from(fontFamilies);
    result.typography.fontSizeScale = Array.from(fontSizes).sort((a, b) => parsePxValue(a) - parsePxValue(b));
    result.typography.fontWeights = Array.from(fontWeights).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    result.typography.lineHeights = Array.from(lineHeights);
    result.typography.letterSpacings = Array.from(letterSpacings);
    result.typography.detectedScaleRatio = detectScaleRatio(result.typography.fontSizeScale);

    const sortedSpacing = Array.from(spacingValues).sort((a, b) => (parsePxValue(a) || 0) - (parsePxValue(b) || 0));
    result.spacing.values = sortedSpacing;
    result.spacing.baseUnit = findBaseUnit(sortedSpacing);
    result.spacing.gaps = Array.from(gapValues).sort((a, b) => (parsePxValue(a) || 0) - (parsePxValue(b) || 0));

    result.borders.widths = Array.from(borderWidths);
    result.borders.styles = Array.from(borderStyles);
    result.borders.radii = Array.from(borderRadii).sort((a, b) => (parsePxValue(a) || 0) - (parsePxValue(b) || 0));

    result.shadows.boxShadows = Array.from(boxShadows);
    result.shadows.textShadows = Array.from(textShadows);
    result.shadows.dropShadows = Array.from(dropShadows);

    // Animations — transitions
    for (const [key, count] of transitionMap) {
      const [property, duration, timingFunction] = key.split('|');
      result.animations.transitions.push({ property, duration, timingFunction, count });
    }
    result.animations.transitions.sort((a, b) => b.count - a.count);
    result.animations.transitions = result.animations.transitions.slice(0, MAX_ANIMATIONS);
    result.animations.durations = Array.from(durationSet).sort();
    result.animations.easings = Array.from(easingSet);

    // Z-index
    const zArr = Array.from(zIndices).sort((a, b) => a - b);
    result.zIndex.values = zArr;
    result.zIndex.max = zArr.length > 0 ? zArr[zArr.length - 1] : 0;

    // Layout
    for (const [key, count] of gridPatterns) {
      const [columns, gap] = key.split('|');
      result.layout.gridPatterns.push({ columns, gap, count });
    }
    result.layout.gridPatterns.sort((a, b) => b.count - a.count);

    for (const [key, count] of flexPatterns) {
      const [direction, wrap, gap] = key.split('|');
      result.layout.flexPatterns.push({ direction, wrap, gap, count });
    }
    result.layout.flexPatterns.sort((a, b) => b.count - a.count);

    result.layout.containerWidths = Array.from(containerWidths).sort((a, b) => (parsePxValue(a) || 0) - (parsePxValue(b) || 0));
  }

  // --- Detect components ---

  function detectComponents() {
    const classCounter = new Map();
    const structureMap = new Map();
    const all = document.querySelectorAll('[class]');

    for (const el of all) {
      const classes = Array.from(el.classList).filter(c => c.length > 1);
      for (const cls of classes) {
        // Count class occurrences
        classCounter.set(cls, (classCounter.get(cls) || 0) + 1);
      }

      // Track structure by primary class
      const primaryClass = classes[0];
      if (primaryClass && !structureMap.has(primaryClass)) {
        const childTags = Array.from(el.children).slice(0, 5).map(c => {
          const childClass = c.classList[0] ? '.' + c.classList[0] : '';
          return c.tagName.toLowerCase() + childClass;
        });
        structureMap.set(primaryClass, {
          tag: el.tagName.toLowerCase(),
          children: childTags.join(' + ')
        });
      }
    }

    // Find component-like classes (BEM blocks, repeated patterns)
    const candidates = [];
    for (const [cls, count] of classCounter) {
      if (count < 2) continue;
      // Skip utility-like classes (single word, very common)
      if (count > 100 && cls.length < 5) continue;
      // Prefer BEM-like block names or multi-word classes
      const isBemBlock = !cls.includes('__') && !cls.includes('--');
      const hasModifiers = classCounter.has(cls + '--') || Array.from(classCounter.keys()).some(k => k.startsWith(cls + '--'));
      const hasElements = Array.from(classCounter.keys()).some(k => k.startsWith(cls + '__'));

      if (isBemBlock && (hasModifiers || hasElements || count >= 3)) {
        candidates.push({ cls, count, hasModifiers, hasElements });
      }
    }

    // Sort by count descending, take top N
    candidates.sort((a, b) => b.count - a.count);

    for (const c of candidates.slice(0, MAX_COMPONENTS)) {
      const structure = structureMap.get(c.cls);
      const el = document.querySelector('.' + CSS.escape(c.cls));
      let styles = {};
      if (el) {
        const cs = getComputedStyle(el);
        styles = {
          display: cs.display,
          padding: cs.padding,
          borderRadius: cs.borderRadius,
          boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
          backgroundColor: cs.backgroundColor,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        };
        // Remove undefined values
        Object.keys(styles).forEach(k => styles[k] === undefined && delete styles[k]);
      }

      result.components.push({
        name: c.cls,
        selector: '.' + c.cls,
        occurrences: c.count,
        structure: structure ? `${structure.tag} > ${structure.children}` : '',
        styles
      });
    }
  }

  // --- Detect icons ---

  function detectIcons() {
    // Inline SVGs
    const svgs = document.querySelectorAll('svg');
    result.icons.inlineSvgCount = svgs.length;

    const sizeSet = new Set();
    for (const svg of svgs) {
      const w = svg.getAttribute('width') || svg.getBoundingClientRect().width;
      const h = svg.getAttribute('height') || svg.getBoundingClientRect().height;
      if (w && h) sizeSet.add(`${Math.round(Number(w))}x${Math.round(Number(h))}`);
    }
    result.icons.svgSizes = Array.from(sizeSet);

    // Icon fonts
    const knownIconFonts = ['Font Awesome', 'Material Icons', 'Material Symbols', 'feather',
      'ionicons', 'remixicon', 'phosphor', 'tabler-icons', 'lucide', 'boxicons'];
    const detectedFonts = new Set();

    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
            for (const known of knownIconFonts) {
              if (family.toLowerCase().includes(known.toLowerCase())) {
                detectedFonts.add(family);
              }
            }
          }
        }
      } catch (e) { continue; }
    }

    // Also check elements with single-char content
    const iconCandidates = document.querySelectorAll('i, span.icon, [class*="icon"], [class*="material"]');
    for (const el of iconCandidates) {
      const text = el.textContent?.trim();
      if (text && text.length <= 3) {
        const cs = getComputedStyle(el);
        const family = cs.fontFamily;
        for (const known of knownIconFonts) {
          if (family.toLowerCase().includes(known.toLowerCase())) {
            detectedFonts.add(family.split(',')[0].replace(/['"]/g, '').trim());
          }
        }
      }
    }

    result.icons.iconFonts = Array.from(detectedFonts);
  }

  // --- Execute ---

  try {
    extractFromStylesheets();
    const elements = collectAllElements();
    extractFromComputedStyles(elements);
    detectComponents();
    detectIcons();
  } catch (e) {
    result.meta.error = e.message;
  }

  return JSON.stringify(result);
})()
