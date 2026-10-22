(function (PopoGame) {
'use strict';
const { FISH_NATURAL_ATLAS } = PopoGame;

const PLAY = PopoGame.PLAY_DATA || 'assets/sprites/play.webp';
const BACKGROUNDS = PopoGame.BACKGROUND_DATA || [1, 2, 3, 4].map((n) => `assets/backgrounds/location-${n}.webp`);

const assets = {
  backgrounds: [],
  naturalFish: null,
};

const pending = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// Each background comes with a water mask (white where the surface waves may move it).
const WATER_MASKS = PopoGame.WATER_MASKS || [1, 2, 3, 4].map((n) => `assets/backgrounds/water-${n}.png`);

// the waters after the first come in their own data files (src/background-<index>.js), loaded as they are needed
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function preloadBackground(index) {
  if (!pending.has(index)) {
    const data = BACKGROUNDS[index] ? Promise.resolve() : loadScript(`src/background-${index}.js`);
    pending.set(index, data.then(() => Promise.all([loadImage(BACKGROUNDS[index]), loadImage(WATER_MASKS[index])])).then(([img, mask]) => {
      img.waterMask = mask;
      assets.backgrounds[index] = img;
      return img;
    }, (err) => {
      pending.delete(index); // let the next attempt try again
      throw err;
    }));
  }
  return pending.get(index);
}

// The generated art (assets/generated/, used whole) as the WebP copies tools/build-assets.py
// makes of it: the same pictures, a fifth of the download.
const generated = (name) => loadImage(`assets/generated-web/${name}.webp`);

// Everything the banner and the game need, reporting how much has arrived (0 to 1) as it goes.
async function loadCoreAssets(progress = () => {}) {
  let got = 0;
  const count = (all) => all.map((p) => Promise.resolve(p).then((v) => { got += 1; progress(got / all.length); return v; }));
  const [operating, winch, rope, connector, net, rowCycle, naturalFish, bg0, props, play, logo] = await Promise.all(count([
    generated('popo-operating'),
    generated('winch-arched'),
    generated('rope'),
    generated('rope-connector'),
    generated('net'),
    loadImage('assets/sprites/popo-row-cycle.webp'),
    loadImage('assets/sprites/fish-natural.webp'),
    preloadBackground(0),
    loadImage('assets/sprites/popo-props.webp'),
    loadImage(PLAY),
    loadImage('assets/sprites/logo.webp'), // the banner's logo (tools/build-assets.py --logo)
    // the canvas text (the end screen's letters) needs its font there first
    document.fonts ? document.fonts.load('700 120px Fredoka').catch(() => {}) : null,
  ]));
  assets.popoOperating = operating;
  assets.winchPolished = winch;
  assets.rope = rope;
  assets.ropeConnector = connector;
  assets.netPolished = net;
  assets.rowCycle = rowCycle;
  assets.play = play;
  assets.logo = logo;
  assets.props = props;
  assets.naturalFish = { img: naturalFish, boxes: FISH_NATURAL_ATLAS.boxes, scale: FISH_NATURAL_ATLAS.scale };
  preloadBackground(1);
  // Swiftee (four wing beats, her winter scarf baked in: Fishing Frenzy's own sheet), for the warm-up's end and her
  // welcome after the lesson; she is not needed for the banner, so she loads behind it
  loadImage('assets/sprites/swiftee.webp').then((img) => { assets.swiftee = img; }).catch(() => {});
  // the pause and final cards' panel (a CSS background) loads now, in the background, so the
  // first pause never shows a card without its frame
  loadImage('assets/generated-web/panel.webp').catch(() => {});
  return bg0;
}

Object.assign(PopoGame, { assets, preloadBackground, loadCoreAssets });
})(window.PopoGame = window.PopoGame || {});
