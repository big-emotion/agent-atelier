// The LinkedIn feed gabarit. 4:5 is the tallest ratio the feed shows without
// cropping on mobile, so it takes the most screen while the source keeps its
// own 16:9 frame: headline above, source in a framed window, captions and
// watermark below.
export const WIDTH = 1080;
export const HEIGHT = 1350;

// A 40 px margin leaves the ink ground visible on both sides, which is what
// makes the source read as a framed excerpt rather than a stretched video.
export const FRAME = { x: 40, y: 300, w: 1000, h: 562 };

// H.264 in 4:2:0 needs even picture sizes.
const even = (v) => 2 * Math.round(v / 2);

export function sourceRect(width, height) {
  const scale = Math.min(FRAME.w / width, FRAME.h / height);
  const w = even(width * scale);
  const h = even(height * scale);
  return {
    x: FRAME.x + Math.round((FRAME.w - w) / 2),
    y: FRAME.y + Math.round((FRAME.h - h) / 2),
    w,
    h,
  };
}
