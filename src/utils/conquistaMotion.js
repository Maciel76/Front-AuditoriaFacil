import { animate, createScope, createSeededRandom } from "@/vendor/animejs/anime.esm.min.js";

// Each material has its own rhythm. Particles are deterministic, so filtering
// achievements never changes their composition or creates random layout shifts.
export const CONQUISTA_MOTION = {
  comum: { rank: 1, duration: 1900, rest: 6500, particles: 0 },
  raro: { rank: 2, duration: 2400, rest: 4000, particles: 0 },
  epico: { rank: 3, duration: 3000, rest: 3200, particles: 3 },
  lendario: { rank: 4, duration: 3400, rest: 2600, particles: 6 },
  diamante: { rank: 5, duration: 2800, rest: 3400, particles: 5 },
  mitico: { rank: 6, duration: 4600, rest: 2200, particles: 6 },
  suprema: { rank: 7, duration: 5200, rest: 2400, particles: 7 },
  transcendente: { rank: 8, duration: 6400, rest: 1800, particles: 8 },
};

export function createFireVariation(key, rank = 3) {
  let seed = 2166136261;
  for (const char of String(key)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const random = createSeededRandom(seed >>> 0);
  const count = rank < 3 ? 2 : rank < 6 ? 4 : 6;
  return {
    outerSeed: random(1, 997),
    innerSeed: random(1, 997),
    frequency: random(0.055, 0.075, 4),
    strength: 17 + rank * 1.3,
    duration: random(6200, 9100),
    innerDuration: random(3700, 5400),
    breathDuration: random(7300, 10300),
    phase: random(0.05, 0.95, 3),
    sparks: Array.from({ length: count }, (_, index) => ({
      x: index % 2 ? random(99, 105) : random(-5, 1),
      y: random(25, 104),
      size: random(1.1, 2.1, 1),
      drift: random(-9, 9),
      rise: random(27, 65),
      duration: random(2700, 5100),
      rest: random(1100, 3900),
      phase: random(0, 0.95, 3),
    })),
  };
}

export function createConquistaMotion(element, {
  tier, unlocked, compact = false, mode = "banner", fireScale = 1, variation,
}) {
  const material = CONQUISTA_MOTION[tier];
  if (!element || !unlocked || !material) return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scope = createScope({ root: element });
  const loops = [];
  let visible = false;
  let disposed = false;
  let accent = null;
  let initialized = false;
  const addLoop = (target, options, phase = 0) => {
    const nodes = typeof target === "string" ? element.querySelectorAll(target) : target;
    if (!nodes || (typeof target === "string" && !nodes.length)) return;
    const animation = animate(nodes, {
      autoplay: false, loop: true,
      ...(mode === "fire" ? { frameRate: 30 } : {}), ...options,
    });
    // Start at different phases without negative delays or a visible restart.
    if (phase) animation.seek(animation.iterationDuration * phase, true);
    loops.push(animation);
  };

  function initialize() {
    if (initialized) return;
    initialized = true;
    scope.add(() => {
      if (mode === "fire") {
        const fire = variation || createFireVariation(tier, material.rank);
        const size = fireScale;
        // Separate noise fields and non-matching periods create depth. All
        // deformation tracks alternate, avoiding the old jump at each loop.
        addLoop(".conq-fire-outer-drift", {
          dx: [-3 * size, 4 * size],
          dy: [8 * size, -13 * size],
          duration: fire.duration,
          alternate: true,
          ease: "inOutSine",
        }, fire.phase);
        addLoop(".conq-fire-outer-warp", {
          scale: [fire.strength * size * 0.85, fire.strength * size * 1.25],
          duration: fire.innerDuration * 1.37,
          alternate: true,
          ease: "inOutSine",
        }, (fire.phase + 0.31) % 1);
        addLoop(".conq-fire-inner-drift", {
          dx: [2 * size, -2 * size],
          dy: [4 * size, -8 * size],
          duration: fire.innerDuration,
          alternate: true,
          ease: "inOutSine",
        }, (fire.phase + 0.57) % 1);
        addLoop(".conq-fire-inner-warp", {
          scale: [fire.strength * size * 0.27, fire.strength * size * 0.49],
          duration: fire.duration * 0.73,
          alternate: true,
          ease: "inOutSine",
        }, (fire.phase + 0.79) % 1);
        addLoop(".conq-photo-fire", {
          opacity: [0.76, 0.98],
          duration: fire.breathDuration,
          alternate: true,
          ease: "inOutSine",
        }, fire.phase);
        element.querySelectorAll(".conq-photo-spark").forEach((node, index) => {
          const spark = fire.sparks[index];
          if (!spark) return;
          addLoop(node, {
            translateX: [0, spark.drift * size],
            translateY: [0, -spark.rise * size],
            opacity: [0, 0.65, 0],
            scale: [0.35, 1, 0.1],
            duration: spark.duration,
            loopDelay: spark.rest,
            ease: "outSine",
          }, spark.phase);
        });
        return;
      }
      addLoop(".conq-fx-sheen", {
        translateX: ["-180%", "620%"],
        opacity: [0, 0.5, 0],
        duration: material.duration,
        loopDelay: material.rest + (compact ? 1800 : 0),
        ease: "inOutSine",
      });
      if (material.rank >= 2) {
        addLoop(".conq-fx-aura", {
          scale: [0.85, 1.15],
          opacity: [0.18, material.rank >= 6 ? 0.55 : 0.36],
          alternate: true,
          duration: material.duration,
          ease: "inOutSine",
        });
      }
      if (material.rank >= 3) {
        addLoop(".conq-fx-orbit", {
          rotate: [0, tier === "mitico" ? -360 : 360],
          duration: material.duration * (tier === "diamante" ? 3 : 2),
          ease: "linear",
        });
        const particles = element.querySelectorAll(".conq-fx-particle");
        particles.forEach((particle, index) => {
          const rising = tier === "lendario" || tier === "mitico";
          loops.push(animate(particle, {
            translateY: rising ? [18, -48 - index * 3] : [5, -9],
            translateX: rising ? [0, (index % 2 ? 1 : -1) * 12] : [0, 5],
            scale: [0.3, 1, 0.3],
            opacity: [0, 0.8, 0],
            duration: material.duration * (0.65 + index * 0.09),
            delay: index * 270,
            loopDelay: 800,
            ease: "inOutSine",
            autoplay: false,
            loop: true,
          }));
        });
      }
    });
  }

  function syncPlayback() {
    if (disposed) return;
    const playing = visible && !document.hidden && !reducedMotion.matches;
    element.classList.toggle("conq-motion-active", playing);
    if (playing) initialize();
    loops.forEach((animation) => playing ? animation.resume() : animation.pause());
    if (!playing && accent) {
      accent.revert();
      accent = null;
    }
  }

  function highlight(event) {
    if (event.type === "pointerenter" && event.pointerType === "touch") return;
    if (!visible || document.hidden || reducedMotion.matches) return;
    const flash = element.querySelector(".conq-fx-flash");
    if (!flash) return;
    accent?.revert();
    accent = animate(flash, {
      opacity: [0, material.rank >= 6 ? 0.45 : 0.28, 0],
      scale: [0.75, 1.15],
      duration: 850,
      ease: "outCubic",
    });
  }

  const observer = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      }, { threshold: 0.05 })
    : null;
  if (observer) observer.observe(element);
  else {
    visible = true;
    syncPlayback();
  }
  document.addEventListener("visibilitychange", syncPlayback);
  reducedMotion.addEventListener("change", syncPlayback);
  element.addEventListener("pointerenter", highlight);
  element.addEventListener("pointerdown", highlight);
  element.addEventListener("focusin", highlight);

  return () => {
    disposed = true;
    observer?.disconnect();
    document.removeEventListener("visibilitychange", syncPlayback);
    reducedMotion.removeEventListener("change", syncPlayback);
    element.removeEventListener("pointerenter", highlight);
    element.removeEventListener("pointerdown", highlight);
    element.removeEventListener("focusin", highlight);
    // Interaction animations live outside the scope and are replaced on hover.
    accent?.revert();
    scope.revert();
    element.classList.remove("conq-motion-active");
  };
}
