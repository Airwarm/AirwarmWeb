(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.aw-header');

  const updateHeader = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 18);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  if (reduce) {
    document.querySelectorAll('.aw-reveal').forEach(el => el.classList.add('is-visible'));
    return;
  }

  const reveals = document.querySelectorAll('.aw-reveal');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  reveals.forEach(el => observer.observe(el));

  const journey = document.querySelector('.aw-journey');
  if (journey) {
    const updateJourney = () => {
      const rect = journey.getBoundingClientRect();
      const viewport = window.innerHeight;
      const start = viewport * 0.78;
      const distance = Math.max(rect.height + viewport * 0.35, 1);
      const progress = Math.max(0, Math.min(1, (start - rect.top) / distance));
      journey.style.setProperty('--aw-journey-progress', progress.toFixed(3));
    };
    updateJourney();
    window.addEventListener('scroll', updateJourney, { passive: true });
    window.addEventListener('resize', updateJourney);
  }
})();