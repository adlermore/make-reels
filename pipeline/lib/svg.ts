/** Static checks for agent-written SVG illustrations (the renderer also sanitises at load time). */
export function prepareSvgCheck(svg: string): string | null {
  if (!/<svg[\s>]/i.test(svg)) return 'not an SVG document';
  if (/<script/i.test(svg)) return 'contains <script> — not allowed';
  if (/\son[a-z]+\s*=/i.test(svg)) return 'contains event handler attributes (on*) — not allowed';
  if (/(href|xlink:href)\s*=\s*["']\s*(https?:|javascript:)/i.test(svg)) return 'references external/javascript URLs — embed everything inline';
  if (!/viewBox\s*=/.test(svg)) return 'missing viewBox — required for scaling';
  if (/<(?:path|line|circle|rect|polyline|polygon|ellipse)(?=[\s/>])[^>]*\sstyle\s*=/i.test(svg)) return 'shapes must use presentation attributes (stroke=, fill=…), not style="" — the engine sets its own style for the draw-on order';
  if (svg.length > 400_000) return 'too large (> 400 KB) — simplify the drawing';
  return null;
}
