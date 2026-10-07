const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;
const $ = (s, r = document) => r.querySelector(s);

/* ---------- meny ---------- */
const burger = $("#burger"), overlay = $("#overlay");
const isOpen = () => overlay.classList.contains("open");
function setMenu(open) {
  overlay.classList.toggle("open", open);
  overlay.toggleAttribute("inert", !open);
  overlay.setAttribute("aria-hidden", String(!open));
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Stäng menyn" : "Öppna menyn");
  document.documentElement.classList.toggle("menu-open", open);
}
burger.addEventListener("click", () => setMenu(!isOpen()));
$("#menuClose").addEventListener("click", () => { setMenu(false); burger.focus(); });
overlay.addEventListener("click", (e) => { if (e.target === overlay) setMenu(false); });
overlay.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) { setMenu(false); burger.focus(); } });
addEventListener("pageshow", () => setMenu(false));

/* ---------- bildspel i toppen ---------- */
const slides = [...document.querySelectorAll(".hero .slide")], dots = [...document.querySelectorAll(".dots button")];
if (slides.length > 1) {
  let cur = 0, timer = null;
  const show = (i) => { cur = i; slides.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.setAttribute("aria-current", String(k === i))); };
  const restart = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => show((cur + 1) % slides.length), 6500); };
  dots.forEach((d, i) => d.addEventListener("click", () => { show(i); restart(); }));
  restart();
}
const hero = $(".hero");
if (hero && !reduce && fine) {
  const layers = [[".hero h1", 26], [".hero p", 16], [".hero .row", 10]].map(([s, d]) => [hero.querySelector(s), d]).filter(([el]) => el);
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    for (const [el, d] of layers) el.style.transform = `perspective(900px) translate3d(${x * d}px,${y * d * 0.6}px,0) rotateY(${x * 6}deg) rotateX(${-y * 4}deg)`;
  });
  hero.addEventListener("pointerleave", () => layers.forEach(([el]) => (el.style.transform = "")));
}

/* ---------- projektpilar ---------- */
const track = $("#track");
if (track) {
  const step = () => track.firstElementChild.getBoundingClientRect().width + 16;
  $("#prev").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" }));
  $("#next").addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" }));
}

/* ---------- kort som lutar ---------- */
if (!reduce) document.querySelectorAll("[data-tilt]").forEach((el) => {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.add("tilting");
    el.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 14}deg) scale(1.02)`;
    el.style.setProperty("--mx", x * 100 + "%"); el.style.setProperty("--my", y * 100 + "%");
  });
  el.addEventListener("pointerleave", () => { el.classList.remove("tilting"); el.style.transform = ""; });
});

/* ---------- delar fälls upp när de syns, siffror räknas upp ---------- */
if (!reduce && "IntersectionObserver" in window) {
  const CARDS = ".newsgrid > *, .cos2 > *, .tiles > *, .minis > *, .cards3 > *, .overlap .ocard";
  const cards = [...document.querySelectorAll(CARDS)];
  // Hela delar animeras bara om de inte innehåller kort (annars blir 3D-lutningen dubbel).
  const blocks = [...document.querySelectorAll("main > section:not(.hero):not(.phero) > .in")].filter((el) => !el.querySelector(CARDS));
  // Platsen mäts på föräldern, som aldrig lutas, så att höga delar alltid hittas.
  const anchorOf = (el) => el.parentElement;
  const below = [...blocks, ...cards].filter((el) => anchorOf(el).getBoundingClientRect().top > innerHeight * 0.9 || el.getBoundingClientRect().top > innerHeight * 0.9);
  const show = (el) => { el.classList.remove("pre"); setTimeout(() => (el.style.transitionDelay = ""), 1400); };
  below.forEach((el) => el.classList.add("pre", "rv"));
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target.__el; io.unobserve(e.target);
    const i = [...(el.parentElement?.children || [])].indexOf(el);
    el.style.transitionDelay = el.matches(CARDS) ? Math.min(i, 7) * 70 + "ms" : "0ms";
    show(el);
  }), { threshold: 0, rootMargin: "0px 0px -8% 0px" });
  // Varje element bevakas via en osynlig markör på sin ursprungliga plats.
  below.forEach((el) => {
    if (el.matches(CARDS)) { el.__el = el; el.__mark = el; io.observe(el); return; } // små kort: lutningen flyttar dem nästan inget
    const m = document.createElement("span"); m.className = "rv-mark"; m.__el = el; el.before(m); el.__mark = m; io.observe(m);
  });
  let sweep = 0;
  const reveal = () => { sweep = 0; document.querySelectorAll(".pre").forEach((el) => { if (el.__mark && el.__mark.getBoundingClientRect().top < innerHeight) { io.unobserve(el.__mark); show(el); } }); };
  addEventListener("scroll", () => { if (!sweep) sweep = setTimeout(reveal, 200); }, { passive: true });

  const nio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; nio.unobserve(e.target);
    const b = e.target, txt = b.textContent, m = txt.match(/\d[\d\s]*/); if (!m) return;
    const end = parseInt(m[0].replace(/\s/g, ""), 10), t0 = performance.now(), fmt = (v) => (end >= 10000 ? v.toLocaleString("sv-SE") : String(v));
    b.classList.add("flip");
    const tick = (t) => { const k = Math.min(1, (t - t0) / 1100), v = Math.round(end * (1 - Math.pow(1 - k, 3))); b.textContent = txt.replace(m[0].trim(), fmt(v)); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  document.querySelectorAll(".t b, .facts b").forEach((b) => { if (!/^\d{4}$/.test(b.textContent.trim())) nio.observe(b); });
}

/* ---------- formulär (testsida: inget skickas) ---------- */
document.querySelectorAll("form[data-demo]").forEach((f) => f.addEventListener("submit", (e) => {
  e.preventDefault();
  const out = f.querySelector(".form-ok"); if (out) { out.hidden = false; out.focus?.(); }
  f.reset();
}));

/* ---------- till toppen ---------- */
document.querySelectorAll("[data-top]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }));
