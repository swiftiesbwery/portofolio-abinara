(() => {
  document.documentElement.classList.add("js");

  const LETTER_RADIUS = () => window.innerWidth * 0.09;
  const REACH = 18;

  const letters = [];

  document.querySelectorAll("[data-split]").forEach((line) => {
    const plain = line.dataset.split === "plain";
    const text = line.textContent.trim();
    line.textContent = "";

    [...text].forEach((char, i) => {
      if (char === " ") {
        line.appendChild(document.createTextNode(" "));
        return;
      }
      const span = document.createElement("span");
      span.className = "ch" + (i === 0 && !plain ? " ch--swash" : "");
      span.textContent = char;
      line.appendChild(span);
      letters.push({ el: span, cx: 0, cy: 0 });
    });
  });

  const targets = [...document.querySelectorAll(".photo, .about__photo, .org__card, .mt__card")].map((el) => ({
    el,
    group: el.dataset.group || null,
    rect: null,
  }));

  function measure() {
    const sx = window.scrollX, sy = window.scrollY;

    letters.forEach((l) => l.el.style.setProperty("--near", 0));
    letters.forEach((l) => {
      const r = l.el.getBoundingClientRect();
      l.cx = r.left + r.width / 2 + sx;
      l.cy = r.top + r.height / 2 + sy;
    });
    targets.forEach((t) => {
      const r = t.el.getBoundingClientRect();
      t.rect = {
        left: r.left + sx,
        right: r.right + sx,
        top: r.top + sy,
        bottom: r.bottom + sy,
        width: r.width,
        height: r.height,
      };
    });
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
  window.addEventListener("load", measure);
  window.addEventListener("resize", measure);

  const showreelZones = [...document.querySelectorAll(".showreel__zone")];

  function updateShowreelZones() {
    const vh = window.innerHeight;
    const start = vh * 0.92;
    const end = vh * 0.4;

    showreelZones.forEach((zone) => {
      const section = zone.closest("[data-reveal]");
      const top = (section || zone).getBoundingClientRect().top;
      let t = (start - top) / (start - end);
      t = Math.max(0, Math.min(1, t));
      if (zone.contains(document.activeElement) && document.activeElement !== document.body) t = 1;
      zone.style.setProperty("--reveal", t.toFixed(3));
    });
  }

  let mx = -9999, my = -9999, ticking = false;

  function update() {
    ticking = false;
    if (showreelZones.length) updateShowreelZones();
    const radius = LETTER_RADIUS();
    const px = mx + window.scrollX;
    const py = my + window.scrollY;

    letters.forEach((l) => {
      const d = Math.hypot(px - l.cx, py - l.cy);
      const near = Math.max(0, 1 - d / radius);
      l.el.style.setProperty("--near", (near * near).toFixed(3));
    });

    let best = null;
    let bestDist = Infinity;
    let bestCenter = Infinity;

    targets.forEach((t) => {
      const r = t.rect;
      if (!r) return;
      const dx = Math.max(r.left - px, 0, px - r.right);
      const dy = Math.max(r.top - py, 0, py - r.bottom);
      const dist = Math.hypot(dx, dy);
      const center = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));

      if (dist <= REACH && (dist < bestDist || (dist === bestDist && center < bestCenter))) {
        best = t;
        bestDist = dist;
        bestCenter = center;
      }
    });

    targets.forEach((t) => {
      const on = best && (t === best || (best.group && t.group === best.group));
      t.el.classList.toggle("is-near", !!on);
    });
  }

  function schedule() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function onMove(e) {
    mx = e.clientX;
    my = e.clientY;
    schedule();
  }

  function reset() {
    mx = my = -9999;
    update();
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", schedule, { passive: true });
  document.addEventListener("mouseleave", reset);
  window.addEventListener("blur", reset);

  if (showreelZones.length) updateShowreelZones();
  window.addEventListener("load", updateShowreelZones);
  document.addEventListener("focusin", updateShowreelZones);
  document.addEventListener("focusout", updateShowreelZones);

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse") return;
      onMove(e);
    },
    { passive: true }
  );

  document.querySelectorAll("[data-reveal]").forEach((section) => {
    if (!("IntersectionObserver" in window)) {
      section.classList.add("is-visible");
      return;
    }

    new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) section.classList.add("is-visible");
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0 }
    ).observe(section);

    new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => !e.isIntersecting)) section.classList.remove("is-visible");
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 }
    ).observe(section);
  });

  document.querySelectorAll(".org__track").forEach((track) => {
    const slider = track.closest(".org__slider");

    function updateEdges() {
      if (!slider) return;
      const max = track.scrollWidth - track.clientWidth;
      slider.classList.toggle("at-start", track.scrollLeft <= 1);
      slider.classList.toggle("at-end", track.scrollLeft >= max - 1);
    }
    updateEdges();
    track.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);

    let dragging = false, startX = 0, startLeft = 0, moved = false;

    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(e.pointerId);
    });

    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      track.scrollLeft = startLeft - dx;
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      if (e && e.pointerId !== undefined) {
        try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerleave", endDrag);

    track.addEventListener(
      "click",
      (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); }
      },
      true
    );
  });


  const nav = document.querySelector(".nav");
  const navLinks = [...document.querySelectorAll(".nav__links a")];
  const sections = [...document.querySelectorAll("main > section[id]")];

  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const id = e.target.dataset.nav || "#" + e.target.id;
          navLinks.forEach((a) => {
            if (a.getAttribute("href") === id) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
          if (nav) nav.classList.toggle("nav--clear", e.target.hasAttribute("data-nav-clear"));
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sections.forEach((sec) => spy.observe(sec));
  }

  const videos = [...document.querySelectorAll("video[data-autoplay]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (videos.length && "IntersectionObserver" in window) {
    const vio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting && !reduceMotion) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.25 }
    );
    videos.forEach((v) => vio.observe(v));
  }

  document.querySelectorAll("[data-gated]").forEach((a) => {
    const grant = () => { try { sessionStorage.setItem("access:" + a.dataset.gated, "1"); } catch (_) {} };
    a.addEventListener("click", grant);
    a.addEventListener("auxclick", grant);
  });
})();