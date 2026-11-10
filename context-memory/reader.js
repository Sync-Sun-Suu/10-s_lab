document.documentElement.classList.add('js');
document.querySelector('#print').addEventListener('click', () => window.print());
const contents = document.querySelector('#contents');
const mobile = window.matchMedia('(max-width: 900px)');
function updateContents() { contents.open = !mobile.matches; }
updateContents();
mobile.addEventListener('change', updateContents);
contents.addEventListener('click', event => {
  if (event.target.closest('a') && mobile.matches) contents.open = false;
});
const progress = document.querySelector('#progress');
let scheduled = false;
function updateProgress() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${total > 0 ? Math.min(100, window.scrollY / total * 100) : 0}%`;
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
const links = [...document.querySelectorAll('.toc-group a')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-90px 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('article[id], .prose h2[id]').forEach(el => observer.observe(el));
}
