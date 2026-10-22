// =====================================================================
// COSTUME — Swiftee's underwater look, composited onto every frame she is drawn with (js/swiftee.js, js/walker.js):
// her diving mask and snorkel (js/dive-mask.js, registered to her eyes by js/mask-anchors.js), as in Fishing Frenzy's
// lesson. The bird and the mask are put together on a working canvas first, then drawn once, so the two fade and move
// as one picture; a wing raised in front of her face is redrawn over the mask (js/scarf-occlusion.js: the wing pixels
// of each frame, packed as runs of rectangles), so the mask never covers it.
// =====================================================================
(function () {
  // working canvases, one pair per cell size (the mascot's 256 or 512, the tape walk's 512), so none is reallocated
  const pads = new Map();
  const pad = (cell) => {
    let p = pads.get(cell);
    if (!p) {
      p = { costume: document.createElement('canvas'), foreground: document.createElement('canvas') };
      p.costume.width = p.costume.height = p.foreground.width = p.foreground.height = cell;
      pads.set(cell, p);
    }
    return p;
  };
  const wingPaths = new Map();
  window.Costume = {
    // draw sheet cell (sx, sy, cell) of `source` - frame `frame` of animation `anim` - into ctx at x, y, width, height
    frame(ctx, source, sx, sy, cell, anim, frame, x, y, width, height) {
      const { costume, foreground } = pad(cell);
      const c = costume.getContext('2d');
      c.clearRect(0, 0, cell, cell);
      c.drawImage(source, sx, sy, cell, cell, 0, 0, cell, cell);
      if (window.DiveMask) DiveMask.draw(c, anim, frame, cell);
      const masks = window.SWIFTEE_SCARF_OCCLUSION;
      const poses = masks && masks.frames[anim];
      const packed = poses && masks.masks[poses[frame]];
      if (packed) {
        const key = anim + ':' + frame + ':' + cell;
        let path = wingPaths.get(key);
        if (!path) {
          path = new Path2D();
          const bytes = atob(packed), k = cell / 256;
          for (let i = 0; i < bytes.length; i += 4) {
            path.rect(bytes.charCodeAt(i) * k, bytes.charCodeAt(i + 1) * k, bytes.charCodeAt(i + 2) * k, bytes.charCodeAt(i + 3) * k);
          }
          if (wingPaths.size >= 160) wingPaths.delete(wingPaths.keys().next().value);
          wingPaths.set(key, path);
        }
        // the wing's edge feathered by half a source pixel: a hard clip would leave stair steps across the mask
        const front = foreground.getContext('2d');
        front.clearRect(0, 0, cell, cell);
        front.save();
        front.fillStyle = '#fff';
        front.filter = 'blur(' + (cell / 512) + 'px)';
        front.fill(path);
        front.filter = 'none';
        front.globalCompositeOperation = 'source-in';
        front.drawImage(source, sx, sy, cell, cell, 0, 0, cell, cell);
        front.restore();
        c.drawImage(foreground, 0, 0);
      }
      ctx.drawImage(costume, x, y, width, height);
    }
  };
})();
