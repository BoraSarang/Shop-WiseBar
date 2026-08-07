// 똑바 · Shop WiseBar 랜딩 페이지 — 스크롤/인터랙션 (바닐라 JS, 무효존)
(() => {
  "use strict";

  // ── 1. 네비 스크롤 상태 ──
  const nav = document.getElementById("topnav");
  const onScrollNav = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 12);
  };
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  // ── 2. 섹션 등장(페이드 업) — IntersectionObserver ──
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    // 구형 브라우저 폴백 — 즉시 모두 표시
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  // ── 3. 배경 오브(orb) 마우스 패럴택스 (데스크톱에서만 감성) ──
  const orbs = document.querySelectorAll(".orb");
  if (orbs.length && window.matchMedia("(pointer: fine)").matches) {
    const pad = 40; // 반응 손실 방지 (이동 반경)
    let raf = null;
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5);
      const y = (e.clientY / window.innerHeight - 0.5);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        orbs.forEach((orb, i) => {
          const factor = (i + 1) * pad;
          orb.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
        });
        raf = null;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
  }

  // ── 4. prefers-reduced-motion 존중 — 애니메이션 완화 ──
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealEls.forEach((el) => el.classList.add("visible"));
  }
})();