(() => {
  const MAX_SVGS = 100;
  const MAX_SVG_SIZE = 5000; // chars per SVG outerHTML

  const svgs = document.querySelectorAll('svg');
  const result = [];
  const seen = new Set();

  for (const svg of svgs) {
    if (result.length >= MAX_SVGS) break;

    // Skip invisible SVGs
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    // Build an identifier for deduplication
    const viewBox = svg.getAttribute('viewBox') || '';
    const firstPath = svg.querySelector('path');
    const pathD = firstPath ? (firstPath.getAttribute('d') || '') : '';
    const dedupKey = viewBox + '|' + pathD.substring(0, 100);

    if (seen.has(dedupKey) && dedupKey.length > 5) continue;
    seen.add(dedupKey);

    // Get the full SVG markup
    let outerHTML = svg.outerHTML;
    if (outerHTML.length > MAX_SVG_SIZE) {
      outerHTML = outerHTML.substring(0, MAX_SVG_SIZE) + '<!-- truncated -->';
    }

    // Try to identify the SVG by context
    const ariaLabel = svg.getAttribute('aria-label') || '';
    const parentClass = svg.parentElement?.classList?.[0] || '';
    const svgClass = Array.from(svg.classList).join(' ');
    const nearbyText = svg.parentElement?.textContent?.trim().substring(0, 50) || '';

    result.push({
      id: 'svg-' + result.length,
      viewBox: viewBox || undefined,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      classes: svgClass || undefined,
      ariaLabel: ariaLabel || undefined,
      parentSelector: svg.parentElement ? (svg.parentElement.tagName.toLowerCase() + (parentClass ? '.' + parentClass : '')) : undefined,
      nearbyText: nearbyText || undefined,
      outerHTML
    });
  }

  return JSON.stringify({ count: result.length, svgs: result });
})()
