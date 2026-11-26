/*! scene.js · the scroll engine of the Atelier (RubberDuck, 3 Nov 2026). Written by RubberDuck into atelier/shared/ of
 *  every project: pages load it and never edit it.
 *
 *  Motion tied to the scroll, driven by JavaScript so that it looks the same in every browser the public has: Safari
 *  on any iPhone since iOS 13, Chrome, Firefox, Samsung Internet, Edge. CSS scroll-driven animations (animation-timeline,
 *  view-timeline) exist only on iOS 26, Chrome 115 and Firefox 159: a quarter of the iPhones showed nothing at all
 *  (3 Nov 2026, Ammiraglio: «deve essere visibile correttamente a tutti»). The technique is Apple's own on its product
 *  pages: the browser scrolls (sticky stages, on the compositor), a script reads the position once per frame and seeks
 *  every piece there. Three kinds of pieces:
 *
 *  · CSS keyframes seeked by the scroll. An element with `data-range="a b"` (percent of its scene; several pairs, one
 *    per animation of its animation-name list) or `data-view="entry 0 70"` (its own entry into the screen: cover,
 *    contain, entry, exit, entry-crossing, exit-crossing) has ordinary CSS animations (`animation: name 1s linear both
 *    paused`); the engine pauses them and sets their currentTime from the scroll through the Web Animations API, so the
 *    browser interpolates transforms, opacity, colours as it always does. Pseudo-elements included.
 *  · Frame sequences on a canvas: `<canvas data-frames="../assets/fly-%02d.webp" data-count="40" data-range="0 23">`.
 *    The engine fetches the frames when the scene comes near (coarse to fine, so a half-loaded sequence still plays),
 *    decodes them once (ImageBitmap), draws the right one on the canvas at each position, and frees them when the scene
 *    is far. `data-poses="x,y,s;…"` (the object's anchor and scale in each frame; a leading p: the frame's position in
 *    the range, 0…1) makes the move between two frames continuous: the frame slides and scales toward the next one
 *    (`data-blend="cut"`, the default) or crossfades into it (`data-blend="cross"`).
 *  · Flags: `data-on="x1 20; x2 44"` adds class `x1` to the element past 20 % of the scene (and takes it away before);
 *    `data-view-on="go entry 40"` the same on the element's own entry. A class starts the timed CSS animations the
 *    page writes for it (a message that slides in, a price that drops): what happens there is CSS, in real time.
 *    A timed entrance is never seen undone (25 Nov 2026, motore v11): a ready flag (`rdy entry -10`: a point at 0 or
 *    before on entry, cover or entry-crossing) holds from the engine's start, so everything below the screen waits in
 *    its pose; the others are judged on the real position against the whole screen (the glass bar's strip included)
 *    and come off only once the piece is wholly below it again; a piece on screen as the engine starts keeps its look
 *    (see «timed entrances»).
 *  · `data-bob="8px 1.6deg 5.2s 7.4s"`: an idle float (translate, rotate) whose amplitude goes from 1 to 0 over the
 *    element's `data-range`.
 *  · `data-play="76% 4s"` on a scene: a guided play, the Atelier's standard for a scroll-triggered scene («the
 *    presentation rule», 6 Nov 2026); `data-play="40% 3s; 82% 4s"`: chapters, the slides of a presentation. The stops
 *    cut the scene into stretches between rests (its start, then each stop). Inside the scene the visitor's scroll
 *    never moves the page: it says «on» or «back», and the stretch plays whole, at its own pace (4 s for the whole
 *    scene, less for a shorter stretch), the same for a long flick and for a touch of the wheel, at once with the
 *    gesture. One scroll is one slide, always (20 Nov 2026): a gesture the same way while a stretch plays is never
 *    lost, it books the next stretch, which plays as soon as this one rests (past the scene's last one the page goes
 *    on); three separate ones and what is left passes in about 0.7 s (insistence). One the other way turns it around,
 *    a finger held still on the screen (a pressed mouse button) freezes it until released. The scroll that brings the
 *    scene into view is its first gesture (the approach): once half the window shows the scene the engine takes it,
 *    the section glides into place and the first stretch plays; back from the first stop the scene glides out the
 *    same way. A scroll that enters with all its momentum is taken as it enters, and the momentum ends there (on an
 *    iPhone with a smooth scroll of the engine's: the one thing that ends it, see «the guided play»). A scene of two
 *    stops or more shows its slides (the indicator: a segment per stretch, filling as it plays, between an arrow back
 *    and an arrow on that nudges when it waits for a scroll; a tap on an arrow is one scroll that way): at the bottom
 *    of its stage on a phone, standing at its right edge on a wider screen. Out of the scene's ends, and past its last
 *    stop, the page scrolls as everywhere. Never without a gesture of the visitor's (tests make none).
 *  · The browser's bars (4 Nov 2026): Safari 26 paints a block behind its bar in the colour of the fixed box it finds
 *    at that edge of the window, and clear glass over the page when it finds none. At the bottom an invisible fixed
 *    «shield» makes it find nothing: glass over the page, as on apple.com. At the top a strip in the colour the page
 *    shows there (its header) gives the clock a solid ground of that colour (on a touch screen and in the Anteprima's
 *    phone; on a computer, where no bar sits over the page, it stays clear); theme-color follows it for the other
 *    browsers. `--under` on <html> is how far the page is seen under the bar, past the bottom of its small window:
 *    a pinned stage paints that far (see «the browser's bars» below).
 *  · The pin under the glass (6 Nov 2026): that Safari shows under its bar only what scrolls with the page; a sticky
 *    or fixed box is cut at the window's edge, a pinned stage with it, and the section's ground shows below («un
 *    blocco bianco» under every animated scene). There the engine holds the stages itself: in the flow, moved by a
 *    scroll timeline, drawn under the bar like the rest of the page (`<html data-pin="sticky">` leaves them sticky,
 *    `data-pin="scroll"` holds them this way in any browser that can). And where a layer of a stage stops short of
 *    the bottom of the screen, the section's ground takes its colour: never a band of another colour under the bar.
 *
 *  A scene is `<section data-scene data-section="name">`: a tall section with a sticky stage inside (the first
 *  descendant with position: sticky). Its progress is 0 when the stage pins and 1 when it unpins; `data-lead="60svh"`
 *  starts it that much before the pin. Pieces outside the section follow it with `data-range="@name a b"`.
 *
 *  The Atelier's canvas and Claude's plain shots do not run scripts: beats.ts lays the same scenes out as storyboards
 *  from these very attributes (same math). The Anteprima, the phone, `look {scene}` and `check` run this file. */
(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.rd || window.__rdScene) return // the Atelier's own windows draw the page as a print; loaded twice: once
  var D = 1000 // every seeked animation lasts 1000 ms: currentTime = progress × 1000
  var RANGE_NAMES = { cover: 1, contain: 1, entry: 1, exit: 1, 'entry-crossing': 1, 'exit-crossing': 1 }
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v }
  var num = function (s, d) { var v = parseFloat(s); return isNaN(v) ? d : v }
  var scenes = [], tracks = [], seqs = [], bobs = []
  var vh = 0, svh = 0, lastY = -1, force = true, raf = 0, idleRaf = 0, firstDrawn = false, t0 = Date.now()
  // The shown position follows the real one with a short trail (ms). A finger's scroll reaches the page in bursts (iOS
  // tells the page where it is in uneven steps while the stage glides on the compositor) and seeking every piece to each
  // burst looked like a stutter at 60 fps, while a play the engine drives itself was smooth (3 Nov 2026, Ammiraglio:
  // «gli stuttering avvengono solamente quando lo scrollytelling è controllato dallo scroll delle dita»). The trail
  // evens the bursts out, as Lenis does for the whole page; a jump (an anchor, a restore) is taken at once.
  var SMOOTH = 90, ys = -1, lastYs = -1, lastT = 0

  // ---------- units ----------
  function probe(h) { // px of a CSS length on this window (100svh with Safari's bars in)
    var e = document.createElement('div')
    e.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;height:' + h
    document.body.appendChild(e)
    var v = e.offsetHeight
    document.body.removeChild(e)
    return v
  }
  function lengthPx(s) { // "60svh" | "200px" | "30vh" | "30"
    var m = /^\s*(-?[\d.]+)\s*([a-z%]*)\s*$/i.exec(s || '')
    if (!m) return 0
    var v = parseFloat(m[1]), u = m[2].toLowerCase()
    if (u === 'svh' || u === 'dvh') return v * svh / 100
    if (u === 'vh' || u === 'lvh' || u === '%') return v * vh / 100
    return v
  }

  // ---------- the pieces ----------
  function sceneOf(el) { // the scene an element belongs to: "@name" in its ranges, else the enclosing [data-scene]
    for (var p = el; p; p = p.parentElement) if (p.hasAttribute('data-scene')) return p.__rdScene || null
    return null
  }
  function sceneNamed(name) {
    for (var i = 0; i < scenes.length; i++) if (scenes[i].name === name) return scenes[i]
    return null
  }
  /** "a b, a b" → [[a, b]…] in 0…1; a leading "@name" names the scene. */
  function parseRanges(s, into) {
    var out = [], sc = null
    var text = s || ''
    var m = /^\s*@([\w-]+)\s*/.exec(text)
    if (m) { sc = sceneNamed(m[1]); text = text.slice(m[0].length) }
    text.split(',').forEach(function (part) {
      var nums = part.trim().split(/\s+/).map(Number).filter(function (v) { return !isNaN(v) })
      if (nums.length >= 2) out.push([nums[0] / 100, nums[1] / 100])
    })
    into.scene = sc
    return out
  }
  /** "entry 0 70, cover 22 44" → [{name, a, b}] in 0…1 (name optional: cover). */
  function parseViews(s) {
    var out = []
    ;(s || '').split(',').forEach(function (part) {
      var w = part.trim().split(/\s+/)
      if (!w[0]) return
      var name = 'cover', i = 0
      if (RANGE_NAMES[w[0]]) { name = w[0]; i = 1 }
      var a = num(w[i], 0), b = num(w[i + 1], 100)
      out.push({ name: name, a: a / 100, b: b / 100 })
    })
    return out
  }
  /** "x1 20; x2 44" → [{cls, at}] (at in 0…1); for views "go entry 40" → [{cls, name, at}]. */
  function parseFlags(s, view) {
    var out = []
    ;(s || '').split(';').forEach(function (part) {
      var w = part.trim().split(/\s+/)
      if (w.length < 2) return
      var cls = w[0], i = 1, name = 'cover'
      if (view && RANGE_NAMES[w[1]]) { name = w[1]; i = 2 }
      var at = num(w[i], NaN)
      if (!isNaN(at)) out.push({ cls: cls, name: name, at: at / 100, ready: !!view && at <= 0 && (name === 'entry' || name === 'cover' || name === 'entry-crossing'), on: false })
    })
    return out
  }

  /** What the seeked animations move: 'transform' (any of the transform family), 'opacity', or '' (colours, custom properties). */
  function movedBy(anims) {
    var out = ''
    for (var i = 0; i < anims.length; i++) {
      var kfs = []
      try { kfs = anims[i].a.effect.getKeyframes() } catch (e) { /* */ }
      for (var k = 0; k < kfs.length; k++) for (var key in kfs[k]) { if (/^(transform|translate|rotate|scale|offset)/.test(key)) return 'transform'; if (key === 'opacity') out = 'opacity' }
    }
    return out
  }
  /** The CSS animations of an element (its pseudo-elements included), in the order of each animation-name list, made
   *  the engine's (1000 ms, paused). */
  function animationsOf(el) { return tame(animsIn(el)) }
  /** The same, only read. A page's pieces are read all first and changed all after (collect): a change between two
   *  reads makes the browser restyle the whole page before the second, once per piece (23 Nov 2026: 117 restyles, a
   *  sixth of a second on a slow phone, while RealMyEstate's page opened). */
  function animsIn(el, byTarget) {
    var list
    if (byTarget) list = byTarget.get(el) || []
    else { try { list = el.getAnimations({ subtree: true }) } catch (e) { try { list = el.getAnimations() } catch (e2) { list = [] } } }
    var out = [], byPseudo = {}
    for (var i = 0; i < list.length; i++) {
      var a = list[i], eff = a.effect
      if (!eff || eff.target !== el) continue
      if (typeof CSSAnimation !== 'undefined' && !(a instanceof CSSAnimation)) continue
      var ps = eff.pseudoElement || ''
      if (!byPseudo[ps]) { byPseudo[ps] = getComputedStyle(el, ps || null).animationName.split(',').map(function (x) { return x.trim() }) }
      var names = byPseudo[ps], k = names.indexOf(a.animationName)
      out.push({ a: a, index: k < 0 ? 0 : k, last: -2 })
    }
    return out
  }
  function tame(out) {
    for (var j = 0; j < out.length; j++) {
      var it = out[j]
      try { it.a.effect.updateTiming({ duration: D, delay: 0, endDelay: 0, iterations: 1, fill: 'both' }) } catch (e) { /* as it is */ }
      try { it.a.pause() } catch (e) { /* as it is */ }
    }
    return out
  }

  function collect() {
    scenes = []; tracks = []; seqs = []; bobs = []
    var secs = document.querySelectorAll('[data-scene]')
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i]
      var sc = { el: sec, name: sec.getAttribute('data-section') || sec.getAttribute('data-scene') || sec.id || String(i), stage: null, stickTop: 0, lead: 0, top: 0, hS: 0, pin: 0, travel: 0, p: 0, play: null, pinAnim: null, pinWas: null, pinAt: null, shift: 0, ownMove: false, ground: null, groundWas: '', groundOwn: '', tint: '' }
      // one stop (`76% 4s`) or several (`40% 3s; 82% 4s`): the chapters («a tappe»), each played by the next scroll
      var stops = []
      ;(sec.getAttribute('data-play') || '').split(';').forEach(function (part) {
        var pl = /^\s*([\d.]+)%?(?:\s+([\d.]+)s)?/.exec(part)
        if (pl) stops.push({ to: Math.min(1, parseFloat(pl[1]) / 100), ms: (parseFloat(pl[2]) || 4) * 1000 })
      })
      stops.sort(function (a, b) { return a.to - b.to })
      if (stops.length) sc.play = stops
      // the play's own stops: the page's, after the approach when the scene has one (measure)
      sc.stops = sc.play; sc.ap = 0; sc.steps = null
      var all = sec.querySelectorAll('*')
      for (var j = 0; j < all.length; j++) if (getComputedStyle(all[j]).position === 'sticky') { sc.stage = all[j]; break }
      sec.__rdScene = sc
      scenes.push(sc)
      if (sc.play && sc.play.length > 1 && sc.stage) makeSteps(sc)
    }
    var els = document.querySelectorAll('[data-range],[data-view],[data-on],[data-view-on],[data-bob],canvas[data-frames]')
    var moving = [], layers = [] // read all first, change all after (animsIn)
    // the page's animations asked for once, by element: one walk of them all, not one per piece (each piece's own
    // question walked every animation of the page again: 85 ms of a slow phone's CPU on RealMyEstate's desktop page)
    var byTarget = null
    try {
      if (typeof document.getAnimations === 'function' && typeof Map === 'function') {
        byTarget = new Map()
        var every = document.getAnimations()
        for (var ai = 0; ai < every.length; ai++) { var tg = every[ai].effect && every[ai].effect.target; if (!tg) continue; var tl = byTarget.get(tg); if (!tl) byTarget.set(tg, tl = []); tl.push(every[ai]) }
      }
    } catch (e) { byTarget = null }
    for (var k = 0; k < els.length; k++) {
      var el = els[k]
      var isSeq = el.tagName === 'CANVAS' && el.hasAttribute('data-frames')
      var t = { el: el, scene: sceneOf(el), ranges: [], views: [], flags: [], viewFlags: [], anims: null, top: 0, h: 0, inStage: null, topInStage: 0 }
      if (el.hasAttribute('data-range')) { var into = {}; t.ranges = parseRanges(el.getAttribute('data-range'), into); if (into.scene) t.scene = into.scene }
      if (el.hasAttribute('data-view')) t.views = parseViews(el.getAttribute('data-view'))
      if (el.hasAttribute('data-on')) t.flags = parseFlags(el.getAttribute('data-on'), false)
      if (el.hasAttribute('data-view-on')) t.viewFlags = parseFlags(el.getAttribute('data-view-on'), true)
      if (isSeq) { var q = makeSeq(el, t); if (q) seqs.push(q); continue }
      if (el.hasAttribute('data-bob')) { var w = el.getAttribute('data-bob').trim().split(/\s+/); bobs.push({ t: t, y: lengthPx(w[0] || '8px'), deg: num(w[1], 1.6), ty: num(w[2], 5.2) * 1000, tr: num(w[3], 7.4) * 1000, amp: 1 }); layers.push([el, 'transform']) }
      if (t.ranges.length || t.views.length) { t.anims = animsIn(el, byTarget); moving.push(t) }
      tracks.push(t)
    }
    for (var p = 0; p < moving.length; p++) tame(moving[p].anims)
    for (var p2 = 0; p2 < moving.length; p2++) layers.push([moving[p2].el, movedBy(moving[p2].anims)])
    // a compositing layer of its own for each piece the engine moves (a paused, seeked animation does not count as
    // running for WebKit, which would otherwise repaint the piece and everything inside it every frame), unless the
    // page set will-change itself: all the reads, then all the writes; a piece takes the first layer asked for it
    var need = [], seen = []
    for (var l = 0; l < layers.length; l++) {
      var le = layers[l][0], lw = layers[l][1]
      if (!lw || seen.indexOf(le) >= 0) continue
      try { if (!le.style.willChange && getComputedStyle(le).willChange === 'auto') { seen.push(le); need.push([le, lw]) } } catch (e) { /* */ }
    }
    for (var n2 = 0; n2 < need.length; n2++) need[n2][0].style.willChange = need[n2][1]
  }

  // ---------- geometry (page px; stages measured as if they did not stick) ----------
  function pageTop(el) { return el.getBoundingClientRect().top + (window.pageYOffset || 0) }
  function measure() {
    setUnder()
    var wide = !!(window.matchMedia && window.matchMedia('(min-width:700px)').matches)
    if (wide !== stepsWide) { stepsWide = wide; for (var sw = 0; sw < scenes.length; sw++) if (scenes[sw].steps) scenes[sw].steps.last = [] } // the slides' segments turned: every fill written again
    peScan = 0 // the page may have changed: the boxes a hit test skips are looked for again at the next read
    vh = window.innerHeight - insetB
    svh = insetB ? window.innerHeight - (underTold >= 0 ? underTold : insetB) : probe('100svh') || vh
    var undo = []
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i], st = sc.stage
      if (!st) continue
      sc.shift = 0
      if (sc.pinAnim) {
        // held by the scroll: measured as it is, less what the timeline has moved it by now. The hold is never taken
        // off for a measure: a new one takes a few frames to reach the compositor, and the stage showed for those
        // frames where it lies in the flow, a flash (seen on video, 6 Nov 2026)
        var kept = [st.style.position, st.style.top]
        st.style.position = sc.pinWas[0]; st.style.top = sc.pinWas[1]
        sc.stickTop = parseFloat(getComputedStyle(st).top) || 0
        st.style.position = kept[0]; st.style.top = kept[1]
        var mv = /^\s*(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?/.exec(getComputedStyle(st).translate || '')
        sc.shift = mv ? parseFloat(mv[2] || '0') || 0 : 0
        continue
      }
      var cs = getComputedStyle(st)
      sc.stickTop = parseFloat(cs.top) || 0
      sc.ownMove = !!cs.translate && cs.translate !== 'none'
      undo.push([st, st.style.position, st.style.top])
      st.style.position = 'relative'
      st.style.top = 'auto'
    }
    try {
      var all = tracks.concat(seqs.map(function (q) { return q.t }), bobs.map(function (b) { return b.t }))
      for (var j = 0; j < scenes.length; j++) {
        var s = scenes[j], sec = s.el, stage = s.stage || sec
        var secTop = pageTop(sec), pcs = getComputedStyle(sec)
        var contentBottom = secTop + (parseFloat(pcs.borderTopWidth) || 0) + sec.clientHeight - (parseFloat(pcs.paddingBottom) || 0)
        s.top = pageTop(stage) - (s.shift || 0)
        s.hS = stage.offsetHeight
        s.lead = lengthPx(sec.getAttribute('data-lead'))
        if (s.stage) {
          s.pin = s.top - s.stickTop
          s.travel = Math.max(0, Math.floor(contentBottom - (s.top + s.hS + (parseFloat(getComputedStyle(stage).marginBottom) || 0))))
        } else { s.pin = secTop; s.travel = Math.max(0, sec.offsetHeight - vh) }
      }
      // the approach (20 Nov 2026): a scene with data-play takes the scroll that brings it into view from where half the
      // window shows it (never above the end of the scene before it, nor above the top of the page), and plays it as
      // the first part of its first stretch: one scroll starts the presentation, the section gliding into place
      for (var a2 = 0, prevEnd = 0; a2 < scenes.length; a2++) {
        var sa = scenes[a2]
        if (sa.play) {
          var ap = Math.max(0, Math.min(APPROACH * vh, sa.pin - sa.lead - prevEnd))
          sa.ap = ap >= 24 ? Math.floor(ap) : 0
          sa.stops = sa.ap ? [{ to: 0, ms: 0, ap: true }].concat(sa.play) : sa.play
        }
        prevEnd = Math.max(prevEnd, sa.pin + sa.travel)
      }
      for (var k = 0; k < all.length; k++) {
        var t = all[k], r = t.el.getBoundingClientRect()
        t.top = r.top + (window.pageYOffset || 0)
        t.h = r.height
        t.inStage = null
        for (var m = 0; m < scenes.length; m++) {
          var ms = scenes[m]
          if (!ms.stage || !ms.stage.contains(t.el)) continue
          t.top -= ms.shift || 0 // inside a stage the scroll holds (or that stage itself): where it lies in the flow
          if (ms.stage !== t.el) { t.inStage = ms; t.topInStage = t.top - ms.top }
          break
        }
      }
      for (var n = 0; n < seqs.length; n++) fit(seqs[n])
      quietSnaps()
    } finally {
      for (var u = 0; u < undo.length; u++) { undo[u][0].style.position = undo[u][1]; undo[u][0].style.top = undo[u][2] }
    }
    for (var w = 0; w < scenes.length; w++) pinScene(scenes[w])
    force = true
  }
  // ---- the pin under the glass ----
  // Safari on an iPhone since iOS 26 draws the page on under its glass bar, but only what scrolls with it: a sticky or
  // a fixed box is cut at the edge of the window, even one on its way in, and whatever lies behind it in the flow (the
  // section's ground) shows under the bar instead. Seen in Safari 27 itself (the iOS simulator, 6 Nov 2026): a pinned
  // stage painting 100 px past the window was cut all the same, and Aircade's dark hero stood on a band of the
  // section's cream («un blocco bianco totalmente a caso», under every animated scene and nowhere else). So there the
  // engine holds the stage itself: the stage goes back into the flow (position: relative) and a scroll timeline moves
  // it down by what the page has scrolled between the pin and the unpin, on the compositor, like the scroll: it stays
  // where sticky kept it (the same px in every frame of a finger's flick, measured on video) and Safari draws it under
  // the bar like any other part of the page. Only where scroll timelines run off the main thread (Safari 26.4): before,
  // the stage would shake as the finger moves, so it stays sticky and the ground's tint (below) covers for it.
  var pinTl = null, pinBroken = false
  /** Safari on an iPhone, 26 or later (Liquid Glass: the page drawn under its bar, sticky boxes cut at the window):
   *  its version as major + minor / 100 (26.4 → 26.04); 0 anywhere else. */
  function glass() {
    try {
      var ua = navigator.userAgent, m = /Version\/(\d+)(?:\.(\d+))?/.exec(ua)
      if (!/iP(hone|od)/.test(ua) || !m || +m[1] < 26 || !/Safari\//.test(ua) || /(CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo)\//.test(ua)) return 0
      return +m[1] + (+m[2] || 0) / 100
    } catch (e) { return 0 }
  }
  function pinByScroll() {
    var told = document.documentElement.getAttribute('data-pin')
    if (told === 'sticky' || pinBroken || typeof ScrollTimeline !== 'function' || typeof Element.prototype.animate !== 'function') return false
    return told === 'scroll' || glass() >= 26.04
  }
  function unpin(sc) {
    if (!sc.pinAnim) return
    try { sc.pinAnim.cancel() } catch (e) { /* gone */ }
    sc.pinAnim = null
    sc.stage.style.position = sc.pinWas[0]; sc.stage.style.top = sc.pinWas[1]
  }
  /** The stage held by the scroll: translate = how far the page is past the pin, from 0 to the scene's travel. A hold
   *  already there is left alone while the scene has not moved or changed length, and corrected in place when it has. */
  function pinScene(sc) {
    var st = sc.stage
    if (!st) return
    if (!(sc.travel > 0) || sc.ownMove || !pinByScroll()) { unpin(sc); return }
    var from = Math.max(0, sc.pin), to = sc.pin + sc.travel
    if (sc.pinAnim && Math.abs(sc.pinAt[0] - sc.pin) < 0.5 && Math.abs(sc.pinAt[1] - sc.travel) < 0.5) return
    var frames = [{ translate: '0px ' + (from - sc.pin) + 'px' }, { translate: '0px ' + sc.travel + 'px' }]
    try {
      if (sc.pinAnim) { sc.pinAnim.effect.setKeyframes(frames); sc.pinAnim.rangeStart = from + 'px'; sc.pinAnim.rangeEnd = to + 'px' }
      else {
        if (!pinTl) pinTl = new ScrollTimeline({ source: document.scrollingElement || document.documentElement, axis: 'block' })
        sc.pinWas = [st.style.position, st.style.top]
        st.style.position = 'relative'; st.style.top = 'auto'
        sc.pinAnim = st.animate(frames, { timeline: pinTl, rangeStart: from + 'px', rangeEnd: to + 'px', fill: 'both', easing: 'linear' })
      }
      sc.pinAt = [sc.pin, sc.travel]
    } catch (e) { unpin(sc); if (st.style.position === 'relative' && sc.pinWas) { st.style.position = sc.pinWas[0]; st.style.top = sc.pinWas[1] } pinBroken = true }
  }
  var snapOff = [] // the page's snap points inside the stretches of a guided play, switched off: [element, its inline value]
  var snapLive = false, snapWas = null // the page snaps and has snap points elsewhere; its inline values while snapping is off
  /** Inside the stretches of a guided play the rests are the engine's: the scene's start and each stop. A snap point of
   *  the page there (on a rest too) pulls a small scroll back to where it was, the last thing the page does is then
   *  a move the other way, and the play does not start or starts the wrong way (6 Nov 2026). So the snap points of a
   *  scene from its start to its last stop are off; those past the last stop, where the scroll scrubs, stay. */
  function quietSnaps() {
    snapsOff(false) // the page's own values are read below; capture() puts it back
    snapLive = false
    for (var i = 0; i < snapOff.length; i++) snapOff[i][0].style.scrollSnapAlign = snapOff[i][1]
    snapOff = []
    if (!document.body) return
    var snaps = function (el) { var v = getComputedStyle(el).scrollSnapType; return !!v && v.indexOf('none') !== 0 }
    var any = false
    for (var j = 0; j < scenes.length; j++) if (scenes[j].play) { any = true; break }
    if (!any || !(snaps(document.documentElement) || snaps(document.body))) return
    var y0 = window.pageYOffset || 0
    for (var k = 0; k < scenes.length; k++) {
      var sc = scenes[k]
      if (!sc.play) continue
      var a = sc.pin - sc.lead, b = a + sc.play[sc.play.length - 1].to * (sc.travel + sc.lead)
      var all = sc.el.getElementsByTagName('*')
      for (var m = 0; m < all.length; m++) {
        var el = all[m], al = getComputedStyle(el).scrollSnapAlign
        if (!al || /^(none\s*)+$/.test(al)) continue
        var top = el.getBoundingClientRect().top + y0
        if (top >= a - 2 && top <= b + 2) { snapOff.push([el, el.style.scrollSnapAlign]); el.style.scrollSnapAlign = 'none' }
      }
    }
    var every = document.body.getElementsByTagName('*')
    for (var e = 0; e < every.length; e++) { var ea = getComputedStyle(every[e]).scrollSnapAlign; if (ea && !/^(none\s*)+$/.test(ea)) { snapLive = true; break } }
  }
  /** The page's own snapping off, on a page that still has live snap points: Chrome re-snaps on every scrollTo near
   *  one, and would pull the play off its course. Never written without need: it re-styles the whole page. */
  function snapsOff(on) {
    var root = document.documentElement, body = document.body
    if (on && snapLive) {
      if (snapWas) return
      snapWas = [root.style.scrollSnapType, body ? body.style.scrollSnapType : '']
      root.style.scrollSnapType = 'none'; if (body) body.style.scrollSnapType = 'none'
    } else if (snapWas) { root.style.scrollSnapType = snapWas[0]; if (body) body.style.scrollSnapType = snapWas[1]; snapWas = null }
  }
  /** Where the stage's top is on screen at scroll y (it sticks between pin and pin + travel). */
  function stageViewTop(sc, y) { return y <= sc.pin ? sc.top - y : y <= sc.pin + sc.travel ? sc.stickTop : sc.top + sc.travel - y }
  function viewTop(t, y) { return t.inStage ? stageViewTop(t.inStage, y) + t.topInStage : t.top - y }
  /** The element's progress on its own view timeline, for a named range (as CSS view() ranges): 0…1, unclamped. */
  function viewProgress(t, y, name, a, b) {
    var top = viewTop(t, y), H = t.h // the box on screen: enters at top = vh, leaves at top = -H
    var c0 = Math.min(vh - H, 0), c1 = Math.max(vh - H, 0) // 'contain' edges in terms of top (longer boxes: the two swap)
    var r0, r1
    switch (name) {
      case 'contain': r0 = c1; r1 = c0; break
      case 'entry': r0 = vh; r1 = c1; break
      case 'exit': r0 = c0; r1 = -H; break
      case 'entry-crossing': r0 = vh; r1 = vh - H; break
      case 'exit-crossing': r0 = 0; r1 = -H; break
      default: r0 = vh; r1 = -H // cover
    }
    var from = r0 + (r1 - r0) * a, to = r0 + (r1 - r0) * b
    return to === from ? (top <= from ? 1 : 0) : (top - from) / (to - from)
  }

  // ---------- frame sequences ----------
  function makeSeq(c, t) {
    // the frames: files and patterns, space separated (`bot-empty.webp bot-%02d.webp`); a pattern expands to data-count
    var parts = (c.getAttribute('data-frames') || '').trim().split(/\s+/).filter(Boolean), count = Math.max(0, Math.floor(num(c.getAttribute('data-count'), 0)))
    var urls = []
    for (var pi = 0; pi < parts.length; pi++) {
      var pattern = parts[pi]
      if (!/%0?\d*d/.test(pattern)) { urls.push(pattern); continue }
      for (var i = 0; i < count; i++) urls.push(pattern.replace(/%(0?)(\d*)d/, function (m, z, w) { var s = String(i); var width = parseInt(w || '0', 10); while (s.length < width) s = '0' + s; return s }))
    }
    count = urls.length
    if (!count) return null
    var poses = [], raw = (c.getAttribute('data-poses') || '').split(';')
    for (var j = 0; j < raw.length; j++) { var v = raw[j].trim(); if (!v) continue; var nums = v.split(',').map(Number); if (nums.length === 1) poses.push({ p: nums[0] }); else if (nums.length === 3) poses.push({ x: nums[0], y: nums[1], s: nums[2] }); else if (nums.length >= 4) poses.push({ p: nums[0], x: nums[1], y: nums[2], s: nums[3] }) }
    // where each frame sits in the range (0…1): from the poses, else evenly; a pose beyond the last frame is the
    // virtual end the last frame slides toward
    var slide = poses.length >= count && typeof poses[0].x === 'number'
    var m = slide && poses.length > count ? count + 1 : count
    var pos = []
    for (var k = 0; k < m; k++) pos.push(poses[k] && typeof poses[k].p === 'number' ? poses[k].p : m > 1 ? k / (m - 1) : 0)
    var ctx = null
    try { ctx = c.getContext('2d') } catch (e) { ctx = null }
    if (!ctx) return null
    return { t: t, el: c, ctx: ctx, urls: urls, n: count, pos: pos, poses: poses, slide: slide, explicit: poses.length >= count, cross: c.getAttribute('data-blend') === 'cross', imgs: new Array(count), state: 'idle', inflight: 0, order: null, next: 0, scale: 1, w: 0, h: 0, key: '' }
  }
  function fit(q) {
    var cssW = q.el.clientWidth || num(q.el.getAttribute('width'), 0), cssH = q.el.clientHeight || num(q.el.getAttribute('height'), 0)
    var scale = Math.min(window.devicePixelRatio || 1, 2)
    var w = Math.max(1, Math.round(cssW * scale)), h = Math.max(1, Math.round(cssH * scale))
    if (w !== q.el.width || h !== q.el.height) { q.el.width = w; q.el.height = h; q.key = '' }
    q.scale = scale; q.w = w; q.h = h
  }
  /** Coarse to fine: the first and last frames, then the middle, then the quarters… a half-loaded sequence plays. */
  function loadOrder(n) {
    var out = [], seen = {}
    var add = function (i) { if (!seen[i]) { seen[i] = 1; out.push(i) } }
    add(0); if (n > 1) add(n - 1)
    var segs = [[0, n - 1]]
    while (segs.length) {
      var next = []
      for (var i = 0; i < segs.length; i++) {
        var a = segs[i][0], b = segs[i][1]
        if (b - a < 2) continue
        var m = Math.floor((a + b) / 2)
        add(m); next.push([a, m]); next.push([m, b])
      }
      segs = next
    }
    return out
  }
  function startLoading(q) {
    if (q.state === 'loading' || q.state === 'loaded') return
    q.state = 'loading'; q.order = loadOrder(q.n); q.next = 0; q.inflight = 0
    pump(q)
  }
  function pump(q) {
    while (q.inflight < 4 && q.order && q.next < q.order.length) {
      var i = q.order[q.next++]
      if (q.imgs[i]) continue
      q.inflight++
      loadFrame(q, i)
    }
    if (q.order && q.next >= q.order.length && !q.inflight) q.state = 'loaded'
  }
  // Decoding, one frame per animation frame, with the browser's own async decode (img.decode(): off the main thread in
  // WebKit and Chromium; createImageBitmap decoded on WebKit's main thread, a dozen ms a frame right when the visitor
  // starts scrolling). The queue drains between the frames the scroll draws.
  var decodeQueue = [], decodeRaf = 0
  function drainDecodes() {
    decodeRaf = 0
    var job = decodeQueue.shift()
    if (!job) return
    var q = job.q, i = job.i, img = job.img
    // a frame that arrives while the page stands still must be drawn now: the next update runs even at the same scroll
    var settle = function () { q.inflight--; q.key = ''; force = true; schedule(); pump(q); if (decodeQueue.length && !decodeRaf) decodeRaf = requestAnimationFrame(drainDecodes) }
    if (q.state === 'idle') { settle(); return } // released meanwhile: dropped
    var t0d = performance.now()
    var took = function () { var ms = performance.now() - t0d; stats.decodes++; stats.decodeTotal += ms; if (ms > stats.decodeMax) stats.decodeMax = ms }
    var keep = function () { took(); if (q.state === 'idle') { img.onerror = null; img.removeAttribute('src') } else q.imgs[i] = img; settle() }
    if (img.decode) img.decode().then(keep, keep); else keep()
  }
  function loadFrame(q, i) {
    var img = new Image()
    try { img.decoding = 'async' } catch (e) { /* older */ }
    try { img.fetchPriority = i === 0 && q === seqs[0] ? 'high' : 'low' } catch (e) { /* older */ }
    img.onload = function () { decodeQueue.push({ q: q, i: i, img: img }); if (!decodeRaf) decodeRaf = requestAnimationFrame(drainDecodes) }
    img.onerror = function () { q.inflight--; pump(q) }
    img.src = q.urls[i]
  }
  var stats = { releases: [], draws: 0, drawMax: 0, drawTotal: 0, decodes: 0, decodeMax: 0, decodeTotal: 0 } // for the check
  function release(q) {
    if (q.state === 'idle') return
    var t = performance.now()
    for (var i = 0; i < q.n; i++) { var im = q.imgs[i]; if (im) { im.onerror = null; im.removeAttribute('src') } q.imgs[i] = null }
    q.state = 'idle'; q.order = null; q.key = ''; force = true
    // the canvas's own store goes too (a 2× full-screen canvas is 20 MB); fit() brings it back when the scene nears
    q.el.width = 1; q.el.height = 1; q.w = 1; q.h = 1
    stats.releases.push(Math.round(performance.now() - t))
  }
  function frameImage(q, i) { return q.imgs[i] || null }
  /** The frame to draw for index i: itself, or the nearest one that has arrived (lower first). */
  function nearest(q, i) {
    if (frameImage(q, i)) return i
    for (var d = 1; d < q.n; d++) { if (i - d >= 0 && frameImage(q, i - d)) return i - d; if (i + d < q.n && frameImage(q, i + d)) return i + d }
    return -1
  }
  /** How far (in screens) the sequence's scene or box is from the screen at scroll y: 0 when on it. */
  function distance(q, y) {
    var top, bottom
    if (q.t.scene) { var sc = q.t.scene; top = sc.pin - sc.lead - y; bottom = sc.pin + sc.travel + sc.hS - y } else { top = viewTop(q.t, y); bottom = top + q.t.h }
    if (bottom < 0) return -bottom / vh
    if (top > vh) return (top - vh) / vh
    return 0
  }
  function drawSeq(q, y) {
    var dist = distance(q, y)
    if (dist <= 2) { if (q.state === 'idle') fit(q); startLoading(q) }
    if (dist > 3) { release(q); return } // three screens away: freed (fetched again within two: no thrash)
    var u = 0
    if (q.t.ranges.length && q.t.scene) { var r = q.t.ranges[0]; u = clamp01((q.t.scene.p - r[0]) / (r[1] - r[0] || 1)) }
    else if (q.t.views.length) { var v = q.t.views[0]; u = clamp01(viewProgress(q.t, y, v.name, v.a, v.b)) }
    else if (q.t.scene) u = clamp01(q.t.scene.p)
    else u = clamp01(viewProgress(q.t, y, 'cover', 0, 1))
    // the segment [i, i+1] the position falls in (i+1 may be the virtual end pose), and how far along it
    var n = q.n, segs = q.pos.length - 1, i = n - 1, t = 0
    for (var k = 0; k < segs; k++) if (u < q.pos[k + 1]) { i = k; t = (u - q.pos[k]) / (q.pos[k + 1] - q.pos[k] || 1); break }
    if (u >= q.pos[q.pos.length - 1]) { i = n - 1; t = q.pos.length > n ? 1 : 0 }
    var hasNext = i + 1 < q.pos.length
    var mode = q.cross ? 'cross' : q.slide ? 'slide' : 'cut'
    if (!hasNext) { mode = 'cut'; t = 0 }
    // a cut: with positions written (poses), frame i holds from its position to the next one's; evenly spaced frames
    // switch halfway (the nearest one)
    var a = nearest(q, mode === 'cut' ? (q.explicit ? i : Math.min(n - 1, Math.round(i + t))) : i)
    if (a < 0) return
    var b = mode === 'cross' ? nearest(q, Math.min(n - 1, i + 1)) : -1
    if (mode === 'cross' && (b < 0 || b === a)) mode = q.slide ? 'slide' : 'cut'
    var tt = Math.round(t * 64) / 64
    var key = mode + '/' + a + '/' + b + '/' + (mode === 'cut' ? 0 : tt) + '/' + q.w + 'x' + q.h
    if (key === q.key) return
    q.key = key
    var t0 = performance.now()
    var ctx = q.ctx, W = q.w, H = q.h, S = q.scale
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = 1
    if (mode === 'cut') ctx.drawImage(frameImage(q, a), 0, 0, W, H)
    else if (!q.slide) { // a crossfade in place: the frame under stays whole, the next one fades in on top
      ctx.globalAlpha = 1; ctx.drawImage(frameImage(q, a), 0, 0, W, H)
      ctx.globalAlpha = t; ctx.drawImage(frameImage(q, b), 0, 0, W, H)
    } else {
      // the move between frame i and the next: anchor and scale interpolated, each frame laid onto that place
      var pa = q.poses[i], pb = q.poses[i + 1] || pa
      var ax = pa.x + (pb.x - pa.x) * t, ay = pa.y + (pb.y - pa.y) * t, sN = pa.s * Math.pow(pb.s / pa.s, t)
      var lay = function (img, pose, alpha) {
        var kk = sN / pose.s
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = alpha
        ctx.translate(ax * S, ay * S); ctx.scale(kk, kk); ctx.translate(-pose.x * S, -pose.y * S)
        ctx.drawImage(img, 0, 0, W, H)
      }
      // the frame under stays whole and the next fades in over it (never two half-transparent layers: see-through)
      if (mode === 'cross') { lay(frameImage(q, a), q.poses[a] || pa, 1); lay(frameImage(q, b), q.poses[b] || pb, t) }
      else lay(frameImage(q, a), q.poses[a] || pa, 1)
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    var ms = performance.now() - t0; q.draws = (q.draws || 0) + 1; stats.draws++; stats.drawTotal += ms; if (ms > stats.drawMax) stats.drawMax = ms
    if (!firstDrawn) { firstDrawn = true; try { performance.mark('rd-scene-first-frame') } catch (e) { /* */ } }
  }

  // ---------- the update, once per frame ----------
  function seek(it, local) {
    var v = clamp01(local)
    if (isNaN(v) || Math.abs(v - it.last) < 1e-4) return
    it.last = v
    try { it.a.currentTime = v * D } catch (e) { /* gone */ }
  }
  function update() {
    raf = 0
    var y = playing && run ? run.pos : window.pageYOffset || 0 // a stretch playing: where the play is, to the fraction of a px
    var now = performance.now(), dt = lastT ? Math.min(now - lastT, 100) : 1000 / 60
    lastT = now
    if (ys < 0 || (!playing && Math.abs(y - ys) > Math.max(vh, 600) * 1.5) || Math.abs(y - ys) < 0.3) ys = y // a play is never a jump, however fast
    else ys += (y - ys) * (1 - Math.exp(-dt / SMOOTH))
    if (ys === lastYs && !force) { if (y !== ys) schedule(); return }
    lastY = y; lastYs = ys; force = false
    for (var i = 0; i < scenes.length; i++) { var sc = scenes[i]; sc.p = (ys - (sc.pin - sc.lead)) / ((sc.travel + sc.lead) || 1); }
    for (var j = 0; j < tracks.length; j++) {
      var t = tracks[j], el = t.el
      if (t.anims) {
        var stale = false
        for (var s = 0; s < t.anims.length; s++) if (t.anims[s].a.playState === 'idle') { stale = true; break }
        if (stale) t.anims = animationsOf(el)
        for (var k = 0; k < t.anims.length; k++) {
          var it = t.anims[k], idx = it.index
          if (t.ranges.length && t.scene) { var r = t.ranges[Math.min(idx, t.ranges.length - 1)]; seek(it, (t.scene.p - r[0]) / (r[1] - r[0] || 1)) }
          else if (t.views.length) { var v = t.views[Math.min(idx, t.views.length - 1)]; seek(it, viewProgress(t, ys, v.name, v.a, v.b)) }
        }
      }
      for (var f = 0; f < t.flags.length; f++) { var fl = t.flags[f]; if (t.scene) el.classList.toggle(fl.cls, t.scene.p >= fl.at) }
      if (t.viewFlags.length) viewFlagsAt(t, y) // on the real position, not the trail: see «timed entrances»
    }
    for (var q = 0; q < seqs.length; q++) drawSeq(seqs[q], ys)
    for (var b = 0; b < bobs.length; b++) { var bo = bobs[b], tb = bo.t; var amp = 1; if (tb.ranges.length && tb.scene) { var rr = tb.ranges[0]; amp = 1 - clamp01((tb.scene.p - rr[0]) / (rr[1] - rr[0] || 1)) } bo.amp = amp }
    if (!idleRaf && bobs.some(function (bo) { return bo.amp > 0 })) idle()
    if (stepsCss) paintSteps()
    bars()
    if (ys !== y) schedule() // still trailing: on to the next frame
  }
  /** The shown position jumps to the real one now (for shots and checks that scroll by script and look at once). */
  function catchUp() { ys = window.pageYOffset || 0; force = true; if (raf) { cancelAnimationFrame(raf); raf = 0 } update() }
  function idle() { // the floats, while any has amplitude and is on screen
    idleRaf = 0
    var now = Date.now() - t0, any = false
    for (var i = 0; i < bobs.length; i++) {
      var bo = bobs[i]
      if (bo.amp <= 0) { if (bo.t.el.style.transform) bo.t.el.style.transform = ''; continue }
      var top = viewTop(bo.t, lastY)
      if (top > vh * 1.5 || top + bo.t.h < -vh * 0.5) continue
      any = true
      var dy = bo.amp * bo.y * Math.sin(now / bo.ty * Math.PI * 2), rz = bo.amp * bo.deg * Math.sin(now / bo.tr * Math.PI * 2)
      bo.t.el.style.transform = 'translateY(' + dy.toFixed(2) + 'px) rotate(' + rz.toFixed(3) + 'deg)'
    }
    if (any) idleRaf = requestAnimationFrame(idle)
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update) }
  // ---- timed entrances: never seen undone ----
  // `data-view-on` flags start a piece's timed CSS as it comes into view. A page writes the piece's rest look as its
  // end (what the canvas and a page without the engine show) and a ready flag for the waiting pose (`rdy entry -10;
  // go contain 18`). Judged on the trailed position (90 ms behind the page: 200–350 px in a flick) and on the window
  // without the strip under Safari's glass bar, the ready flag came when the piece was already on screen: seen in its
  // place, gone, then set down again (25 Nov 2026, Ammiraglio on RealMyEstate's method: «compaiono, poi scompaiono per
  // ricompaiono… non voglio che si verifichi mai più»; measured in a hidden Chromium: the method's rows seen, then down
  // to a fifth of their opacity, then set down, at a reading pace). So, since motore v11:
  //  · a ready flag (a point at 0 or before on entry, cover or entry-crossing: before any of the piece shows) is set as
  //    the engine starts and stays: below the screen every piece waits, however fast the page comes;
  //  · the others are judged on the real position (the trail is for the seeked pieces) and against the whole screen,
  //    the glass included. One that turned on as the piece came in turns off only once the piece is wholly below the
  //    screen again: scrolling back up nothing is undone in view, and the entrance plays again the next time it comes
  //    in. One whose point lies where the piece leaves at the top (exit) toggles at its point, as before;
  //  · as the engine starts, a piece already on screen takes all its flags at once: what is seen stays as it is.
  // The check watches the same on every page, however it is written (perf.ts, «timed entrances»).
  function screenBottom() { return Math.max(window.innerHeight - insetB, svh || 0, vh) + Math.max(0, underPx) }
  function viewFlagsAt(t, y) {
    var el = t.el, below = viewTop(t, y) >= screenBottom() - 1, first = !t.flagged
    t.flagged = true
    for (var g = 0; g < t.viewFlags.length; g++) {
      var vf = t.viewFlags[g], on
      if (vf.ready) on = true
      else {
        var past = viewProgress(t, y, vf.name, 0, 1) >= vf.at
        on = vf.name === 'exit' || vf.name === 'exit-crossing' || leaving(t, vf) ? past : past || (!below && (first || vf.on))
      }
      if (on !== vf.on || first) { vf.on = on; el.classList.toggle(vf.cls, on) }
    }
  }
  /** A flag whose point comes as the piece leaves at the top: its top above the window, its bottom inside it. */
  function leaving(t, vf) {
    var H = t.h, c0 = Math.min(vh - H, 0), c1 = Math.max(vh - H, 0), r0, r1
    switch (vf.name) { case 'contain': r0 = c1; r1 = c0; break; case 'entry': r0 = vh; r1 = c1; break; case 'entry-crossing': r0 = vh; r1 = vh - H; break; default: r0 = vh; r1 = -H }
    var pt = r0 + (r1 - r0) * vf.at
    return pt < 0 && pt + H <= vh
  }
  // ---------- the guided play ----------
  // THE PRESENTATION RULE (Ammiraglio, 6 Nov 2026: «immaginatela come una presentazione powerpoint: se vai avanti si
  // vede quell'animazione in avanti, se vai indietro si vede quell'animazione indietro. Basta. Non c'è l'animazione più
  // veloce, non c'è lo scroll più lungo»). It is the Atelier's one standard for a scroll-triggered scene: no page and
  // no agent writes another.
  //  · The stops of `data-play` cut the scene into stretches between rests: the scene's start, then each stop. Inside
  //    a scene the visitor's scroll never moves the page: it only says «on» or «back». A scroll down at a rest plays
  //    the stretch below it, a scroll up plays the stretch above it back; out of the scene's two ends the page scrolls
  //    as everywhere else, and past the last stop the scroll scrubs as usual.
  //  · A stretch always plays whole, at its own pace, the same every time: a long flick and a touch of the wheel start
  //    the same play. It starts at once with the gesture (no scrolling first, no wait: the gesture is taken before the
  //    page moves) and comes to rest by itself; the next stretch waits for a new gesture, unless one came meanwhile.
  //  · One scroll is one slide (20 Nov 2026, Ammiraglio: «a ogni scrollata corrisponda il passaggio ad una slide
  //    diversa»; measured on RealMyEstate before: a visitor scrolling once a second and a half needed six scrolls for
  //    three slides, every other one lost). A gesture the same way while a stretch plays, past its first half second,
  //    changes nothing of it and is never lost: it books the next stretch (`next`), played as soon as this one rests;
  //    at the scene's end the page goes on (`exit`, `goOn`). One at most is booked; more count toward insistence.
  //  · The approach (20 Nov 2026: «l'intro è composta da due scrollate invece di una, che dovrebbe essere una che
  //    direttamente fa iniziare la presentazione»): a scene below the top of the page has one more rest, half a window
  //    above its start (`APPROACH`, never above the scene before it). The scroll that brings the scene that far into
  //    view is taken there like any scroll entering a scene, and plays the approach, a short glide of the section into
  //    place (`APPROACH_T`), and the first stretch on at once (`endPlay`); back from the first stop the first stretch
  //    plays back and the approach glides the scene out. The scene's start is never a rest of its own on the way.
  //  · While it plays: a gesture the same way books what follows (above); one the other way turns it around at the pace it has
  //    (4 Nov 2026: «quello che voglio evitare è che degli scroll possano interrompere questa animazione»); a finger
  //    held still on the screen (a pressed mouse button) freezes it, the release lets it go on. Still means still for
  //    `STILL`: at once, every touch stopped the play until the finger had run a few px, a tap for all its length (Safari
  //    27 with a real finger: 20–45 ms at every flick, 125 ms at a tap, the shown pace down to a quarter through the
  //    trail: «rallenta un po' e poi riparte»).
  //  · The one exception is insistence (Ammiraglio, 6 Nov 2026: «se il sistema detecta che scrolla proprio con
  //    insistenza durante l'animazione, facciamo passare lo scrollytelling molto veloce»): three separate gestures the
  //    same way during a stretch, past its first half second (reflexes of a visitor who came in scrolling), each within
  //    1.2 s of the one before, and what is left of the stretch passes in about 0.7 s: gaining pace, never a cut, down
  //    to the exact rest. It counts gestures and never distance: one scroll, however long and sudden, is one gesture and
  //    hurries nothing. A gesture is a finger that runs at least 30 px, or a new push of the wheel (`wheelPush`), or a
  //    key pressed; a turn starts the count over, at the normal pace. Hurried, the next stretch of the same scene, the
  //    same way, starts hurried too if its gesture comes within 1.2 s of the rest.
  //  · A scroll that comes in from outside (the page scrolled into the scene from above or from below, with all its
  //    momentum) is taken as it enters: the momentum ends there and the stretch plays from that point at its own pace
  //    (6 Nov 2026: «se faccio uno scroll molto lungo e molto repentino, lui skippa tutto… assolutamente non la voglio»).
  //    The momentum is ended there (`kill`), so that the next finger reaches the page and can turn or hurry the stretch.
  //  · The last moments of a stretch (its last 5 %, well over half a second of braking) look still: a gesture on given there is
  //    not insistence but the next stretch, which starts at the rest (`next`); at the scene's end, where no stretch
  //    follows, a finger takes the page at once and scrolls on with it (`giveBack`, `drag`, `fling`). Before (7 Nov 2026,
  //    Ammiraglio: «appena atterrato… il primo swipe non funziona», «la tappa lo ferma per un attimo») that gesture was
  //    swallowed and the visitor had to make another.
  // How. While the page is in a scene's stretches (or at one of its rests) the engine listens to the wheel and the
  // touch with listeners that block (`capture`; nowhere else: elsewhere scrolling stays off the main thread) and takes
  // the gestures that have a stretch to play; the others it lets through. A play is a body moved by a simple law: it
  // gains pace at a constant rate up to the stretch's top pace and loses it at the same rate so as to stop exactly on
  // the rest (`step`): rest to rest it lasts the seconds the page wrote, a turn-around or a start from anywhere need no
  // special case, and the pieces are seeked from that body, not from where the browser says the page is. What is left
  // of a gesture when the rest is reached (a trackpad's inertia, a key held down) is swallowed (`tail`); a finger still
  // on the screen at the rest that moves on is a gesture at that rest. A scroll taken in flight cannot be stopped by
  // its events (they are not cancelable once the page scrolls), and what was learnt with a real finger (Safari 27 in
  // the iOS simulator and Chrome, 6–8 Nov 2026) is this. Safari on the iPhone: a script that scrolls the page every
  // frame covers the momentum but does not end it: it goes on underneath, and a finger landing on a page still in its
  // momentum never reaches the page (Safari gives it to the scroll view: no touch event at all) — the visitor could
  // not turn the stretch, their invisible drag fought the script (the page shook), and when the engine let go, the
  // hidden momentum of that drag played a stretch by itself seconds later. `overflow: hidden` on the root the viewport
  // ignores, a fixed body loses the position. What ends the momentum is a smooth scroll of the page to another point,
  // left to run (UIKit cancels its deceleration for an animated scroll; a plain scroll in the next frame cancels the
  // smooth one and the momentum is back): `kill` asks the page to glide a little further on its way and writes nothing
  // for KILL ms. The finger that drags the page into a scene is followed, not fought (its moves cannot be stopped),
  // and its fling is ended the same way when it leaves. After such a play the page is held on its rest (`guard`) only
  // while it still moves by itself. Chrome keeps flinging against the script for most of a second (98 px off course),
  // so there the page is also made unscrollable while the play and the guard last (`overflow: hidden` on the root).
  // Safari never gives a gesture back once a move of it was prevented (measured 8 Nov 2026): a finger that goes on past
  // a scene's end moves the page through the engine (`drag`) and leaves it a fling of the engine's (`fling`, losing
  // pace as an iPhone's does). Only the visitor's own scrolls count (a gesture, then for as long as the page keeps
  // moving): never a script's, never what a link scrolls. The snap points
  // inside the stretches are off for good (`quietSnaps`), and the page's own snapping is off while the page is in a
  // scene's stretches or on its rests, if any snap point is left alive elsewhere (`snapsOff`): set when the page gets
  // there, never at the gesture. Written at the gesture it re-styled the whole page in the first frame of the play: a
  // stop of 50 ms on a light page, 110–130 ms on a real one, before anything moved (Safari 27 with a real finger, 7 Nov 2026).
  var REST = 2 // px around a rest that still are that rest
  var START = 0.3 // the pace a play has at once, as a share of the stretch's top pace: it answers the gesture, it does not crawl in
  var CARRY = 0.6 // the most a scroll taken in flight brings into the play, same share
  var STILL = 150 // ms a finger on the screen (a mouse button down) must stay still to be a hold: past a plain tap (about 130 ms)
  var INSIST = 3 // separate gestures the same way during a stretch that make it hurry…
  var INSIST_GAP = 1200 // …each within this many ms of the one before…
  var INSIST_FROM = 500 // …none in these first ms of the stretch (or of its turn): the reflexes of whoever came in scrolling
  var FLICK = 30 // px a finger must run the same way to be such a gesture
  var WHEEL_PAUSE = 150, WHEEL_EVERY = 300 // ms: the pause that ends a push of the wheel, the least between two pushes
  var FAST = 0.7 // s: what is left of a stretch when the visitor insists
  var NEAR = 0.05 // the last share of a stretch (12 px at least) where a gesture on is the next stretch, not insistence: the braking looks still there
  var APPROACH = 0.5 // share of the window: a scene with data-play takes the scroll that brings it this far into view
  var APPROACH_T = 0.5 // s: the glide of the section into place over a whole approach (0.3 s at least for a short one)
  var GO_ON = 1.1 // the pace (windows per second) of the fling that carries the page on past a scene's end when the visitor scrolled on while its last stretch played: about half a window
  var KILL = 420 // ms the engine writes no scroll after asking Safari's smooth scroll to end a momentum (it takes ~320)
  var GUARD_QUIET = 150 // ms without the page moving by itself that end the guard after a play taken in flight
  var guide = true // off: the scenes are scrubbed by the scroll like any other (the check's own scrolling)
  var playing = null, playingStop = 0, playRaf = 0
  var run = null // the stretch on its way: a, b (page px of its two rests), pos, target, dir (1 down, -1 up), v (px/s toward the target), acc, att, v0, vmax, last, native, t0; since, pushes, lastPush, fast (insistence)
  var fastFor = null // the stretch that has just ended hurried: its scene, its direction, when
  var armedUntil = 0, userDir = 0, prevY = -1, prevAt = 0, vIn = 0, ownY = -1
  var touching = 0, stillAt = 0, stillX = 0, stillY = 0, flickDone = false, pressed = false, pressAt = 0, deferred = false
  var captured = false, tail = false, tailAt = 0, tailTimer = 0, lastWheel = 0, keysTaken = {}
  var flight = false, guardUntil = 0, guardY = 0, guardAt = 0, guardRaf = 0, touchEndAt = 0, fY = 0, fAt = 0, fV = 0 // a scroll taken in flight: its momentum, the finger's own pace
  var drag = false, fling = null // the page moved through the engine by a finger it took the gesture of; the fling that finger left
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  var motionQuery = null
  var reduced = function () { try { if (!motionQuery) motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); return motionQuery.matches } catch (e) { return false } }
  var zoomed = function () { var v = window.visualViewport; return !!v && v.scale > 1.02 } // pinched in: the finger pans the page, the scenes wait
  var held = function () { var t = performance.now(); return (pressed && t - pressAt >= STILL) || (touching > 0 && t - stillAt >= STILL) }
  var off = function () { return !guide || reduced() || zoomed() }
  /** The page px of a scene's rest: 0 = its start, k = its k-th stop; with an approach, 0 = where it begins (the
   *  scene's start is 1, its k-th stop k + 1). */
  function restY(sc, k) { var st = sc.stops; return Math.max(0, sc.pin - sc.lead + (k ? st[k - 1].to * (sc.travel + sc.lead) : st && st[0].ap ? -sc.ap : 0)) }
  /** The rests before the scene's own: 1 with an approach, else 0. */
  function lead0(sc) { return sc.stops && sc.stops[0].ap ? 1 : 0 }
  // ---- the slides of a presentation (20 Nov 2026) ----
  // A scene of two stops or more is a presentation, and a visitor used to pages that scroll must see it as one
  // (Ammiraglio: «se la persona che scrolla non capisce cosa sta succedendo e pensa che il sito sia bloccato, non sa più
  // come proseguire»). A segment per stretch, the one playing filling as it plays, the ones before it full. It lives in
  // the stage, so it comes and goes with the scene (in as the approach glides the scene in, out with it); in the colour
  // of the stage's text (`--rd-steps-ink` for another), never a page's own CSS's (tags of its own), off with the guided
  // play (reduced motion: the scene is scrubbed by hand). The page leaves it room.
  // The arrows (25 Nov 2026, motore v10; Danilo, the client of RealMyEstate, on its slides: «metterei più evidente lo
  // scroll… tutto sulla destra un tasto, una freccia sopra una freccia sotto per dire avanti e indietro»): the segments
  // stand between an arrow back and an arrow on, each a disc of the ink (44 px to the finger, 48 to the mouse), and a
  // tap on one is one scroll that way, the same as the arrow keys': the stretch that way plays whole, or the one playing
  // turns, or the next is booked; past the scene's end that way the page goes on. On a rest with more to come, after a
  // moment, the arrow on nudges down and its disc deepens: it asks for the next scroll. On a phone the row is at the
  // bottom of the stage (`--rd-steps-room`: the room a page keeps there for a bar of its own, under the row); from 700
  // px wide it stands at the right edge, in the middle of the stage (`--rd-steps-side` moves it in). Only the arrows
  // take a tap, and only while shown; to a screen reader the box stays hidden (the keys do the same, and the page reads
  // on). A press on an arrow is never a hold, a finger on one never a scroll.
  var STEPS_WAIT = 1200 // ms on a rest before the arrow on asks for the next scroll
  var stepsCss = null, stepsTimer = 0, playEndAt = 0, tArrow = false, stepsWide = false // stepsWide: from 700 px the segments stand and fill downwards
  var STEPS_STYLE = 'rd-steps{position:absolute;left:50%;bottom:calc(12px + var(--rd-steps-room,0px));z-index:999999;display:flex;align-items:center;margin:0;padding:0;transform:translateX(-50%);color:var(--rd-steps-ink,currentColor);opacity:0;transition:opacity .32s cubic-bezier(.23,1,.32,1);pointer-events:none;-webkit-tap-highlight-color:transparent}' +
    'rd-steps.on{opacity:1}' +
    'rd-step{position:relative;display:block;flex:none;width:24px;height:3px;margin:0 4px;border-radius:2px;overflow:hidden}' +
    'rd-step::before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;background:currentColor;opacity:.22}' +
    'rd-fill{position:absolute;top:0;right:0;bottom:0;left:0;display:block;background:currentColor;opacity:.9;transform:scaleX(0);transform-origin:0 50%}' +
    'rd-back,rd-on{position:relative;display:block;flex:none;width:44px;height:44px;margin:0 2px;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none;transition:transform .16s cubic-bezier(.23,1,.32,1)}' +
    'rd-steps.on rd-back,rd-steps.on rd-on{pointer-events:auto}' +
    'rd-back::before,rd-on::before{content:"";position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;background:currentColor;opacity:.1;transition:opacity .2s ease}' +
    'rd-back::after,rd-on::after{content:"";position:absolute;top:50%;left:50%;width:7px;height:7px;box-sizing:border-box;border:0 solid currentColor;opacity:.9;transform:rotate(45deg)}' +
    'rd-back::after{margin:-2px 0 0 -3.5px;border-width:1.6px 0 0 1.6px}' +
    'rd-on::after{margin:-5.5px 0 0 -3.5px;border-width:0 1.6px 1.6px 0}' +
    'rd-back:active,rd-on:active{transform:scale(.92)}' +
    '@media (hover:hover){rd-back:hover::before,rd-on:hover::before{opacity:.18}}' +
    'rd-steps.wait rd-on::before{opacity:.2}' +
    'rd-steps.wait rd-on::after{animation:rd-steps-nudge 1.6s cubic-bezier(.45,0,.55,1) infinite}' +
    '@keyframes rd-steps-nudge{0%,100%{transform:translateY(-1px) rotate(45deg)}50%{transform:translateY(3px) rotate(45deg)}}' +
    '@media (min-width:700px){rd-steps{left:auto;right:calc(20px + var(--rd-steps-side,0px));top:50%;bottom:auto;flex-direction:column;transform:translateY(-50%)}' +
      'rd-step{width:3px;height:26px;margin:4px 0}rd-fill{transform:scaleY(0);transform-origin:50% 0}' +
      'rd-back,rd-on{width:48px;height:48px;margin:2px 0}rd-back::before,rd-on::before{width:36px;height:36px}' +
      'rd-back::after,rd-on::after{width:8px;height:8px}rd-back::after{margin:-2px 0 0 -4px}rd-on::after{margin:-6px 0 0 -4px}}' +
    '@media (prefers-reduced-motion:reduce){rd-steps.wait rd-on::after{animation:none}rd-back,rd-on{transition:none}}'
  function makeSteps(sc) {
    if (!stepsCss) {
      stepsCss = document.createElement('style')
      stepsCss.setAttribute('data-rd-steps', '')
      stepsCss.textContent = STEPS_STYLE
      ;(document.head || document.documentElement).appendChild(stepsCss)
    }
    var box = null, kids = sc.stage.children
    for (var i = 0; i < kids.length; i++) if (kids[i].tagName === 'RD-STEPS') { box = kids[i]; break }
    if (box && !box.getElementsByTagName('rd-on').length) { box.parentNode.removeChild(box); box = null } // an older engine's, without the arrows
    if (!box) {
      box = document.createElement('rd-steps')
      box.setAttribute('data-rd-steps', '')
      box.setAttribute('aria-hidden', 'true')
      box.appendChild(document.createElement('rd-back'))
      for (var k = 0; k < sc.play.length; k++) box.appendChild(document.createElement('rd-step')).appendChild(document.createElement('rd-fill'))
      box.appendChild(document.createElement('rd-on'))
      sc.stage.appendChild(box)
    }
    if (!box.__rdArrows) { box.__rdArrows = true; box.addEventListener('click', onArrowTap) }
    sc.steps = { el: box, fills: box.getElementsByTagName('rd-fill'), last: [], on: false, wait: false }
  }
  /** Is this the box of an arrow of the slides (or something in it)? */
  function onArrow(t) { return !!(t && t.closest && t.closest('rd-back, rd-on')) }
  function onArrowTap(e) {
    var a = e.target && e.target.closest ? e.target.closest('rd-back, rd-on') : null
    if (!a) return
    e.preventDefault()
    arrowGesture(a.tagName === 'RD-ON' ? 1 : -1)
  }
  /** A tap on an arrow: one scroll that way. While a stretch plays: the other way turns it; this way books the next
   *  stretch (at once, no reflexes to wait out: a tap has no inertia), or at the scene's end lets the page go on after
   *  it; one more while one is booked counts toward insistence. At a rest: the stretch that way plays from there, or,
   *  past the scene's end that way, the page goes on, as one more scroll of the visitor's would carry it. */
  function arrowGesture(dir) {
    if (fling) { stopFling(); settle() }
    if (playing) {
      var r = run
      if (dir !== r.dir) { turn(dir); return }
      if (r.next || r.exit) { insist(); return }
      if (stretchFor({ sc: playing, s: -1, rest: playingStop + (dir > 0 ? 1 : 0), n: playing.stops.length }, dir) >= 0) r.next = true
      else r.exit = true
      return
    }
    if (tail) { tail = false; clearTimeout(tailTimer); settle() } // what was left of the last scroll: this is a new gesture
    if (off()) return
    arm(1000)
    var y = window.pageYOffset || 0, z = zoneAt(y), s = z ? stretchFor(z, dir) : -1
    if (s >= 0) { startPlay(z.sc, s, dir, y, 0); return }
    hold(false)
    startFling(dir * Math.max(500, GO_ON * vh))
  }
  /** The indicators as the page is now: the fills from the play (or from where the page is), shown while the scene is
   *  in place or gliding in, the arrow on asking once the page has rested a moment on a stop with more to come. */
  function paintSteps() {
    var now = Date.now(), y = window.pageYOffset || 0, quiet = off()
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i], sp = sc.steps
      if (!sp || !sc.stops) continue
      var n = sc.play.length, k0 = lead0(sc), mine = !!run && playing === sc, on = false, wait = false
      for (var k = 0; k < n && k < sp.fills.length; k++) {
        var f
        if (mine) { var idx = playingStop - k0; f = k < idx ? 1 : k === idx ? clamp01((run.pos - run.a) / ((run.b - run.a) || 1)) : 0 }
        else { var a = restY(sc, k0 + k), b = restY(sc, k0 + k + 1); f = y >= b - REST ? 1 : y <= a + REST ? 0 : clamp01((y - a) / ((b - a) || 1)) } // on a rest: exactly full or empty
        if (sp.last[k] === undefined || Math.abs(f - sp.last[k]) > 0.002 || ((f === 0 || f === 1) && f !== sp.last[k])) { sp.last[k] = f; sp.fills[k].style.transform = (stepsWide ? 'scaleY(' : 'scaleX(') + f.toFixed(4) + ')' } // a row fills rightwards, a column downwards
      }
      if (!quiet) {
        if (mine) on = playingStop >= k0 || run.dir > 0
        else {
          on = y >= restY(sc, k0) - REST && y <= restY(sc, sc.stops.length) + REST
          if (on && !playing && !tail && !drag && !fling && !flight && now - Math.max(playEndAt, lastScrollAt) >= STEPS_WAIT) {
            var z = zoneAt(y)
            wait = !!z && z.sc === sc && z.rest >= k0 && z.rest < sc.stops.length
          }
        }
      }
      if (on !== sp.on) { sp.on = on; sp.el.classList.toggle('on', on) }
      if (wait !== sp.wait) { sp.wait = wait; sp.el.classList.toggle('wait', wait) }
    }
  }
  /** A look at the indicators once the page may have rested long enough for the arrow on to ask. */
  function stepsLater() { if (!stepsCss) return; clearTimeout(stepsTimer); stepsTimer = setTimeout(paintSteps, STEPS_WAIT + 40) }
  /** Where a page position falls in the scenes with a guided play: at a rest (`rest`: 0 … n), inside a stretch (`s`:
   *  0 … n - 1, between the rests s and s + 1), or null when it is in none of them. */
  function zoneAt(y) {
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i]
      if (!sc.stops || !(sc.travel + sc.lead > 0)) continue
      var n = sc.stops.length, lo = restY(sc, 0), hi = restY(sc, n)
      if (hi - lo < 4 || y < lo - REST || y > hi + REST) continue
      for (var k = 0; k <= n; k++) {
        var yk = restY(sc, k)
        if (Math.abs(y - yk) <= REST) return { sc: sc, rest: k, s: -1, n: n }
        if (y < yk) return { sc: sc, rest: -1, s: k - 1, n: n }
      }
    }
    return null
  }
  /** The stretch a gesture that way plays from there, or -1: out of the scene (the page scrolls). */
  function stretchFor(z, dir) { var s = z.s >= 0 ? z.s : dir > 0 ? z.rest : z.rest - 1; return s >= 0 && s < z.n ? s : -1 }
  /** A scroll of the visitor's has brought the page into a scene's stretches, or in one long step past their far end
   *  (from outside, or from a rest inside: 800 px in one step, on an iPhone, for a flick the page never saw): the stretch
   *  it plays is the first one on its way, from where the page was at the last look, and it plays from its edge, however
   *  far in the page already is (an iPhone tells the page where it is late and in long steps while a flick carries it:
   *  300 px into the stretch before the first word of it). */
  function entered(was, y, dir) {
    if (was < 0) return null
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i]
      if (!sc.stops || !(sc.travel + sc.lead > 0)) continue
      var n = sc.stops.length, lo = restY(sc, 0), hi = restY(sc, n)
      if (hi - lo < 4) continue
      var inNow = y > lo + REST && y < hi - REST, over = dir > 0 ? was < hi - REST && y >= hi - REST : was > lo + REST && y <= lo + REST
      if (!inNow && !over) continue
      // on a rest between two stretches: nothing to take, unless the scroll came from outside the scene to get there
      if (inNow && !(dir > 0 ? was < lo - REST : was > hi + REST)) { var z = zoneAt(y); if (!z || z.s < 0) return null }
      var s = -1, k
      if (dir > 0) { for (k = 0; k < n; k++) if (was < restY(sc, k + 1) - REST) { s = k; break } }
      else { for (k = n - 1; k >= 0; k--) if (was > restY(sc, k) + REST) { s = k; break } }
      if (s < 0) return null
      var a = restY(sc, s), b = restY(sc, s + 1), cameIn = dir > 0 ? was <= a + REST : was >= b - REST
      return { sc: sc, s: s, from: cameIn ? (dir > 0 ? a : b) : y > a && y < b ? y : Math.min(b, Math.max(a, was)), y: y }
    }
    return null
  }
  /** A gesture of the visitor's: the scrolls of the next moments are theirs. */
  function arm(ms) { if (!playing && !tail) armedUntil = Math.max(armedUntil, Date.now() + ms) }
  /** The listeners that block, there only while a play may take a gesture: the page in a scene's stretches or at one
   *  of its rests, a stretch playing, the tail of its gesture. */
  function capture() {
    var want = !!playing || tail || flight || drag || !!fling || (!off() && !!zoneAt(window.pageYOffset || 0))
    snapsOff(want)
    if (want === captured) return
    captured = want
    if (want) {
      window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
      window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    } else {
      window.removeEventListener('touchmove', onTouchMove, { capture: true })
      window.removeEventListener('wheel', onWheel, { capture: true })
    }
  }
  function onScroll() {
    lastScrollAt = Date.now()
    schedule()
    stepsLater()
    var y = window.pageYOffset || 0, now = performance.now(), was = prevY
    var d = was < 0 ? 0 : y - was, gap = now - prevAt
    vIn = d && gap > 0 && gap < 120 ? 0.5 * vIn + 0.5 * (d / gap * 1000) : gap >= 120 ? 0 : vIn // the page's own pace, px/s
    prevY = y; prevAt = now
    if (playing) return
    if (flight) { prevY = guardY; return } // the guard holds the page on its rest: what moved it meanwhile counts for nothing, and the next stretch starts from that rest
    if (ownY >= 0 && Math.abs(y - ownY) <= 1) { ownY = -1; capture(); return } // the engine's own last scroll
    var wall = Date.now(), mine = touching > 0 || pressed || wall <= armedUntil
    if (!mine && wall < linkUntil) { clearTimeout(linkTimer); linkTimer = setTimeout(linkRest, 160) } // a link's scroll: where it ends
    if (mine) {
      if (linkUntil) { linkUntil = 0; clearTimeout(linkTimer) }
      armedUntil = Math.max(armedUntil, wall + 600) // theirs for as long as the page keeps moving
      if (d) userDir = d > 0 ? 1 : -1
      if (!tail && !off()) {
        var e = entered(was, y, userDir || 1)
        if (e) {
          if (pressed) deferred = true // the scroll bar under the mouse: when it is let go
          else if (startPlay(e.sc, e.s, userDir || 1, e.from, Math.abs(vIn), y)) return
        }
      }
    }
    capture()
  }
  /** A stretch starts playing from page position y toward its rest that way. For a scroll taken in flight: `speed`,
   *  the pace the page comes in at, and `pageAt`, where the page itself is (further in than y: the play starts at the
   *  stretch's edge and the page waits for it there). False when there is nothing to play (already at that rest). */
  function startPlay(sc, s, dir, y, speed, pageAt) {
    var a = restY(sc, s), b = restY(sc, s + 1), D = b - a, native = typeof pageAt === 'number', synthetic = native && !!fling
    if (D < 4) return false
    var pos = Math.min(b, Math.max(a, y)), target = dir > 0 ? b : a
    if (Math.abs(target - pos) < 1) return false
    // rest to rest in the seconds the page wrote (its share of the scene's, 0.3 s at least): the pace it starts at,
    // the top pace and the rate it gains and loses pace at follow from that. The approach is a glide of its own
    var st = sc.stops[s]
    var T = st.ap ? 0.3 + (APPROACH_T - 0.3) * Math.min(1, D / Math.max(1, APPROACH * vh)) : Math.max(300, Math.min(st.ms, st.ms * D / (sc.travel + sc.lead))) / 1000
    var vmax = 2 * D * (2 - START) / (T * (2 - START * START)), acc = vmax * (2 - START) / T
    playing = sc; playingStop = s
    run = { a: a, b: b, pos: pos, target: target, dir: dir, v: Math.min(Math.max(0, speed || 0), CARRY * vmax), acc: acc, att: Math.max(acc, START * vmax / 0.12), v0: START * vmax, vmax: vmax, last: 0, native: native, t0: Date.now(), page: native ? Math.min(b, Math.max(a, pageAt)) : pos, lag: native, since: Date.now(), pushes: 0, lastPush: 0, fast: false, follow: false, killUntil: 0, next: false, exit: false, released: false }
    run.vmax0 = run.vmax; run.acc0 = run.acc; run.att0 = run.att
    stopFling(); drag = false; acc = 0
    // still insisting: in the same scene, the same way, the next stretch starts hurried
    if (fastFor && fastFor.sc === sc && fastFor.dir === dir && Date.now() - fastFor.at <= INSIST_GAP) hurry()
    fastFor = null
    ownY = run.page
    tail = false
    clearTimeout(tailTimer)
    if (touching) { stillAt = performance.now(); flickDone = true } // the finger that scrolled the page into it, or launched it: not a hold, and not one more gesture
    // a finger's scroll taken in flight: its momentum outlives the events (on an iPhone always: the last fingers may never
    // have been seen). On the iPhone it is ended now, or when the finger that still drags the page leaves (`follow`)
    if (native && !synthetic && (touching > 0 || IOS || Date.now() - touchEndAt < 4500)) { flight = true; guardUntil = Date.now() + 1500 }
    if (native && !synthetic && IOS) { if (touching > 0) run.follow = true; else kill(speed, dir) }
    hold(true, native && !synthetic && !IOS)
    capture()
    playRaf = requestAnimationFrame(step)
    return true
  }
  /** Safari on the iPhone: the momentum of a scroll taken in flight, ended for good (see above). The page is asked to
   *  glide to where the momentum would carry it in the next tenth of a second (from its pace v, px/s; 1 px at least,
   *  never past the stretch's rests) and the play writes nothing for KILL ms: the glide is what those frames show. */
  function kill(v, way) {
    var r = run, y = window.pageYOffset || 0
    if (!r) return
    var to = Math.min(r.b, Math.max(r.a, y + (way || r.dir) * Math.min(100, Math.max(1, Math.abs(v || 0) * 0.1))))
    if (Math.abs(to - y) < 1) to = y - 1 >= r.a ? y - 1 : y + 1
    r.page = to; r.killUntil = Date.now() + KILL; ownY = to
    window.scrollTo({ top: to, left: 0, behavior: 'smooth' })
  }
  /** After a play that took a scroll in flight: the page held on its rest while it still moves by itself (a momentum
   *  the kill did not end, a fling in Chrome), over after GUARD_QUIET ms of quiet, 1.5 s at most; a finger on the
   *  screen ends it (a new one has ended the momentum; the one that dragged the page in cannot be fought). */
  function guardStep() {
    guardRaf = 0
    if (playing) return // the play itself holds the page
    var now = Date.now()
    if (flight && Math.abs((window.pageYOffset || 0) - guardY) > 1) { guardAt = now; ownY = guardY; window.scrollTo({ top: guardY, left: 0, behavior: 'instant' }) } // 1 px: a rest may lie between two whole px
    if (!flight || touching > 0 || now - guardAt >= GUARD_QUIET || now >= guardUntil) { flight = false; settle(); return }
    guardRaf = requestAnimationFrame(guardStep)
  }
  /** The finger has left a page it was moving through the engine: the page goes on as it would have, losing 0.2 % of
   *  its pace every ms as an iPhone's does, until it is slow, a finger lands, a wheel or a key moves, or a stretch
   *  takes it in flight, as it takes any scroll of the visitor's. */
  function startFling(v) {
    stopFling()
    if (!(Math.abs(v) > 60)) { settle(); return }
    var f = fling = { v: Math.max(-6000, Math.min(6000, v)), at: performance.now(), y: window.pageYOffset || 0, raf: 0, w: -1 }
    var frame = function (now) {
      if (fling !== f) return
      // something else moved the page (a script, an anchor, the Anteprima): it has it, the fling ends where it is
      if (f.w >= 0 && Math.abs((window.pageYOffset || 0) - f.w) > 40) { fling = null; settle(); return }
      var dt = Math.min(100, now - f.at)
      f.at = now
      f.v *= Math.pow(0.998, dt)
      f.y += f.v * dt / 1000
      var max = Math.max(0, (document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight)
      if (f.y <= 0 || f.y >= max) { f.y = Math.max(0, Math.min(max, f.y)); f.v = 0 }
      armedUntil = Math.max(armedUntil, Date.now() + 400) // the visitor's own scrolling
      ownY = -1
      window.scrollTo({ top: f.y, left: 0, behavior: 'instant' })
      f.w = f.y
      if (Math.abs(f.v) < 8) { fling = null; settle(); return }
      f.raf = requestAnimationFrame(frame)
    }
    f.raf = requestAnimationFrame(frame)
  }
  function stopFling() { if (fling) { cancelAnimationFrame(fling.raf); fling = null } }
  /** The page moved by the finger through the engine (Safari will not take the gesture back). */
  function dragBy(dy) { var y = Math.max(0, (window.pageYOffset || 0) + dy); ownY = -1; armedUntil = Math.max(armedUntil, Date.now() + 400); window.scrollTo({ top: y, left: 0, behavior: 'instant' }) }
  /** The stretch in its last moments: what is left looks still. */
  function nearEnd() { var r = run; return !!r && Math.abs(r.target - r.pos) <= Math.max(12, NEAR * (r.b - r.a)) }
  /** One more gesture the same way as the stretch that plays. One scroll is one slide (20 Nov 2026, Ammiraglio: «a ogni
   *  scrollata corrisponda il passaggio ad una slide diversa»): it is never lost. It books the next stretch, which plays
   *  as soon as this one rests (`next`); at the scene's end, the page going on (`exit`: in the last moments a finger
   *  takes the page at once). Past the first half second it also counts toward insistence (three hurry what is left).
   *  Before (6–8 Nov) such a gesture counted only in the last 5 %: measured on RealMyEstate, a visitor scrolling once a
   *  second and a half needed six scrolls for three slides. */
  function onward(kind) {
    var r = run
    if (!r) return
    var near = nearEnd()
    if (!near) {
      if (Date.now() - r.since < INSIST_FROM) return // the reflexes of whoever came in scrolling, the inertia of the gesture that started it
      insist()
    }
    if (stretchFor({ sc: playing, s: -1, rest: playingStop + (r.dir > 0 ? 1 : 0), n: playing.stops.length }, r.dir) >= 0) { r.next = true; return }
    if (near && kind === 'touch') giveBack()
    else if (near && kind === 'native') { r.released = true; r.lag = false; hold(false) } // the browser already scrolls by this finger: the page is its, nothing written over it
    else r.exit = true
  }
  /** The page goes on past the scene's end that way, after a last stretch the visitor scrolled on through: a wheel
   *  still turning scrolls it itself, a finger still down drags it, else a fling of the engine's carries it about half a
   *  window, as one more scroll of theirs would. */
  function goOn(dir) {
    hold(false)
    if (touching > 0) { drag = true; capture(); return }
    if (Date.now() - lastWheel < WHEEL_PAUSE) { settle(); return }
    startFling(dir * Math.max(500, GO_ON * vh))
  }
  /** The page is the finger's again: it scrolls on with it while the play finishes by itself. */
  function giveBack() { var r = run; if (!r || r.released) return; r.released = true; r.lag = false; drag = true; hold(false) }
  /** Nothing plays, no gesture left to swallow, no momentum to outlast: the page is the visitor's again. */
  function settle() {
    if (playing || tail || flight) return
    hold(false)
    capture()
  }
  function step(now) {
    playRaf = 0
    var r = run
    if (!r || !playing) return
    // something else moved the page (an anchor, a script): it has it. Not while a scroll taken in flight may still push;
    // and on an iPhone never for such a play: a finger landing on a page still in its momentum never reaches the page
    // (Safari gives it to the scroll view: no touch event at all, measured 7 Nov 2026), it can only be seen as the page
    // moving, and letting go there is what skipped the scene when a visitor flicked on as it entered
    if (!r.follow && !r.released && Date.now() >= r.killUntil && Math.abs((window.pageYOffset || 0) - ownY) > 40 && !(r.native && (IOS || Date.now() - r.t0 < 900))) { endPlay(true); return }
    var dt = r.last ? Math.min(now - r.last, 100) / 1000 : 0
    r.last = now
    if (dt > 0 && !held()) {
      var dist = Math.abs(r.target - r.pos)
      // gaining pace (fast up to the pace a play starts at, then at the stretch's rate), never past its top pace, and
      // never more than lets it lose it all, at that same rate, exactly at the rest
      var v = Math.min(r.v + (r.v < r.v0 ? r.att : r.acc) * dt, r.vmax, Math.sqrt(2 * r.acc * dist))
      var by = v * dt
      if (by >= dist - 0.5) { r.pos = r.target; r.v = 0 }
      else { r.pos += (r.target > r.pos ? by : -by); r.v = v }
    }
    // the page itself: with the play. After a scroll taken in flight it is further in than the play, which started at
    // the stretch's edge: it waits there until the play reaches it, never moved back (what scrolls behind a stage
    // would jump); if the play was turned around meanwhile it catches up, fast and without a jump
    if (r.follow) { r.page = Math.min(r.b, Math.max(r.a, window.pageYOffset || 0)); ownY = r.page } // the finger that dragged the page in, still down: the page is its, never fought
    else if (r.released) { r.page = window.pageYOffset || 0; ownY = -1 } // the page given back to the finger at the scene's end
    else if (Date.now() < r.killUntil) { /* the glide that ends the momentum: nothing written over it */ }
    else {
      if (r.lag) {
        var gap = r.pos - r.page
        if (Math.abs(gap) < 0.5) { r.page = r.pos; r.lag = false }
        else if (gap * r.dir > 0 && !held()) r.page += (gap > 0 ? 1 : -1) * Math.min(Math.abs(gap), Math.max(4, 3 * r.vmax * dt))
      } else r.page = r.pos
      ownY = r.page
      window.scrollTo({ top: ownY, left: 0, behavior: 'instant' })
    }
    schedule() // the pieces follow the play itself, also in a frame where the browser's position did not change
    if (r.pos === r.target && !r.lag) endPlay(false)
    else playRaf = requestAnimationFrame(step)
  }
  /** The play is over: at a rest, or taken away by another scroll. The next one waits for a new gesture, unless one was
   *  given while it played (booked: it plays now), or the rest is the scene's start reached by its approach (the first
   *  stretch plays on at once, and back from it the approach glides the scene out). */
  function endPlay(byOther) {
    if (!playing) return
    var r = run, sc = playing, s = playingStop
    fastFor = r && r.fast && !byOther ? { sc: sc, dir: r.dir, at: Date.now() } : null
    var next = r && r.next && !byOther ? s + (r.dir > 0 ? 1 : -1) : -1 // the gesture given while it played: the next stretch
    if (r && !byOther && next < 0 && lead0(sc) && ((s === 0 && r.dir > 0) || (s === 1 && r.dir < 0))) next = s + r.dir // the scene's start is no rest of its own
    var exit = r && r.exit && !byOther && next < 0 ? r.dir : 0 // scrolled on through the last stretch: the page goes on
    playing = null; run = null; armedUntil = 0; userDir = 0; vIn = 0; deferred = false; acc = 0
    if (byOther) { ownY = -1; flight = false } // the page is someone else's now: never pulled back
    if (playRaf) { cancelAnimationFrame(playRaf); playRaf = 0 }
    playEndAt = Date.now(); stepsLater()
    if (next >= 0) { flight = false; tail = false; if (startPlay(sc, next, r.dir, r.target, 0)) return }
    if (exit) { flight = false; tail = false; goOn(exit); return }
    if (flight && r) { if (touching > 0 || r.released) flight = false; else { guardY = r.target; guardAt = Date.now(); guardUntil = guardAt + 1500; if (!guardRaf) guardRaf = requestAnimationFrame(guardStep) } }
    if (r && r.released) { tail = false; settle(); return } // the page is the finger's: nothing to swallow
    if (touching > 0 && tNative) { tail = false; settle(); return } // a finger the browser scrolls by: nothing can be swallowed, and where it goes next is taken as it enters
    tail = true; tailAt = Date.now()
    untail()
  }
  /** After a play what is left of the gesture it took is swallowed: while its finger is still on the screen, while
   *  its wheel has not paused (150 ms without an event: the inertia of a trackpad is over; 2.5 s at most). */
  function untail() {
    clearTimeout(tailTimer)
    if (!tail || playing) return
    var now = Date.now(), wait = now - tailAt > 2500 ? 0 : 150 - (now - lastWheel)
    if (touching || wait > 0) { tailTimer = setTimeout(untail, touching ? 200 : Math.max(20, wait)); return }
    tail = false
    settle()
  }
  /** The direction a gesture asks while a stretch plays: down = on to its stop, up = back to its start. It turns at
   *  the pace it has, and insistence starts over, at the stretch's normal pace. */
  function turn(dir) {
    var r = run
    if (!r || dir === r.dir) return
    r.dir = dir; r.target = dir > 0 ? r.b : r.a; r.next = false; r.exit = false
    r.since = Date.now(); r.pushes = 0; r.lastPush = 0
    if (r.fast) { r.fast = false; r.vmax = r.vmax0; r.acc = r.acc0; r.att = r.att0 }
  }
  /** One more gesture the same way as the stretch that plays (see «the one exception» above). */
  function insist() {
    var r = run, now = Date.now()
    if (!r || r.fast || now - r.since < INSIST_FROM) return
    r.pushes = r.pushes && now - r.lastPush <= INSIST_GAP ? r.pushes + 1 : 1
    r.lastPush = now
    if (r.pushes >= INSIST) hurry()
  }
  /** What is left of the stretch passes in about FAST seconds. The same law of motion, with more pace and more brake:
   *  it gains pace from the one it has, never a jump, and stops exactly on the rest. Never slower than it was. */
  function hurry() {
    var r = run
    if (!r || r.fast) return
    r.fast = true
    var vf = 2 * Math.abs(r.target - r.pos) / FAST
    if (vf <= r.vmax) return // what is left is already that short
    r.vmax = vf
    r.acc = Math.max(r.acc, 2 * vf / FAST)
    r.att = Math.max(r.att, r.acc)
  }
  /** After the mouse button leaves: a scroll made with it (the scroll bar) that left the page inside a stretch.
   *  (Never call this `release`: that is the frame sequences' own, and a second function of that name replaces it
   *  without a word: from 4 to 6 Nov 2026 no far scene was ever freed.) */
  function letGo() {
    if (touching || pressed || !deferred || playing) return
    deferred = false
    if (tail || off()) return
    var y = window.pageYOffset || 0, z = zoneAt(y)
    if (z && z.s >= 0) startPlay(z.sc, z.s, userDir || 1, y, 0)
  }
  var tY0 = 0, tX0 = 0, tY = 0, acc = 0, tPass = false, tMine = false, tNative = false // tNative: the browser scrolls by this finger (its moves cannot be stopped)
  function onTouchStart(e) {
    var t = e.touches && e.touches[0]
    if (!touching && onArrow(e.target)) { tArrow = true; return } // a finger on an arrow of the slides: its tap is the gesture (onArrowTap), never a hold or a scroll
    if (!touching) {
      // a new finger on the screen ends whatever momentum was left: the guard has nothing more to hold
      if (flight) { guardUntil = 0; if (!playing && !tail) { flight = false; settle() } }
      if (fling) { stopFling(); settle() } // a finger on a page flinging through the engine stops it, as on any page
      if (t) { acc = 0; tY0 = tY = fY = stillY = t.clientY; tX0 = stillX = t.clientX; tPass = false; tMine = false; tNative = false; fAt = stillAt = performance.now(); fV = 0; flickDone = false }
    }
    arm(1000)
    touching = e.touches ? e.touches.length : 1
  }
  function onTouchEnd(e) {
    if (tArrow) { if (!(e.touches && e.touches.length)) tArrow = false; return }
    touching = e.touches ? e.touches.length : 0
    if (touching) return
    touchEndAt = Date.now()
    tPass = false; tMine = false
    var fv = performance.now() - fAt < 90 ? fV : 0 // the finger's pace as it left (none after a pause)
    if (playing && run.follow) { // the finger that dragged the page in leaves: its fling is ended, unless the page is its (given back at the scene's end) or it took the page out of the stretch
      run.follow = false
      var yf = window.pageYOffset || 0
      if (run.released) { /* its fling goes on past the scene */ } else if (yf < run.a - REST || yf > run.b + REST) endPlay(true); else kill(Math.abs(fv), fv < 0 ? 1 : -1)
    }
    if (drag) { drag = false; startFling(-fv); arm(1000); capture(); return } // the page was the finger's: it goes on as it would have
    if (tail) { untail(); return } // the touch the play had taken: over with it, not a new gesture
    arm(1000) // the momentum of a flick starts here
    capture()
  }
  function onTouchMove(e) { // blocking: there only while a play may take the gesture (capture)
    var t = e.touches && e.touches[0]
    if (tArrow) { if (e.cancelable) e.preventDefault(); return } // a finger on an arrow: never a scroll of the page under it
    if (!t) return
    touching = e.touches.length // the browser's own count: a touch whose end was never told heals here
    if (!e.cancelable) tNative = true
    var fNow = performance.now()
    if (fNow - fAt > 0) { fV = 0.5 * fV + 0.5 * ((t.clientY - fY) / (fNow - fAt) * 1000); fY = t.clientY; fAt = fNow } // the finger's pace, px/s
    if (Math.abs(t.clientY - stillY) >= 3 || Math.abs(t.clientX - stillX) >= 3) { stillY = t.clientY; stillX = t.clientX; stillAt = fNow } // moving: not a hold
    if (drag) { // the page is the finger's, moved through the engine (Safari will not take the gesture back)
      if (e.cancelable) e.preventDefault()
      var dd = t.clientY - tY
      tY = t.clientY
      if (dd) dragBy(-dd)
      return
    }
    if (playing) { // the finger steers, the page does not scroll
      if (run.follow && e.cancelable) { run.follow = false; run.page = Math.min(run.b, Math.max(run.a, window.pageYOffset || 0)) } // its moves can be stopped after all: the page is the engine's
      if (e.cancelable) e.preventDefault()
      var d = t.clientY - tY
      tY = t.clientY
      acc = (d > 0) === (acc > 0) ? acc + d : d
      if (Math.abs(acc) > 10) {
        var fd = acc > 0 ? -1 : 1 // the finger down the screen = a scroll up
        if (fd !== run.dir) { turn(fd); flickDone = true } // a turn is not insistence
        else if (!flickDone && Math.abs(acc) >= FLICK) { flickDone = true; onward(e.cancelable ? 'touch' : 'native') } // one touch, one gesture at most
      }
      return
    }
    if (tail) { // the finger that was on the screen when the rest came: still, it is nothing; moving on, a gesture at that rest
      if (e.cancelable) e.preventDefault()
      var dt2 = t.clientY - tY
      tY = t.clientY
      acc = (dt2 > 0) === (acc > 0) ? acc + dt2 : dt2
      if (Math.abs(acc) >= FLICK && e.cancelable && !off()) {
        var fd2 = acc > 0 ? -1 : 1, y2 = window.pageYOffset || 0, z2 = zoneAt(y2), s2 = z2 ? stretchFor(z2, fd2) : -1
        tail = false; clearTimeout(tailTimer); acc = 0
        if (s2 >= 0) startPlay(z2.sc, s2, fd2, y2, 0)
        else { drag = true; hold(false); capture() } // out of the scene that way: the page scrolls on with the finger
      }
      return
    }
    // a pinch; a touch that scrolls the page out of the scene; one whose scroll the browser has already begun (if it
    // brings the page into a stretch, the scroll itself is taken there): the browser's
    if (e.touches.length > 1 || tPass || !e.cancelable || off()) return
    var dy = t.clientY - tY0, dx = t.clientX - tX0
    if (Math.abs(dy) < 3 || Math.abs(dx) > Math.abs(dy) * 1.5) { if (tMine) e.preventDefault(); return } // not a scroll yet
    var y = window.pageYOffset || 0, z = zoneAt(y), dir = dy < 0 ? 1 : -1 // the finger up the screen = a scroll down
    var s = z ? stretchFor(z, dir) : -1
    if (s < 0) { tPass = true; return } // out of the scene that way: the page scrolls
    e.preventDefault()
    tMine = true
    if (Math.abs(dy) >= 10) { tY = t.clientY; acc = 0; startPlay(z.sc, s, dir, y, 0) } // past a tap's own play: a scroll
  }
  var wAcc = 0, wAt = 0, wLast = 0, wPush = 0, wHist = []
  /** Is this wheel event a new push of the visitor's, or what is left of the last one? The inertia of a trackpad only
   *  ever loses pace, so a push is the wheel starting again after a pause, or its pace rising sharply over what it was
   *  just before (a flick on top of the inertia); one every WHEEL_EVERY ms at most. A long scroll is one push. */
  function wheelPush(dy, now) {
    var a = Math.abs(dy), is = false
    if (now - wLast >= WHEEL_PAUSE) { wHist = []; is = a >= 3 }
    else {
      var s1 = a, n1 = 1, s0 = 0, n0 = 0
      for (var i = wHist.length - 1; i >= 0; i--) {
        var age = now - wHist[i][0]
        if (age <= 50) { s1 += wHist[i][1]; n1++ } else if (age <= 150) { s0 += wHist[i][1]; n0++ } else break
      }
      is = n0 > 0 && s1 / n1 >= 12 && s1 / n1 >= 1.5 * s0 / n0
    }
    wLast = now
    wHist.push([now, a]); if (wHist.length > 32) wHist.shift()
    if (!is || now - wPush < WHEEL_EVERY) return false
    wPush = now
    return true
  }
  /** A wheel as a gesture: true when the engine takes it (the page must not scroll by it). */
  function wheelIntent(dy) {
    var now = Date.now(), pushed = dy ? wheelPush(dy, now) : false
    lastWheel = now
    if (playing) {
      if (dy) { var wd = dy < 0 ? -1 : 1; if (wd !== run.dir) turn(wd); else if (pushed) onward('wheel') }
      return true
    }
    if (tail) {
      if (!pushed) return true // what is left of the gesture the play took
      tail = false; clearTimeout(tailTimer); settle() // a new push on top of it: a new gesture
    }
    if (!dy || off()) return false
    var y = window.pageYOffset || 0, z = zoneAt(y), dir = dy > 0 ? 1 : -1
    var s = z ? stretchFor(z, dir) : -1
    if (s < 0) { wAcc = 0; if (flight && !tail) { flight = false; settle() } return false } // out of the scene that way: the page scrolls
    wAcc = now - wAt < 200 && (wAcc > 0) === (dy > 0) ? wAcc + dy : dy
    wAt = now
    if (Math.abs(wAcc) >= 4) { wAcc = 0; startPlay(z.sc, s, dir, y, 0) } // a real move of the wheel, not a tremble of the trackpad
    return true
  }
  function onWheel(e) { // blocking: there only while a play may take the gesture (capture)
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return // a pinch, a sideways scroll
    if (!e.cancelable && !playing && !tail) { lastWheel = Date.now(); return } // a scroll the browser has already begun: taken where it enters a stretch
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * (vh || 600) : e.deltaY
    if (wheelIntent(dy) && e.cancelable) e.preventDefault()
  }
  function onWheelSeen(e) { if (e.ctrlKey) return; if (fling) { stopFling(); settle() } arm(1000) }
  var SCROLL_KEYS = { ArrowDown: 1, PageDown: 1, End: 1, ' ': 1, Spacebar: 1, ArrowUp: -1, PageUp: -1, Home: -1 }
  function onKey(e) {
    var k = SCROLL_KEYS[e.key], t = e.target
    // not a field's own keys, nor the space that presses a button
    if (!k || e.altKey || e.ctrlKey || e.metaKey || (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || (k === 1 && e.key !== 'ArrowDown' && e.key !== 'PageDown' && e.key !== 'End' && /^(BUTTON|SUMMARY)$/.test(t.tagName))))) return
    var dir = k === 1 && e.shiftKey && (e.key === ' ' || e.key === 'Spacebar') ? -1 : k // shift + space scrolls up
    if (fling) { stopFling(); settle() }
    if (playing) { e.preventDefault(); keysTaken[e.key] = true; if (dir !== run.dir) turn(dir); else if (!e.repeat) onward('key'); return }
    if (keysTaken[e.key] || tail) { e.preventDefault(); keysTaken[e.key] = true; return } // still down from the play: not a new gesture
    arm(1000)
    if (off()) return
    var y = window.pageYOffset || 0, z = zoneAt(y), s = z ? stretchFor(z, dir) : -1
    if (s < 0) return // out of the scene that way, or in no scene: the page scrolls
    e.preventDefault()
    keysTaken[e.key] = true
    startPlay(z.sc, s, dir, y, 0)
  }
  function onKeyUp(e) { if (keysTaken[e.key]) delete keysTaken[e.key] }
  function onPointerDown(e) { if (e.pointerType !== 'touch' && !onArrow(e.target)) { pressed = true; pressAt = performance.now() } } // a press on an arrow is a tap, never a hold
  function onPointerUp(e) { if (e.pointerType !== 'touch' && pressed) { pressed = false; letGo() } }
  function onPointerMove(e) { if (pressed && e.pointerType !== 'touch' && e.buttons === 0) { pressed = false; letGo() } } // let go outside the window
  function onBlur() { pressed = false; touching = 0; keysTaken = {}; drag = false; stopFling(); if (tail) untail() }
  /** The page px a link to `#id` scrolls to (as the browser would: the element's top, less its scroll margin and the
   *  page's scroll padding), 0 for `#` and `#top`, -1 when it leads nowhere on this page. */
  function linkTarget(href) {
    if (href.charAt(0) !== '#') return -1
    var id = href.slice(1)
    try { id = decodeURIComponent(id) } catch (e) { /* as it is */ }
    if (!id || id === 'top') return 0
    var el = document.getElementById(id) || document.getElementsByName(id)[0]
    if (!el) return -1
    var m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0, pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    return Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || 0) - m - pad)
  }
  /** A link of the page. One that leads into the scene the page is in (a «scopri come» under a hero, a few lines
   *  down) is the gesture itself: the stretch that way plays, at once, and the page does not scroll to the link's own
   *  point first. Any other goes where it says: what it scrolls is not the visitor's scrolling and passes through the
   *  scenes (a stretch that plays lets the page go); only if it leaves the page inside a stretch does that stretch
   *  play on, to the rest that way (`linkRest`). */
  function onClick(e) {
    armedUntil = 0
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null
    if (!a || e.defaultPrevented) return
    var y = window.pageYOffset || 0, to = linkTarget(a.getAttribute('href') || '')
    if (to >= 0 && !off()) {
      var z = zoneAt(y), zt = zoneAt(to)
      if (z && zt && z.sc === zt.sc && Math.abs(to - y) > REST) {
        var dir = to > y ? 1 : -1, s = stretchFor(z, dir)
        if (playing) { e.preventDefault(); turn(dir); return }
        if (s >= 0) { e.preventDefault(); if (!tail) startPlay(z.sc, s, dir, y, 0); return }
      }
    }
    if (playing || tail || flight || fling || drag) { endPlay(true); tail = false; flight = false; drag = false; stopFling(); clearTimeout(tailTimer); hold(false); capture() }
    if (to >= 0) { linkUntil = Date.now() + 4000; linkDir = to > y ? 1 : -1 }
  }
  var linkUntil = 0, linkDir = 0, linkTimer = 0
  /** Where a link's own scroll has ended: inside a stretch, that stretch plays on to the rest that way. */
  function linkRest() {
    linkUntil = 0
    if (playing || tail || off()) return
    var y = window.pageYOffset || 0, z = zoneAt(y)
    if (z && z.s >= 0) startPlay(z.sc, z.s, linkDir || 1, y, 0)
  }
  var lockWas = null
  /** While a stretch that took a scroll in flight plays (and its tail lasts): the page unscrollable, the only thing
   *  that ends a fling in Chrome. Where the scroll bar takes room its gutter is kept, so nothing shifts; where it could
   *  not be kept the page stays scrollable. */
  function hold(on, lock) {
    var root = document.documentElement
    if (on) {
      if (lock && !lockWas) {
        var bar = window.innerWidth - root.clientWidth > 0, gutter = false
        try { gutter = !!(window.CSS && CSS.supports && CSS.supports('scrollbar-gutter', 'stable')) } catch (e) { /* no */ }
        if (!bar || gutter) {
          lockWas = [root.style.overflow, root.style.scrollbarGutter]
          if (bar) root.style.scrollbarGutter = 'stable'
          root.style.overflow = 'hidden'
        }
      }
    } else {
      if (lockWas) { root.style.overflow = lockWas[0]; root.style.scrollbarGutter = lockWas[1]; lockWas = null }
    }
  }
  /** The guided play on or off (off: the check scrolls the whole page with the wheel and measures that). */
  function setGuide(on) {
    guide = !!on
    if (!guide && (playing || tail || flight || fling || drag)) { endPlay(true); tail = false; flight = false; drag = false; stopFling(); clearTimeout(tailTimer); hold(false) }
    capture()
  }
  function remeasure() { measure(); schedule(); capture() }
  var measureRaf = 0
  function scheduleMeasure() { if (!measureRaf) measureRaf = requestAnimationFrame(function () { measureRaf = 0; remeasure() }) }

  // ---------- the browser's bars ----------
  // Safari on an iPhone since iOS 26 (Liquid Glass) draws the page on past the bottom of its window, under its bar, and
  // looks, at every scroll, for a fixed or sticky box touching each edge of the window (WebKit,
  // LocalFrameView::fixedContainerEdges: the box under the midpoint 4 px inside the edge, at least 90 % as wide as the
  // window): when it finds one it paints a solid «colour extension» behind its bar in that box's colour, hiding the
  // page there (a box the size of the window keeps the colour already found, and a colour once found stays while its
  // box exists); when it finds none the bar is clear glass over the page. The theme-color meta it ignores.
  //  · The bottom: glass, never a block (Aircade, 4 Nov 2026, Ammiraglio: «un box bianco… bruttissimo», then «non
  //    dovrebbe esserci 'sto blocco: lo sfondo è trasparente, come su apple.com»). A pinned stage touches the edge, so
  //    the engine keeps a «shield» there: a fixed, empty, transparent box that is the first thing Safari hits and that
  //    WebKit counts as hidden (no background, no children): its walk ends on the body, no box, no colour, the glass
  //    shows the page. Pointer-events must stay on (off, Safari looks again under it).
  //  · The top, where the clock is: a solid strip in the colour of what the page shows there, its header («la
  //    trasparenza in alto non mi piace: se c'è un header scuro, sopra non deve essere trasparente», 4 Nov 2026). The
  //    same box at the top edge is painted with the colour of the page just under it (the boxes there composited,
  //    same-origin pictures and canvases read as pixels, then the page's canvas), refreshed as the page moves: Safari
  //    finds it first and extends that colour behind the clock. The same colour goes into the theme-color meta, which
  //    the bars of Chrome, Firefox and Samsung on Android and of Safari before iOS 26 follow.
  //  · Under the bar: the page is seen for `--under` px past the bottom of its small window (100svh), a length the
  //    engine writes on <html> (0px where the browser's bar is opaque): told by the Anteprima, estimated on the phone
  //    (the screen minus the status bar minus the window, Safari 26 and later in portrait; never short). A pinned stage
  //    ends with the window, so the page's CSS lets it paint on (no vertical clip on the stage, the scene clips
  //    instead) and ends its full-screen layers at `bottom: calc(-1 * var(--under, 0px))`. That Safari draws there
  //    only what scrolls with the page, never a sticky box: the engine holds the stages by the scroll instead («the
  //    pin under the glass», with measure) and tints the ground under whatever still stops short («the ground under a
  //    stage», below). In Safari 27 no block was ever painted at the bottom, shield or not (the simulator, 6 Nov
  //    2026): what Ammiraglio saw under the scenes was the section's own ground. The shield stays for the Safaris
  //    that do paint one.
  // The live pages of the Atelier carry the two boxes in their markup from the first byte (play.ts); on any other page
  // the engine adds them as soon as it runs, so it goes first in the body, before Safari's first look.
  // `<html data-bars="native">` leaves Safari to its own reading.
  var SHIELD_IN = 5 // px of each box inside the window: WebKit reads the box 4 px inside the edge
  var shields = null, barTop = null, barMeta = null, barLast = '', barAt = 0, barTimer = 0, barShown = null
  // The strip has a colour only where a browser's bar sits over the top of the page: a touch screen (iPhone, iPad,
  // Android) and the Anteprima's phone, which tells the engine of Safari's bar (`inset`). On a computer nothing sits
  // there and the strip was a line of colour across the top of the site (20 Nov 2026: the Atelier's full screen showed
  // a cream line over RealMyEstate's dark hero, 5 px tall, on the desktop landing): there it stays transparent.
  var touchScreen = !!(window.matchMedia && (window.matchMedia('(any-pointer: coarse)').matches || window.matchMedia('(pointer: coarse)').matches))
  function stripWanted() { return touchScreen || underTold >= 0 }
  // Who shows the colour read at the top: the strip (above), the ground under Safari's glass bar (`--under`), and
  // theme-color, which on a computer only Safari shows (its tab bar); Chrome, Edge and Firefox ignore it in a tab. On
  // those computers the read is not done: work nobody sees (23 Nov 2026, RealMyEstate's desktop page: a quarter of a
  // second of it on a slow CPU while the page opened, and some more every second).
  var macSafari = (function () { try { var ua = navigator.userAgent; return /Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Electron)\//.test(ua) } catch (e) { return false } })()
  function colorWanted() { return stripWanted() || underPx > 0 || macSafari }
  function shieldsOn() { return document.documentElement.getAttribute('data-bars') !== 'native' }
  function shieldCss(side) { return 'position:fixed;left:0;right:0;' + side + ':' + (SHIELD_IN - 12) + 'px;height:12px;margin:0;padding:0;border:0;background:transparent;z-index:2147483647;pointer-events:auto;display:block' }
  function makeShields() {
    if (shields || !shieldsOn() || !document.body) return
    shields = []
    var sides = ['top', 'bottom']
    for (var i = 0; i < sides.length; i++) {
      var side = sides[i], e = document.querySelector('[data-rd-bar="' + side + '"]')
      if (!e) { e = document.createElement('i'); e.setAttribute('data-rd-bar', side); e.setAttribute('aria-hidden', 'true'); document.body.insertBefore(e, document.body.firstChild) }
      e.style.cssText = shieldCss(side)
      shields.push(e)
      if (side === 'top') barTop = e
    }
  }
  // ---- the colour the page shows at a point ----
  var colorCache = {}, colorCtx = null, pixCtx = null, pixCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null
  var peRoots = [], peScan = 0, lastScrollAt = 0
  /** The roots of the boxes a hit test skips (pointer-events: none, a veil over a scene): the browser paints them all
   *  the same, so a read must see them. Found after every measure and at most every 20 s meanwhile (it reads the style
   *  of every element: never while the page is being scrolled). */
  function scanPointerEvents(now) {
    var t = Date.now()
    if (!now && peScan && (t - peScan < 20000 || t - lastScrollAt < 400)) return
    peScan = t
    peRoots = []
    if (!document.body) return
    var all = document.body.getElementsByTagName('*')
    for (var i = 0; i < all.length; i++) {
      var el = all[i]
      if (el.hasAttribute('data-rd-bar') || getComputedStyle(el).pointerEvents !== 'none') continue
      var p = el.parentElement
      if (!p || p === document.body || getComputedStyle(p).pointerEvents !== 'none') peRoots.push(el)
    }
  }
  /** The boxes a hit test skips, let through for a read (only those that reach the band looked at), then put back.
   *  Where they are is read for all of them before any is changed: a change between two reads restyles the page. */
  function withPointerEvents(y0, y1, fn) {
    var near = [], touched = []
    for (var i = 0; i < peRoots.length; i++) {
      var e = peRoots[i]
      if (!e.isConnected) continue
      var r = e.getBoundingClientRect()
      if (r.bottom < y0 - 400 || r.top > y1 + 400) continue
      near.push(e)
    }
    for (var k = 0; k < near.length; k++) { touched.push([near[k], near[k].style.pointerEvents]); near[k].style.pointerEvents = 'auto' }
    try { return fn() } finally { for (var j = 0; j < touched.length; j++) touched[j][0].style.pointerEvents = touched[j][1] }
  }
  /** A computed colour → [r, g, b, a]; rgb()/rgba() read directly, anything else through a canvas, cached by text. */
  function rgba(s) {
    if (!s || s === 'transparent') return [0, 0, 0, 0]
    var c = colorCache[s]
    if (c) return c
    var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s)
    if (m) c = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]]
    else {
      try {
        if (!colorCtx) { var cv = document.createElement('canvas'); cv.width = cv.height = 1; colorCtx = cv.getContext('2d', { willReadFrequently: true }) }
        colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = '#000'; colorCtx.fillStyle = s; colorCtx.fillRect(0, 0, 1, 1)
        var d = colorCtx.getImageData(0, 0, 1, 1).data
        c = [d[0], d[1], d[2], d[3] / 255]
      } catch (e) { c = [0, 0, 0, 0] }
    }
    colorCache[s] = c
    return c
  }
  /** The element's opacity times its ancestors' (what a pixel of it keeps on screen), memoised for one pass. */
  function opacityOf(el, memo) {
    var o = memo.get(el)
    if (o !== undefined) return o
    var p = el.parentElement
    o = (parseFloat(getComputedStyle(el).opacity) || 0) * (p && p !== document.documentElement ? opacityOf(p, memo) : 1)
    memo.set(el, o)
    return o
  }
  // ---- a big picture's colours, read without decoding it on the main thread ----
  // One pixel of a picture read through a canvas decodes the whole picture there, on the page's main thread, while the
  // page waits: 40–50 ms for a painting of 720×900 on a slow phone's CPU, again for every new picture that comes under
  // the line read (23 Nov 2026: RealMyEstate's hero changes its picture every second or so). So a big picture is read
  // from a small copy of its own (THUMB px on its long side), made once per address, decoded where the browser does it
  // off the main thread: Chromium and Firefox decode a fetched copy in their own threads (createImageBitmap of a Blob),
  // WebKit the picture itself (img.decode()) and then draws it small from what it decoded. Until the copy is there the
  // read looks through the picture and says so (`waited`): the colour already shown stays, and the read is done again
  // when the copy arrives. The reads asked from outside (bar(), colorAt(): the Anteprima) go the old way meanwhile.
  // The copy's pixel is the mean of a few px of the picture around the point: steadier than the single px it replaces,
  // which on a textured picture jumped from one read to the next (RealMyEstate's books under the clock: cyan, dark
  // teal, light grey, one second apart). The copies are kept up to THUMB_BYTES in all, then the old way.
  var THUMB = 128, THUMB_MIN = 256 * 256, THUMB_BYTES = 8e6, WAIT = 'wait', thumbs = {}, thumbN = 0, thumbTimer = 0, waited = false, readSync = false
  var webkitOnly = (function () { try { var ua = navigator.userAgent; return /AppleWebKit\//.test(ua) && !/(Chrome|Chromium)\//.test(ua) } catch (e) { return false } })()
  /** The small copy of a picture: {w, h, d} (its pixels, RGBA), WAIT while it is made, null when it cannot be made (the
   *  picture is then read the old way). */
  function thumbOf(el, src, nw, nh) {
    var th = thumbs[src]
    if (th !== undefined) return th
    var k = Math.min(1, THUMB / Math.max(nw, nh)), tw = Math.max(1, Math.round(nw * k)), tH = Math.max(1, Math.round(nh * k))
    if (thumbN + tw * tH * 4 > THUMB_BYTES) return null // many big pictures under the line: the old way for the rest
    thumbN += tw * tH * 4
    thumbs[src] = WAIT
    var made = function (from, bitmap) {
      try {
        var cv = document.createElement('canvas'); cv.width = tw; cv.height = tH
        var cx = cv.getContext('2d', { willReadFrequently: true })
        try { cx.imageSmoothingQuality = 'high' } catch (e) { /* older */ }
        cx.drawImage(from, 0, 0, tw, tH)
        thumbs[src] = { w: tw, h: tH, d: cx.getImageData(0, 0, tw, tH).data }
      } catch (e) { thumbs[src] = null }
      if (bitmap && from.close) { try { from.close() } catch (e) { /* gone */ } }
      thumbReady()
    }
    var failed = function () { thumbs[src] = null; thumbReady() }
    try {
      if (!webkitOnly && typeof createImageBitmap === 'function' && typeof fetch === 'function') {
        fetch(src, { cache: 'force-cache' }).then(function (res) { if (!res.ok) throw new Error(String(res.status)); return res.blob() }).then(function (b) { return createImageBitmap(b) }).then(function (bm) { made(bm, true) }, failed)
      } else if (typeof el.decode === 'function') el.decode().then(function () { made(el, false) }, failed)
      else thumbs[src] = null
    } catch (e) { thumbs[src] = null }
    return thumbs[src]
  }
  /** A copy has arrived (or could not be made): the reads that waited for it are done again. */
  function thumbReady() { clearTimeout(thumbTimer); thumbTimer = setTimeout(function () { barAt = 0; paintBar() }, 30) }
  /** The pixel of a picture or a canvas at (x, y) on screen, [r, g, b, a], or null when it cannot be read (another
   *  origin, a WebGL canvas, not loaded, a big picture's copy still being made). Read at most every 100 ms per element:
   *  a readback stalls the drawing. */
  function pixelOf(el, x, y) {
    var now = Date.now(), hit = pixCache && pixCache.get(el)
    if (hit && now - hit.t < 100 && Math.abs(hit.x - x) < 2 && Math.abs(hit.y - y) < 2) return hit.c
    var c = null
    try {
      var r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        var fx = (x - r.left) / r.width, fy = (y - r.top) / r.height
        if (el.tagName === 'CANVAS') {
          var ctx = el.getContext('2d')
          if (ctx) { var d = ctx.getImageData(Math.min(el.width - 1, Math.floor(fx * el.width)), Math.min(el.height - 1, Math.floor(fy * el.height)), 1, 1).data; c = [d[0], d[1], d[2], d[3] / 255] }
        } else {
          var nw = el.naturalWidth || el.videoWidth || 0, nh = el.naturalHeight || el.videoHeight || 0
          var src = el.currentSrc || el.src || ''
          var same = !src || src.indexOf('data:') === 0 || src.indexOf('blob:') === 0 || new URL(src, location.href).origin === location.origin
          if (nw > 0 && nh > 0 && same && !(el.tagName === 'IMG' && !el.complete)) {
            var th = el.tagName === 'IMG' && src && nw * nh >= THUMB_MIN ? thumbOf(el, src, nw, nh) : null
            if (th === WAIT && !readSync) { waited = true; return null } // looked through for now, read again when it is there
            if (th && th !== WAIT) {
              var tx = Math.max(0, Math.min(th.w - 1, Math.floor(fx * th.w))), ty = Math.max(0, Math.min(th.h - 1, Math.floor(fy * th.h))), o = (ty * th.w + tx) * 4
              c = [th.d[o], th.d[o + 1], th.d[o + 2], th.d[o + 3] / 255]
            } else {
              if (!pixCtx) { var cv = document.createElement('canvas'); cv.width = cv.height = 1; pixCtx = cv.getContext('2d', { willReadFrequently: true }) }
              pixCtx.clearRect(0, 0, 1, 1)
              pixCtx.drawImage(el, Math.min(nw - 1, Math.floor(fx * nw)), Math.min(nh - 1, Math.floor(fy * nh)), 1, 1, 0, 0, 1, 1)
              var d2 = pixCtx.getImageData(0, 0, 1, 1).data
              c = [d2[0], d2[1], d2[2], d2[3] / 255]
            }
          }
        }
      }
    } catch (e) { c = null; pixCtx = null }
    if (pixCache) pixCache.set(el, { t: now, x: x, y: y, c: c })
    return c
  }
  /** The browser's own canvas under the page: white, the html's background over it, the body's over that. */
  function canvasUnder() {
    var out = [255, 255, 255], layers = [document.documentElement, document.body]
    for (var i = 0; i < layers.length; i++) {
      if (!layers[i]) continue
      var c = rgba(getComputedStyle(layers[i]).backgroundColor), a = c[3]
      if (a > 0) out = [c[0] * a + out[0] * (1 - a), c[1] * a + out[1] * (1 - a), c[2] * a + out[2] * (1 - a)]
    }
    return out
  }
  /** The colour the page shows at (x, y): the boxes under the point composited from the top (pictures as pixels, a
   *  gradient or an unreadable picture looked through), then the canvas under the page. */
  function colorAt(x, y, memo, u) {
    var stack = document.elementsFromPoint(x, y) // top first
    var r = 0, g = 0, b = 0, a = 0
    for (var i = 0; i < stack.length && a < 0.985; i++) {
      var el = stack[i]
      if (el === document.documentElement || el === document.body) break
      if (el.hasAttribute('data-rd-bar')) continue
      var op = opacityOf(el, memo)
      if (op < 0.01) continue
      var tag = el.tagName, c = null
      // never the engine's own frame sequences: reading a canvas back while the scroll draws on it stalls the drawing
      if (tag === 'IMG' || tag === 'VIDEO' || (tag === 'CANVAS' && !el.hasAttribute('data-frames'))) c = pixelOf(el, x, y)
      if (!c) c = rgba(getComputedStyle(el).backgroundColor)
      if (c[3] <= 0) continue
      var sa = c[3] * op * (1 - a)
      r += c[0] * sa; g += c[1] * sa; b += c[2] * sa; a += sa
    }
    if (a < 0.985) { var rest = 1 - a; r += u[0] * rest; g += u[1] * rest; b += u[2] * rest }
    return [r, g, b]
  }
  var far = function (p, q) { return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])) > 24 }
  var mean = function (ps) { var o = [0, 0, 0]; for (var i = 0; i < ps.length; i++) { o[0] += ps[i][0] / ps.length; o[1] += ps[i][1] / ps.length; o[2] += ps[i][2] / ps.length } return o }
  var cssOf = function (c) { return 'rgb(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ')' }
  /** One colour for the line y of the window out of three samples (centre, left, right): their mean when they agree,
   *  else the two that do, else the centre, where WebKit itself reads. */
  function lineColor(y) {
    var vw = window.innerWidth
    if (!(vw > 0) || typeof document.elementsFromPoint !== 'function') return ''
    scanPointerEvents(false)
    return withPointerEvents(y, y, function () {
      var memo = new Map(), u = canvasUnder(), xs = [vw * 0.5, vw * 0.2, vw * 0.8], cs = []
      for (var i = 0; i < xs.length; i++) cs.push(colorAt(xs[i], y, memo, u))
      return cssOf(!far(cs[0], cs[1]) && !far(cs[0], cs[2]) ? mean(cs) : !far(cs[1], cs[2]) ? mean([cs[1], cs[2]]) : cs[0])
    })
  }
  // ---- the ground under a stage ----
  // Under the bar a layer of a stage shows only if it goes on to the bottom of the screen (and, in the Safari that cuts
  // sticky boxes at the window, only when the engine holds the stage by the scroll). Where one stops short, what shows
  // below it is the ground of the stage's parent, the section: another colour, a band. So the ground takes the colour
  // those short layers show along the window's last line, read at its two ends (the scene's ground, not the picture
  // standing in the middle): an inset shadow over the parent's own background, under everything it holds, in the flow.
  // Layers that reach the bottom paint there themselves and are left out; nothing short, no tint.
  /** What the layers of the stage that stop short of `bottom` show at (x, y): [r, g, b, a], colour not premultiplied. */
  function shortAt(sc, x, y, bottom, memo, cut) {
    var stack = document.elementsFromPoint(x, y), r = 0, g = 0, b = 0, a = 0
    for (var i = 0; i < stack.length && a < 0.985; i++) {
      var el = stack[i]
      if (!sc.stage.contains(el)) continue
      var op = opacityOf(el, memo)
      if (op < 0.01) continue
      var tag = el.tagName, c = null
      if (tag === 'IMG' || tag === 'VIDEO' || (tag === 'CANVAS' && !el.hasAttribute('data-frames'))) c = pixelOf(el, x, y)
      if (!c) c = rgba(getComputedStyle(el).backgroundColor)
      var reaches = !cut && el.getBoundingClientRect().bottom >= bottom - 1
      if (reaches) { if (c[3] * op >= 0.985) break; continue } // it paints under the bar itself; opaque, it hides the rest there too
      if (c[3] <= 0) continue
      var sa = c[3] * op * (1 - a)
      r += c[0] * sa; g += c[1] * sa; b += c[2] * sa; a += sa
    }
    return a > 0.004 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0]
  }
  function tintOf(sc, yb, bottom) {
    var vw = window.innerWidth, memo = new Map(), cut = !sc.pinAnim && glass() > 0
    var l = shortAt(sc, Math.max(1, vw * 0.02), yb, bottom, memo, cut), r = shortAt(sc, vw - Math.max(1, vw * 0.02), yb, bottom, memo, cut)
    var same = function (p, q) { return !far(p, q) && Math.abs(p[3] - q[3]) < 0.12 }
    var c = same(l, r) ? [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, (l[2] + r[2]) / 2, (l[3] + r[3]) / 2] : null
    if (!c) { var m = shortAt(sc, vw * 0.5, yb, bottom, memo, cut); c = same(m, l) ? l : same(m, r) ? r : null }
    if (!c || c[3] < 0.02) return ''
    return 'rgba(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ', ' + (c[3] >= 0.985 ? 1 : +c[3].toFixed(3)) + ')'
  }
  function setTint(sc, css) {
    if (css === sc.tint) return
    var g = sc.ground
    if (!g) { g = sc.ground = sc.stage.parentElement; if (!g) return; sc.groundWas = g.style.boxShadow; sc.groundOwn = getComputedStyle(g).boxShadow }
    sc.tint = css
    g.style.boxShadow = !css ? sc.groundWas : (sc.groundOwn && sc.groundOwn !== 'none' ? sc.groundOwn + ', ' : '') + 'inset 0 0 0 9999px ' + css
  }
  /** Every stage that crosses the window's last line: its parent's ground tinted with what stops short there. */
  function paintGround() {
    if (!(underPx > 0) || typeof document.elementsFromPoint !== 'function') { for (var i = 0; i < scenes.length; i++) if (scenes[i].tint) setTint(scenes[i], ''); return }
    var yb = window.innerHeight - insetB - 2, bottom = svh + underPx, todo = []
    for (var j = 0; j < scenes.length; j++) {
      var sc = scenes[j]
      if (!sc.stage) continue
      var r = sc.stage.getBoundingClientRect()
      if (r.top < yb && r.bottom >= yb) todo.push(sc); else if (sc.tint) setTint(sc, '')
    }
    if (!todo.length) return
    scanPointerEvents(false)
    // a tint that waits for a picture's copy stays as it is (none yet: the one read now), and is read again with it
    withPointerEvents(yb, yb, function () { for (var k = 0; k < todo.length; k++) { waited = false; var css = tintOf(todo[k], yb, bottom); if (!waited || !todo[k].tint) setTint(todo[k], css) } })
  }
  /** The strip at the top and the theme-color meta painted with what the page shows just under the strip, now; only
   *  where someone shows that colour (colorWanted), or when asked from outside (`asked`: bar()). */
  function paintBar(asked) {
    barAt = Date.now()
    if (!shieldsOn()) return
    try { paintGround() } catch (e) { /* the page as it is */ }
    if (!barTop || !(asked === true || colorWanted())) return
    waited = false
    var c = lineColor(SHIELD_IN + 1)
    if (!c || (waited && barLast)) return // a picture under the line still being read: the colour shown stays until it is
    var show = stripWanted() ? c : ''
    if (show !== barShown) { barShown = show; barTop.style.backgroundColor = show }
    if (c === barLast) return
    barLast = c
    if (!barMeta) {
      barMeta = document.querySelector('meta[name="theme-color"]')
      if (!barMeta) { barMeta = document.createElement('meta'); barMeta.setAttribute('name', 'theme-color'); (document.head || document.documentElement).appendChild(barMeta) }
    }
    if (barMeta.getAttribute('content') !== c) barMeta.setAttribute('content', c)
  }
  /** As the page moves: at most one read every 100 ms, and one more when it has settled. */
  function bars() {
    if (!barTop) return
    if (Date.now() - barAt >= 100) paintBar()
    clearTimeout(barTimer)
    barTimer = setTimeout(paintBar, 260)
  }
  // ---- how far the page is seen under the browser's bar ----
  // The Anteprima draws the page under Safari's bar as the iPhone does (its frame is as tall as the screen): told the
  // bar's height now (`inset`) and how far the screen goes on under the small window (`under`), the engine lays out as
  // if the window ended above the bar, and the page's boxes anchored to the bottom (a fixed or sticky bar) are lifted
  // above it, as Safari lifts them.
  var insetB = 0, underTold = -1, underPx = -1, lifted = []
  function liftBottoms() {
    for (var i = 0; i < lifted.length; i++) lifted[i][0].style.bottom = lifted[i][1]
    lifted = []
    if (!insetB || !document.body) return
    var all = document.body.getElementsByTagName('*')
    for (var j = 0; j < all.length; j++) {
      var el = all[j]
      if (el.hasAttribute('data-rd-bar')) continue
      var cs = getComputedStyle(el), pos = cs.position
      if ((pos !== 'fixed' && pos !== 'sticky') || cs.bottom === 'auto' || cs.top !== 'auto') continue
      lifted.push([el, el.style.bottom])
      el.style.bottom = ((parseFloat(cs.bottom) || 0) + insetB) + 'px'
    }
  }
  /** Safari on an iPhone, 26 or later, upright: the px of screen under the small window, where the page is seen through
   *  the bar. The status bar by the screen's height (the notch 44–50, the island 59–62, a home button 20; an unknown
   *  screen gets the smallest of its kind, so the length is never short). 0 anywhere else: the bar there is opaque. */
  function underGuess() {
    try {
      if (!glass() || window.innerWidth > window.innerHeight || !document.body) return 0
      var sh = Math.max(screen.height, screen.width), small = probe('100svh')
      var top = sh <= 736 ? 20 : sh === 844 || sh === 926 ? 47 : sh === 852 || sh === 932 ? 59 : sh === 874 || sh === 956 ? 62 : sh === 896 ? 44 : sh < 852 ? 44 : 59
      var u = Math.round(sh - top - small)
      return small > 200 && u >= 24 && u <= 220 ? u + 6 : 0 // a few px more: a layer a hair past the screen costs nothing, one short of it shows
    } catch (e) { return 0 }
  }
  function setUnder() {
    var u = insetB ? (underTold >= 0 ? underTold : insetB) : underGuess()
    if (u === underPx) return
    underPx = u
    document.documentElement.style.setProperty('--under', u + 'px')
  }
  makeShields() // the script runs inside the body: the boxes are there before Safari's first look
  setUnder()

  // ---------- start ----------
  function init() {
    if (!document.body) return
    makeShields()
    collect()
    measure()
    update()
    paintBar()
    setInterval(function () { if (!document.hidden) paintBar() }, 1000) // what moves by itself under the clock (a timed entrance, a picture that loads)
    prevY = window.pageYOffset || 0 // the first scroll has a direction too (a single wheel notch is one event)
    prevAt = performance.now()
    window.addEventListener('scroll', onScroll, { passive: true })
    var lastW = window.innerWidth
    window.addEventListener('resize', function () { if (window.innerWidth !== lastW) { lastW = window.innerWidth; scheduleMeasure() } else laterMeasure() })
    window.addEventListener('orientationchange', scheduleMeasure)
    window.addEventListener('load', scheduleMeasure)
    document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') laterMeasure() }, true)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure)
    if (typeof ResizeObserver !== 'undefined') { try { new ResizeObserver(laterMeasure).observe(document.body) } catch (e) { /* */ } }
    // the visitor's gestures: they start the guided plays (tests make none); a finger or a mouse button held still
    // freezes a stretch that plays; the listeners that block are added by capture(), only where a play may take one
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true })
    window.addEventListener('wheel', onWheelSeen, { passive: true, capture: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true, capture: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true, capture: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true })
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    window.addEventListener('blur', onBlur)
    window.addEventListener('click', onClick, { capture: true })
    capture() // the page may open at a rest of a scene (a hero): its first gesture is taken
  }
  var laterTimer = 0
  function laterMeasure() { clearTimeout(laterTimer); laterTimer = setTimeout(scheduleMeasure, 350) }
  window.__rdScene = {
    version: 11,
    /** The stretch playing right now (its scene, its index, how far along it the page is, 0 at its upper rest … 1 at
     *  its lower one, direction 1 down / -1 up, pace in px/s, whether a hold freezes it, its two rests in page px, whether
     *  it took a scroll in flight, the gestures of insistence so far and whether it is hurried), or null. */
    playing: function () { return playing && run ? { scene: playing.name, stop: playingStop - lead0(playing), approach: !!playing.stops[playingStop].ap, exit: run.exit, u: +((run.pos - run.a) / (run.b - run.a)).toFixed(4), dir: run.dir, v: Math.round(run.v), held: held(), from: run.a, to: run.b, native: run.native, page: Math.round(run.page), pushes: run.pushes, fast: run.fast, follow: run.follow, released: run.released, next: run.next, killing: Date.now() < run.killUntil } : null },
    /** A wheel that reached the page from outside (the Anteprima's device frame), as one inside it: true when the engine
     *  takes it (a stretch starts, plays or has just ended), false when the page should scroll by it. */
    wheel: function (dy) { if (wheelIntent(+dy || 0)) return true; arm(1000); return false },
    /** The guided play on (the default) or off: off, the scenes are scrubbed by the scroll (the check's own scrolling). */
    guided: function (on) { if (typeof on === 'boolean') setGuide(on); return guide },
    /** Whether the engine holds the gestures here (the page in a scene's stretches or at a rest), and the page locked. */
    held: function () { return { capture: captured, tail: tail, guard: flight && !playing, lock: !!lockWas, snapOff: !!snapWas, snapLive: snapLive, drag: drag, fling: !!fling, zone: (function (z) { return z ? { scene: z.sc.name, rest: z.rest, s: z.s } : null })(zoneAt(window.pageYOffset || 0)) } },
    measure: remeasure,
    settle: catchUp,
    /** The Anteprima: the px of the window taken by Safari's bar at the bottom, under which the page is drawn. */
    inset: function (px, under) { px = Math.max(0, +px || 0); var u = typeof under === 'number' && under >= 0 ? under : -1; if (px === insetB && u === underTold) return; insetB = px; underTold = u; liftBottoms(); remeasure(); paintBar() },
    /** How each pinned stage is held now: 'scroll' (in the flow, moved by a scroll timeline: drawn under Safari's glass
     *  bar) or 'sticky'; and the tint of its ground ('' = none). */
    pins: function () { return scenes.filter(function (s) { return !!s.stage }).map(function (s) { return { name: s.name, by: s.pinAnim ? 'scroll' : 'sticky', tint: s.tint } }) },
    /** The engine's boxes at the edges are there (none: data-bars="native"). */
    shields: function () { return !!shields },
    /** The px of page seen under the browser's bar (`--under`), and the colour of the strip at the top, read now. */
    under: function () { return Math.max(0, underPx) },
    bar: function () { readSync = true; try { paintBar(true) } finally { readSync = false } return barLast },
    /** The colour the page shows along a line of the window (y px from its top): the Anteprima's glass, the check. */
    colorAt: function (y) { readSync = true; try { return lineColor(y) } finally { readSync = false } },
    /** The trail of the shown position behind the real one, ms (0 = none). */
    smooth: function (ms) { if (typeof ms === 'number') { SMOOTH = Math.max(0, ms); catchUp() } return SMOOTH },
    /** Decoded frame bytes held right now, and the canvases' own stores: for the Atelier's check. */
    memory: function () { var b = 0; for (var i = 0; i < seqs.length; i++) { var q = seqs[i]; b += q.w * q.h * 4; for (var k = 0; k < q.n; k++) { var im = frameImage(q, k); if (im) b += (im.width || im.naturalWidth || 0) * (im.height || im.naturalHeight || 0) * 4 } } return b },
    /** The scenes; for a guided play also its approach (px) and its rests in page px (the first is where the approach
     *  begins when there is one, then the scene's start and each stop). */
    scenes: function () { return scenes.map(function (s) { var rests = null; if (s.stops) { rests = []; for (var k = 0; k <= s.stops.length; k++) rests.push(Math.round(restY(s, k))) } return { name: s.name, pin: s.pin, travel: s.travel, lead: s.lead, p: s.p, play: s.play, ap: s.ap, rests: rests } }) },
    /** The slide indicators: their scene, shown, the chevron asking for a scroll, how full each segment is. */
    steps: function () { paintSteps(); return scenes.filter(function (s) { return !!s.steps }).map(function (s) { var f = []; for (var k = 0; k < s.steps.last.length; k++) f.push(+s.steps.last[k].toFixed(3)); return { scene: s.name, shown: s.steps.on, wait: s.steps.wait, fills: f, n: s.steps.fills.length } }) },
    sequences: function () { return seqs.map(function (q) { var n = 0; for (var k = 0; k < q.n; k++) if (frameImage(q, k)) n++; return { frames: q.n, loaded: n, state: q.state, key: q.key, draws: q.draws || 0 } }) },
    stats: function () { return { releases: stats.releases.slice(), draws: stats.draws, drawMax: +stats.drawMax.toFixed(1), drawMean: +(stats.draws ? stats.drawTotal / stats.draws : 0).toFixed(2), decodes: stats.decodes, decodeMax: +stats.decodeMax.toFixed(1), decodeMean: +(stats.decodes ? stats.decodeTotal / stats.decodes : 0).toFixed(1) } },
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init()
})()
