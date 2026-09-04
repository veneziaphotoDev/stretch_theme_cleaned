/**
 * Custom JavaScript for the Laguna theme
 */

// Scroll reveal: fade in any [data-animate] element once it enters the viewport.
// Pairs with the CSS in custom.css - no per-component logic needed.
(function() {
  const elements = document.querySelectorAll('[data-animate]');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(function(el) { el.classList.add('is-visible'); });
    return;
  }

  const observer = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  elements.forEach(function(el) { observer.observe(el); });
})();

document.addEventListener('DOMContentLoaded', function() {
  const header = document.querySelector('.header');
  const dropdowns = document.querySelectorAll('header-dropdown-menu');
  let addedSolidClass = false;

  // Get base transition duration from CSS variable (in ms)
  const getTransitionMs = () => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--dropdown-transition').trim();
    return parseFloat(value) * 1000; // Convert seconds to ms
  };

  // Override stagger animation to add delay on open
  customElements.whenDefined('header-dropdown-menu').then(() => {
    const DropdownClass = customElements.get('header-dropdown-menu');
    const originalCreateEnter = DropdownClass.prototype.createEnterAnimationControls;

    DropdownClass.prototype.createEnterAnimationControls = function() {
      const self = this;
      const items = this.querySelectorAll(':scope > ul > li');
      const baseMs = getTransitionMs();

      // Hide items initially
      items.forEach(li => {
        li.style.opacity = '0';
        li.style.transform = 'translateY(0.8em)';
      });

      // Run original animation after delay (2× base: solid + stripe)
      return new Promise(resolve => {
        setTimeout(() => {
          // Bail out if dropdown was closed before delay finished
          if (!self.hasAttribute('open')) {
            resolve();
            return;
          }
          const controls = originalCreateEnter.call(self);
          if (controls && controls.then) {
            controls.then(resolve);
          } else {
            resolve(controls);
          }
        }, baseMs * 2);
      });
    };
  });

  dropdowns.forEach(function(menu) {
    menu.addEventListener('dialog:before-show', function() {
      // Add is-solid if header is transparent
      if (header && !header.classList.contains('is-solid')) {
        header.classList.add('is-solid');
        addedSolidClass = true;
      }
      header.style.setProperty('--dropdown-height', menu.offsetHeight + 'px');
    });

    menu.addEventListener('dialog:after-hide', function() {
      // Only reset height if no other dropdown is open
      const anyOpen = header.querySelector('header-dropdown-menu[open]');
      if (!anyOpen) {
        header.style.setProperty('--dropdown-height', '0px');
      }

      // Remove is-solid after delay (2× base: wait for animations)
      if (addedSolidClass) {
        const baseMs = getTransitionMs();
        setTimeout(function() {
          // Only remove if no other dropdown is open
          const anyOpen = header.querySelector('[open]');
          if (!anyOpen) {
            // Check scroll position - only remove if at top
            const scrollTracker = document.getElementById('header-scroll-tracker');
            if (scrollTracker) {
              const rect = scrollTracker.getBoundingClientRect();
              if (rect.top >= 0) {
                header.classList.remove('is-solid');
                addedSolidClass = false;
              }
            } else {
              header.classList.remove('is-solid');
              addedSolidClass = false;
            }
          }
        }, baseMs * 2);
      }
    });
  });
});

// Video carousel: play muted on hover (desktop), tap-to-play on touch (native video-media behavior),
// and let visitors toggle sound per video.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.video-carousel__item').forEach(function(item) {
    const media = item.querySelector('video-media');
    const video = item.querySelector('video');
    const muteButton = item.querySelector('.video-carousel__mute-toggle');

    if (media) {
      item.addEventListener('mouseenter', function() {
        media.play();
      });

      item.addEventListener('mouseleave', function() {
        media.pause();
      });
    }

    if (muteButton && video) {
      muteButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        video.muted = !video.muted;
        muteButton.classList.toggle('is-unmuted', !video.muted);
        muteButton.setAttribute(
          'aria-label',
          video.muted ? muteButton.dataset.unmuteLabel : muteButton.dataset.muteLabel
        );
      });
    }
  });
});

// Subtle mouse parallax on [data-parallax] elements (experience product gallery, desktop only).
// Sets --parallax-x/--parallax-y custom properties consumed by the element's own CSS transform,
// so it composes independently from the [data-animate] reveal transform on the same element's parent.
(function() {
  const items = document.querySelectorAll('[data-parallax]');
  if (!items.length) return;
  if (window.matchMedia('(max-width: 999px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Each item gets its own fixed "personality" (picked once, not re-randomized per frame, so the
  // effect stays predictable/stable rather than jittery): different travel distance per axis, and
  // roughly a third of items move opposite to the mouse instead of following it.
  const factors = Array.prototype.map.call(items, function() {
    const invertX = Math.random() < 0.35 ? -1 : 1;
    const invertY = Math.random() < 0.35 ? -1 : 1;
    return {
      x: invertX * (6 + Math.random() * 12), // 6-18px
      y: invertY * (6 + Math.random() * 12)
    };
  });

  let mouseX = 0;
  let mouseY = 0;
  let ticking = false;

  function update() {
    items.forEach(function(el, index) {
      const factor = factors[index];
      el.style.setProperty('--parallax-x', (mouseX * factor.x).toFixed(2) + 'px');
      el.style.setProperty('--parallax-y', (mouseY * factor.y).toFixed(2) + 'px');
    });
    ticking = false;
  }

  window.addEventListener('mousemove', function(event) {
    mouseX = (event.clientX / window.innerWidth) - 0.5;
    mouseY = (event.clientY / window.innerHeight) - 0.5;

    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  });
})();
