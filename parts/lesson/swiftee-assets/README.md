# Swiftee's sprite sheets

Only the sheets the game plays are here, listed in `../js/swiftee-manifest.js`. Swiftee's full animation library (every
expression, the atlas manifest, the source drawings) and the tools that shipped it are in git history at commit 2687c66.

```
spritesheets/1x/swiftee_<anim>@1x.webp   one sheet per animation, 256 × 256 cells
spritesheets/2x/swiftee_<anim>@2x.webp   the same at 512 × 512 (used when Swiftee is drawn larger than 300 device px)
extra/swiftee_measuring@1x|2x.webp       the tape-measure walk (screen 16)
```

- Every frame of every animation sits in the same cell size with the character centred, so any frame can follow any
  other without a jump. Frames run left to right, then top to bottom: frame `i` is at column `i % cols`, row
  `floor(i / cols)`. 20 fps.
- The game plays each expression's loop and cross-fades between them; talking also plays its start and stop clips,
  which open and close the beak.

After changing a sheet, rebuild the scarf data (Pillow): `python3 tools/build-scarf-anchors.py` and
`python3 tools/build-scarf-occlusion.py`.

## The winter scarf

The scarf is one transparent accessory, `../assets/images/winter-scarf-flat.webp` (768 px, lossless), drawn over every
frame by `../js/winter-scarf.js`. It follows the frame's neck position and rotation at both resolutions, including the
tape walk and all eight protractor poses. The still image under the canvas wears it too. `winter-scarf.js` composites
it with the bird before applying scene opacity, and redraws the foreground wings over it using
`../js/scarf-occlusion.js`, so it never covers a raised wing or fades as a separate layer. Blinking uses a fixed neck
anchor, so eyelid changes do not move the scarf.

`../js/scarf-anchors.js` registers the scarf on every shipped frame, the protractor sheet and the still image;
`../js/scarf-occlusion.js` stores each frame's foreground wings (repeated masks stored once). Left-facing protractor
poses mirror the accessory.

Open `../qa/animations.html` to play or scrub every shipped clip at 1x or 2x.
