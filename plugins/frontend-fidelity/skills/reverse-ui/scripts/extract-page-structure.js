(() => {
  const MAX_DEPTH = 6;
  const MAX_CHUNK_SIZE = 80000;
  const MAX_REPETITIVE_SIBLINGS = 2;
  const REPETITIVE_THRESHOLD = 5;

  const STYLE_PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'margin', 'padding',
    'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap',
    'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
    'backgroundColor', 'color', 'opacity',
    'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textDecoration', 'textTransform',
    'borderRadius', 'borderWidth', 'borderStyle', 'borderColor',
    'boxShadow', 'overflow', 'overflowX', 'overflowY', 'zIndex',
    'backgroundImage', 'backgroundSize', 'backgroundPosition',
    'backdropFilter', 'clipPath', 'transform', 'cursor',
    'transitionProperty', 'transitionDuration', 'transitionDelay', 'transitionTimingFunction',
    'animationName', 'animationDuration', 'animationDelay', 'animationIterationCount',
    'animationDirection', 'animationFillMode', 'animationPlayState', 'animationTimingFunction',
    'transformOrigin', 'perspective', 'transformStyle', 'backfaceVisibility', 'willChange',
    'aspectRatio', 'objectFit', 'objectPosition', 'whiteSpace', 'wordBreak'
  ];

  const MAX_PSEUDO_ELEMENTS = 200;
  let pseudoElementCount = 0;

  const LANDMARK_TAGS = new Set(['HEADER', 'NAV', 'MAIN', 'SECTION', 'ASIDE', 'FOOTER', 'ARTICLE']);
  const LANDMARK_ROLES = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'region', 'search', 'form']);

  // --- Helpers ---

  function isVisible(el) {
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return true;
  }

  function getSelector(el) {
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    const classes = Array.from(el.classList).filter(c => c.length > 0);
    if (classes.length > 0) {
      return el.tagName.toLowerCase() + '.' + classes.slice(0, 3).join('.');
    }
    return el.tagName.toLowerCase();
  }

  function getBoundingBox(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.x + window.scrollX),
      y: Math.round(rect.y + window.scrollY),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    };
  }

  function getKeyStyles(el) {
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { return {}; }
    const styles = {};
    for (const prop of STYLE_PROPS) {
      const val = cs[prop];
      if (!val || val === 'none' || val === 'normal' || val === 'auto' || val === '0px' || val === 'static' || val === 'visible' || val === 'start') continue;
      // Skip default/inherited values that add noise
      if (prop === 'display' && val === 'block') continue;
      if (prop === 'position' && val === 'static') continue;
      if (prop === 'color' && val === 'rgb(0, 0, 0)') continue;
      if (prop === 'backgroundColor' && (val === 'rgba(0, 0, 0, 0)' || val === 'transparent')) continue;
      if (prop === 'fontWeight' && val === '400') continue;
      if (prop === 'textAlign' && val === 'start') continue;
      if (prop === 'textDecoration' && val.startsWith('none')) continue;
      if (prop === 'textTransform' && val === 'none') continue;
      if (prop === 'opacity' && val === '1') continue;
      if (prop === 'overflow' && val === 'visible') continue;
      if (prop === 'zIndex' && val === 'auto') continue;
      if (prop === 'backgroundImage' && val === 'none') continue;
      if (prop === 'overflowX' && val === 'visible') continue;
      if (prop === 'overflowY' && val === 'visible') continue;
      if (prop === 'backdropFilter' && val === 'none') continue;
      if (prop === 'clipPath' && val === 'none') continue;
      if (prop === 'transform' && val === 'none') continue;
      if (prop === 'cursor' && val === 'auto') continue;
      if (prop === 'transitionProperty' && (val === 'all' || val === 'none')) continue;
      if (prop === 'transitionDuration' && val === '0s') continue;
      if (prop === 'transitionDelay' && val === '0s') continue;
      if (prop === 'transitionTimingFunction' && val === 'ease') continue;
      if (prop === 'animationName' && val === 'none') continue;
      if (prop === 'animationDuration' && val === '0s') continue;
      if (prop === 'animationDelay' && val === '0s') continue;
      if (prop === 'animationIterationCount' && val === '1') continue;
      if (prop === 'animationDirection' && val === 'normal') continue;
      if (prop === 'animationFillMode' && val === 'none') continue;
      if (prop === 'animationPlayState' && val === 'running') continue;
      if (prop === 'animationTimingFunction' && val === 'ease') continue;
      if (prop === 'transformOrigin' && val.includes('50% 50%')) continue;
      if (prop === 'perspective' && val === 'none') continue;
      if (prop === 'transformStyle' && val === 'flat') continue;
      if (prop === 'backfaceVisibility' && val === 'visible') continue;
      if (prop === 'willChange' && val === 'auto') continue;
      if (prop === 'aspectRatio' && val === 'auto') continue;
      if (prop === 'objectFit' && val === 'fill') continue;
      if (prop === 'objectPosition' && val === '50% 50%') continue;
      if (prop === 'whiteSpace' && val === 'normal') continue;
      if (prop === 'wordBreak' && val === 'normal') continue;
      styles[prop] = val;
    }
    return styles;
  }

  function getRelevantAttributes(el) {
    const attrs = {};
    const ATTR_LIST = [
      'href', 'src', 'alt', 'type', 'placeholder', 'aria-label', 'aria-labelledby', 'role', 'name', 'value', 'action', 'method', 'target', 'rel', 'srcset', 'data-testid',
      'data-aos', 'data-aos-delay', 'data-aos-duration', 'data-aos-easing', 'data-aos-offset',
      'data-scroll', 'data-scroll-speed', 'data-parallax', 'data-animate', 'data-animation', 'data-reveal'
    ];
    for (const attr of ATTR_LIST) {
      const val = el.getAttribute(attr);
      if (val !== null && val !== '') {
        attrs[attr] = val.length > 300 ? val.substring(0, 300) + '...' : val;
      }
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined;
  }

  function getTextContent(el) {
    // Only get direct text (not from children)
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) text += (text ? ' ' : '') + t;
      }
    }
    return text.length > 0 ? (text.length > 200 ? text.substring(0, 200) + '...' : text) : undefined;
  }

  function getAssetRef(el) {
    const tag = el.tagName;
    if (tag === 'IMG') {
      return {
        type: 'image',
        src: el.src,
        alt: el.alt || undefined,
        naturalWidth: el.naturalWidth || undefined,
        naturalHeight: el.naturalHeight || undefined,
        srcset: el.getAttribute('srcset') || undefined
      };
    }
    if (tag === 'SVG' || (tag === 'svg')) {
      const vb = el.getAttribute('viewBox');
      const firstPath = el.querySelector('path');
      return {
        type: 'svg',
        viewBox: vb || undefined,
        pathHint: firstPath ? (firstPath.getAttribute('d') || '').substring(0, 80) : undefined,
        width: el.getAttribute('width') || Math.round(el.getBoundingClientRect().width),
        height: el.getAttribute('height') || Math.round(el.getBoundingClientRect().height)
      };
    }
    if (tag === 'VIDEO') {
      return { type: 'video', src: el.src || el.querySelector('source')?.src };
    }
    // Check for background image
    try {
      const bgImg = getComputedStyle(el).backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.includes('url(')) {
        const urlMatch = bgImg.match(/url\(["']?([^"')]+)["']?\)/);
        if (urlMatch) return { type: 'background-image', src: urlMatch[1] };
      }
    } catch (e) {}
    return undefined;
  }

  // --- Sibling pattern detection for collapsing repetitive structures ---

  function getSiblingSignature(el) {
    const childTags = Array.from(el.children).slice(0, 5).map(c => c.tagName).join(',');
    const cls = Array.from(el.classList).sort().join('.');
    return el.tagName + '|' + cls + '|' + childTags;
  }

  // --- Recursive DOM walker ---

  function walkNode(el, depth) {
    if (depth > MAX_DEPTH) return null;
    if (!isVisible(el)) return null;

    const tag = el.tagName.toLowerCase();
    // Skip script, style, noscript, template
    if (['script', 'style', 'noscript', 'template', 'link', 'meta'].includes(tag)) return null;

    const node = {
      tag,
      selector: getSelector(el),
    };

    const role = el.getAttribute('role');
    if (role) node.role = role;

    const bbox = getBoundingBox(el);
    if (bbox.w > 0 && bbox.h > 0) node.boundingBox = bbox;

    const styles = getKeyStyles(el);
    if (Object.keys(styles).length > 0) node.styles = styles;

    const text = getTextContent(el);
    if (text) node.text = text;

    const attrs = getRelevantAttributes(el);
    if (attrs) node.attributes = attrs;

    const asset = getAssetRef(el);
    if (asset) node.asset = asset;

    // Pseudo-elements
    if (pseudoElementCount < MAX_PSEUDO_ELEMENTS) {
      const pseudos = {};
      for (const pseudo of ['::before', '::after']) {
        try {
          const pcs = getComputedStyle(el, pseudo);
          const content = pcs.content;
          if (content && content !== 'none' && content !== 'normal' && content !== '""') {
            const pStyles = { content };
            for (const prop of STYLE_PROPS) {
              const val = pcs[prop];
              if (!val || val === 'none' || val === 'normal' || val === 'auto' || val === '0px' || val === 'static' || val === 'visible' || val === 'start') continue;
              if (prop === 'display' && val === 'block') continue;
              if (prop === 'backgroundColor' && (val === 'rgba(0, 0, 0, 0)' || val === 'transparent')) continue;
              if (prop === 'color' && val === 'rgb(0, 0, 0)') continue;
              if (prop === 'fontWeight' && val === '400') continue;
              if (prop === 'opacity' && val === '1') continue;
              pStyles[prop] = val;
            }
            pseudos[pseudo] = pStyles;
            pseudoElementCount++;
          }
        } catch (e) {}
      }
      if (Object.keys(pseudos).length > 0) node.pseudoElements = pseudos;
    }

    // Walk children
    const children = Array.from(el.children).filter(c => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META'].includes(c.tagName));
    if (children.length > 0) {
      // Detect repetitive siblings
      const sigMap = new Map();
      for (const child of children) {
        const sig = getSiblingSignature(child);
        sigMap.set(sig, (sigMap.get(sig) || 0) + 1);
      }

      const processedChildren = [];
      const seenRepetitive = new Map();

      for (const child of children) {
        const sig = getSiblingSignature(child);
        const count = sigMap.get(sig);

        if (count >= REPETITIVE_THRESHOLD) {
          const seenCount = seenRepetitive.get(sig) || 0;
          if (seenCount < MAX_REPETITIVE_SIBLINGS) {
            const childNode = walkNode(child, depth + 1);
            if (childNode) {
              if (seenCount === 0) childNode._repeatGroup = { signature: sig, totalCount: count };
              processedChildren.push(childNode);
            }
            seenRepetitive.set(sig, seenCount + 1);
          } else if (seenCount === MAX_REPETITIVE_SIBLINGS) {
            processedChildren.push({
              tag: '_repeated',
              count: count - MAX_REPETITIVE_SIBLINGS,
              signature: sig,
              note: `${count - MAX_REPETITIVE_SIBLINGS} more siblings with same structure omitted`
            });
            seenRepetitive.set(sig, seenCount + 1);
          }
        } else {
          const childNode = walkNode(child, depth + 1);
          if (childNode) processedChildren.push(childNode);
        }
      }

      if (processedChildren.length > 0) node.children = processedChildren;
    }

    return node;
  }

  // --- Identify landmark sections ---

  function findSections() {
    const sections = [];

    // Try landmark elements first
    const landmarks = document.querySelectorAll('header, nav, main, section, aside, footer, article, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="region"], [role="search"]');

    if (landmarks.length > 0) {
      // Filter to top-level landmarks (not nested inside another landmark)
      const topLevel = Array.from(landmarks).filter(el => {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          if (LANDMARK_TAGS.has(parent.tagName) || LANDMARK_ROLES.has(parent.getAttribute('role'))) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });

      if (topLevel.length > 0) return topLevel;
    }

    // Fallback: direct children of body
    return Array.from(document.body.children).filter(el => isVisible(el) && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META'].includes(el.tagName));
  }

  // --- Text content map ---

  function extractTextContent() {
    const content = {
      headings: [],
      paragraphs: [],
      buttons: [],
      links: [],
      labels: [],
      inputs: []
    };

    // Headings
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      if (!isVisible(el)) return;
      const text = el.textContent.trim();
      if (text) {
        content.headings.push({
          level: parseInt(el.tagName[1]),
          text: text.substring(0, 200),
          selector: getSelector(el)
        });
      }
    });

    // Paragraphs (limit to first 50)
    let pCount = 0;
    document.querySelectorAll('p').forEach(el => {
      if (pCount >= 50 || !isVisible(el)) return;
      const text = el.textContent.trim();
      if (text && text.length > 5) {
        content.paragraphs.push({
          text: text.substring(0, 300),
          selector: getSelector(el)
        });
        pCount++;
      }
    });

    // Buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
      if (!isVisible(el)) return;
      const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
      if (text) {
        content.buttons.push({
          text: text.substring(0, 100),
          selector: getSelector(el),
          type: el.getAttribute('type') || undefined,
          disabled: el.disabled || undefined
        });
      }
    });

    // Links (limit to first 50)
    let linkCount = 0;
    document.querySelectorAll('a[href]').forEach(el => {
      if (linkCount >= 50 || !isVisible(el)) return;
      const text = el.textContent.trim();
      if (text) {
        content.links.push({
          text: text.substring(0, 100),
          href: el.getAttribute('href'),
          selector: getSelector(el)
        });
        linkCount++;
      }
    });

    // Labels
    document.querySelectorAll('label').forEach(el => {
      if (!isVisible(el)) return;
      const text = el.textContent.trim();
      if (text) {
        content.labels.push({
          text: text.substring(0, 100),
          for: el.getAttribute('for') || undefined,
          selector: getSelector(el)
        });
      }
    });

    // Inputs (form fields)
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (!isVisible(el)) return;
      const entry = {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || undefined,
        placeholder: el.getAttribute('placeholder') || undefined,
        name: el.getAttribute('name') || undefined,
        selector: getSelector(el)
      };
      if (el.tagName === 'SELECT') {
        entry.options = Array.from(el.options).slice(0, 10).map(o => o.textContent.trim());
      }
      content.inputs.push(entry);
    });

    return content;
  }

  // --- Main execution ---

  try {
    const result = {
      page: {
        url: location.href,
        title: document.title,
        meta: {}
      },
      sections: [],
      textContent: {}
    };

    // Page meta
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) result.page.meta.description = metaDesc.content;
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) result.page.meta.viewport = metaViewport.content;

    // Extract sections
    const sectionElements = findSections();
    for (let i = 0; i < sectionElements.length; i++) {
      const el = sectionElements[i];
      const sectionNode = walkNode(el, 0);
      if (sectionNode) {
        sectionNode.id = 'section-' + i;
        const landmark = el.getAttribute('role') || (LANDMARK_TAGS.has(el.tagName) ? el.tagName.toLowerCase() : undefined);
        if (landmark) sectionNode.landmark = landmark;
        result.sections.push(sectionNode);
      }
    }

    // Extract text content
    result.textContent = extractTextContent();

    // Check output size and chunk if needed
    const jsonStr = JSON.stringify(result);

    if (jsonStr.length > MAX_CHUNK_SIZE) {
      // Store chunks on window for retrieval
      window.__REVERSE_UI_CHUNKS = [];

      // Chunk by section
      const baseResult = {
        page: result.page,
        textContent: result.textContent,
        _sectionCount: result.sections.length
      };
      window.__REVERSE_UI_CHUNKS.push(JSON.stringify(baseResult));

      for (const section of result.sections) {
        window.__REVERSE_UI_CHUNKS.push(JSON.stringify(section));
      }

      return JSON.stringify({
        chunked: true,
        totalChunks: window.__REVERSE_UI_CHUNKS.length,
        sectionIds: result.sections.map(s => s.id),
        totalSize: jsonStr.length
      });
    }

    return jsonStr;
  } catch (e) {
    return JSON.stringify({ error: e.message, stack: e.stack });
  }
})()
