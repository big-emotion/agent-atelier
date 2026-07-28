(() => {
  // Initialize or reuse accumulator for multi-page runs
  if (!window.__REVERSE_UI_ASSETS) {
    window.__REVERSE_UI_ASSETS = {
      images: [],
      svgs: [],
      fonts: [],
      favicons: [],
      backgroundImages: [],
      logos: []
    };
  }

  const assets = window.__REVERSE_UI_ASSETS;
  const currentPage = location.pathname;

  // --- Helpers ---

  function addPage(arr, item, matchFn) {
    const existing = arr.find(matchFn);
    if (existing) {
      if (!existing.pages.includes(currentPage)) existing.pages.push(currentPage);
      return;
    }
    item.pages = [currentPage];
    arr.push(item);
  }

  function isVisible(el) {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    } catch (e) {}
    return true;
  }

  function isInHeader(el) {
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName === 'HEADER' || parent.tagName === 'NAV' || parent.getAttribute('role') === 'banner' || parent.getAttribute('role') === 'navigation') {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  // --- Images ---

  document.querySelectorAll('img[src]').forEach(el => {
    if (!isVisible(el)) return;
    const src = el.src;
    if (!src || src.startsWith('data:')) return;

    const item = {
      src,
      alt: el.alt || undefined,
      naturalWidth: el.naturalWidth || undefined,
      naturalHeight: el.naturalHeight || undefined,
      srcset: el.getAttribute('srcset') || undefined
    };

    addPage(assets.images, item, e => e.src === src);

    // Logo detection: image in header/nav or class contains "logo"
    const cls = el.className || '';
    const parentCls = el.parentElement?.className || '';
    if (isInHeader(el) || /logo/i.test(cls) || /logo/i.test(parentCls) || /logo/i.test(el.alt || '')) {
      const logoItem = {
        src,
        selector: el.id ? 'img#' + el.id : (el.classList.length > 0 ? 'img.' + Array.from(el.classList).slice(0, 2).join('.') : 'img'),
        dimensions: el.naturalWidth && el.naturalHeight ? `${el.naturalWidth}x${el.naturalHeight}` : undefined
      };
      addPage(assets.logos, logoItem, e => e.src === src);
    }
  });

  // --- Inline SVGs ---

  document.querySelectorAll('svg').forEach(el => {
    if (!isVisible(el)) return;
    const viewBox = el.getAttribute('viewBox') || '';
    const firstPath = el.querySelector('path');
    const pathD = firstPath ? (firstPath.getAttribute('d') || '').substring(0, 60) : '';
    const w = Math.round(el.getBoundingClientRect().width);
    const h = Math.round(el.getBoundingClientRect().height);

    // Try to find a meaningful identifier
    const ariaLabel = el.getAttribute('aria-label') || '';
    const parentClass = el.parentElement?.classList?.[0] || '';
    const usage = ariaLabel || parentClass || '';

    const item = {
      inline: true,
      viewBox: viewBox || undefined,
      pathHint: pathD || undefined,
      width: w,
      height: h,
      usage: usage || undefined
    };

    // Deduplicate by pathHint (similar SVGs)
    addPage(assets.svgs, item, e => e.pathHint && e.pathHint === pathD && pathD.length > 10);

    // SVG logo detection
    if (isInHeader(el) && (w > 20 || h > 20)) {
      const logoItem = {
        src: '(inline-svg)',
        selector: el.parentElement ? (el.parentElement.tagName.toLowerCase() + (el.parentElement.classList[0] ? '.' + el.parentElement.classList[0] : '') + ' > svg') : 'svg',
        dimensions: `${w}x${h}`,
        viewBox: viewBox || undefined
      };
      addPage(assets.logos, logoItem, e => e.selector === logoItem.selector);
    }
  });

  // --- External SVGs (img src ending in .svg) ---

  document.querySelectorAll('img[src$=".svg"]').forEach(el => {
    if (!isVisible(el)) return;
    const item = {
      inline: false,
      src: el.src,
      width: el.naturalWidth || Math.round(el.getBoundingClientRect().width),
      height: el.naturalHeight || Math.round(el.getBoundingClientRect().height),
      alt: el.alt || undefined
    };
    addPage(assets.svgs, item, e => e.src === el.src);
  });

  // --- Favicons and touch icons ---

  document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]').forEach(el => {
    const href = el.href;
    if (!href) return;
    const item = {
      href,
      rel: el.getAttribute('rel'),
      type: el.getAttribute('type') || undefined,
      sizes: el.getAttribute('sizes') || undefined
    };
    addPage(assets.favicons, item, e => e.href === href);
  });

  // --- Background images (non-gradient) ---

  const bgChecked = new Set();
  document.querySelectorAll('*').forEach(el => {
    const key = el.tagName + '.' + (el.classList[0] || '');
    if (bgChecked.has(key)) return;
    bgChecked.add(key);
    if (bgChecked.size > 300) return; // Cap

    try {
      const bgImg = getComputedStyle(el).backgroundImage;
      if (!bgImg || bgImg === 'none' || !bgImg.includes('url(')) return;
      if (bgImg.includes('gradient')) return; // Gradients are in design-tokens

      const urlMatch = bgImg.match(/url\(["']?([^"')]+)["']?\)/);
      if (!urlMatch) return;
      const src = urlMatch[1];
      if (src.startsWith('data:')) return;

      const selector = el.id ? '#' + el.id : (el.classList[0] ? el.tagName.toLowerCase() + '.' + el.classList[0] : el.tagName.toLowerCase());
      const item = { src, selector };
      addPage(assets.backgroundImages, item, e => e.src === src);
    } catch (e) {}
  });

  // --- Fonts ---

  // From @font-face rules
  const fontMap = new Map();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
    if (!rules) continue;
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
        const weight = rule.style.getPropertyValue('font-weight') || '400';
        const src = rule.style.getPropertyValue('src') || '';

        if (!fontMap.has(family)) {
          fontMap.set(family, { family, weights: new Set(), sources: new Set() });
        }
        const entry = fontMap.get(family);
        weight.split(/[\s,]+/).forEach(w => { const n = parseInt(w); if (!isNaN(n)) entry.weights.add(n); });
        if (src) {
          const urlMatch = src.match(/url\(["']?([^"')]+)["']?\)/);
          if (urlMatch) entry.sources.add(urlMatch[1].substring(0, 200));
        }
      }
    }
  }

  // From Google Fonts / external font links
  document.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"], link[href*="fontshare.com"], link[href*="use.typekit.net"]').forEach(el => {
    const href = el.href;
    // Try to extract family name from URL
    const familyMatch = href.match(/family=([^&:]+)/);
    if (familyMatch) {
      const families = familyMatch[1].split('|');
      for (const f of families) {
        const name = decodeURIComponent(f.replace(/\+/g, ' '));
        if (!fontMap.has(name)) {
          fontMap.set(name, { family: name, weights: new Set(), sources: new Set() });
        }
        fontMap.get(name).sources.add(href);
      }
    }
  });

  // Also check document.fonts API
  try {
    for (const font of document.fonts) {
      const family = font.family.replace(/['"]/g, '').trim();
      if (!fontMap.has(family)) {
        fontMap.set(family, { family, weights: new Set(), sources: new Set() });
      }
      const w = parseInt(font.weight);
      if (!isNaN(w)) fontMap.get(family).weights.add(w);
    }
  } catch (e) {}

  // Merge into assets
  for (const [family, data] of fontMap) {
    const item = {
      family,
      weights: Array.from(data.weights).sort((a, b) => a - b),
      sources: Array.from(data.sources).slice(0, 5)
    };
    const existing = assets.fonts.find(f => f.family === family);
    if (existing) {
      // Merge weights and sources
      const mergedWeights = new Set([...existing.weights, ...item.weights]);
      existing.weights = Array.from(mergedWeights).sort((a, b) => a - b);
      const mergedSources = new Set([...existing.sources, ...item.sources]);
      existing.sources = Array.from(mergedSources).slice(0, 5);
      if (!existing.pages.includes(currentPage)) existing.pages.push(currentPage);
    } else {
      item.pages = [currentPage];
      assets.fonts.push(item);
    }
  }

  return JSON.stringify(assets);
})()
