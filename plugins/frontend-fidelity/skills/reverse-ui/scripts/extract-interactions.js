(() => {
  const result = {
    animationLibraries: [],
    scrollAnimations: {
      dataAttributes: [],
      scrollClasses: [],
      cssScrollTimelines: []
    },
    summary: {
      hasScrollAnimations: false,
      primaryLibrary: null,
      animatedElementCount: 0
    }
  };

  // --- a) Detect animation library globals ---

  const LIBRARY_GLOBALS = [
    { key: 'gsap', name: 'gsap' },
    { key: 'AOS', name: 'AOS' },
    { key: 'ScrollReveal', name: 'ScrollReveal' },
    { key: 'lax', name: 'lax' },
    { key: 'locomotive', name: 'locomotive' },
    { key: 'LocomotiveScroll', name: 'LocomotiveScroll' },
    { key: '__FRAMER_MOTION__', name: 'framer-motion' },
    { key: 'anime', name: 'anime.js' },
    { key: 'ScrollTrigger', name: 'ScrollTrigger' },
    { key: 'Lenis', name: 'Lenis' }
  ];

  for (const lib of LIBRARY_GLOBALS) {
    try {
      const obj = window[lib.key];
      if (obj) {
        const entry = { name: lib.name };
        if (typeof obj.version === 'string') entry.version = obj.version;
        else if (obj.VERSION) entry.version = String(obj.VERSION);
        result.animationLibraries.push(entry);
      }
    } catch (e) {}
  }

  // --- b) Scan animation data attributes ---

  const ANIM_ATTRS = [
    'data-aos', 'data-aos-delay', 'data-aos-duration', 'data-aos-easing',
    'data-scroll', 'data-scroll-speed', 'data-parallax',
    'data-reveal', 'data-animate', 'data-animation'
  ];

  const attrCounts = new Map();
  const animAttrSelector = ANIM_ATTRS.map(a => '[' + a + ']').join(',');
  const animElements = document.querySelectorAll(animAttrSelector);

  for (const el of animElements) {
    for (const attr of ANIM_ATTRS) {
      const val = el.getAttribute(attr);
      if (val !== null) {
        const key = attr + '=' + val;
        attrCounts.set(key, (attrCounts.get(key) || 0) + 1);
      }
    }
  }

  for (const [key, count] of attrCounts) {
    const eqIdx = key.indexOf('=');
    result.scrollAnimations.dataAttributes.push({
      attribute: key.substring(0, eqIdx),
      value: key.substring(eqIdx + 1),
      count
    });
  }
  result.scrollAnimations.dataAttributes.sort((a, b) => b.count - a.count);

  // --- c) Detect scroll-triggered CSS classes ---

  const SCROLL_CLASSES = [
    'aos-animate', 'is-inview', 'is-visible', 'revealed',
    'animate__animated', 'wow', 'animated', 'scroll-animate'
  ];

  for (const cls of SCROLL_CLASSES) {
    const els = document.querySelectorAll('.' + CSS.escape(cls));
    if (els.length > 0) {
      result.scrollAnimations.scrollClasses.push({
        className: cls,
        count: els.length
      });
    }
  }

  // --- d) Native CSS scroll timelines ---

  const SCROLL_TIMELINE_PROPS = ['animation-timeline', 'scroll-timeline-name', 'view-timeline-name'];

  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
    if (!rules) continue;

    const scanRules = (ruleList) => {
      for (const rule of ruleList) {
        if (rule.style) {
          for (const prop of SCROLL_TIMELINE_PROPS) {
            const val = rule.style.getPropertyValue(prop);
            if (val && val !== 'none' && val !== 'auto' && val !== '') {
              result.scrollAnimations.cssScrollTimelines.push({
                property: prop,
                value: val,
                selector: rule.selectorText || ''
              });
            }
          }
        }
        if (rule.cssRules) scanRules(rule.cssRules);
      }
    };
    scanRules(rules);
  }

  // --- Summary ---

  const totalAnimAttrElements = new Set(animElements);
  for (const { className } of result.scrollAnimations.scrollClasses) {
    for (const el of document.querySelectorAll('.' + CSS.escape(className))) {
      totalAnimAttrElements.add(el);
    }
  }

  result.summary.animatedElementCount = totalAnimAttrElements.size;
  result.summary.hasScrollAnimations =
    result.scrollAnimations.dataAttributes.length > 0 ||
    result.scrollAnimations.scrollClasses.length > 0 ||
    result.scrollAnimations.cssScrollTimelines.length > 0;

  if (result.animationLibraries.length > 0) {
    result.summary.primaryLibrary = result.animationLibraries[0].name;
  }

  return JSON.stringify(result);
})()
