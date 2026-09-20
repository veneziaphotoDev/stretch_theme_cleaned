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

// Split showcase: the panel background/image is the product link (there's no plain <a> wrapping
// it any more -- the actions row holds an app block, which can't be nested inside an anchor).
// Behavior differs by input:
//   - mouse: :hover already previews/brightens the panel before any click happens, so a click
//     always navigates straight away.
//   - touch/pen: there's no hover preview, so the first tap on a panel only focuses it
//     (mirrors what hover does -- brightens it, narrows the other), same as tapping it always
//     did. Only a second tap, on the panel that's now already focused, navigates -- otherwise
//     tapping the non-focused panel to bring it into view would immediately and unintentionally
//     send you to its product page.
//
// Activation is driven by `click`, not `pointerup`/`pointerdown`: those are raw, lower-level
// signals that don't have `click`'s built-in tap-vs-scroll disambiguation -- on touch, a
// `pointerup` can simply not fire at all if the browser decides the gesture was a scroll
// instead (fires `pointercancel` then), so relying on it directly can make tapping silently
// stop working. `click` is what's reliable across mouse and touch. A separate `pointerdown`
// listener just records which input type was actually used (real event.pointerType, not a
// matchMedia guess) for the click handler to branch on -- it doesn't act on anything itself.
(function() {
  const containers = document.querySelectorAll('.split-showcase--duo');
  if (!containers.length) return;

  containers.forEach(function(container) {
    const panels = container.querySelectorAll('.split-showcase__panel');
    if (panels.length !== 2) return;

    panels.forEach(function(panel, index) {
      let lastPointerType = 'mouse';

      panel.addEventListener('pointerdown', function(event) {
        lastPointerType = event.pointerType || 'mouse';
      });

      panel.addEventListener('click', function(event) {
        // Let taps on the actual app block (Meety) act normally -- only the image/background
        // itself drives focus/navigation.
        if (event.target.closest('.split-showcase__actions')) return;

        const url = panel.dataset.productUrl;
        const isTouch = lastPointerType === 'touch' || lastPointerType === 'pen';

        if (isTouch) {
          const isActive = index === 1
            ? container.classList.contains('is-panel-2-active')
            : !container.classList.contains('is-panel-2-active');

          if (!isActive) {
            container.classList.toggle('is-panel-2-active', index === 1);
            return;
          }
        }

        if (url) window.location.href = url;
      });
    });
  });
})();

// Split showcase: draggable handle between the two panels, before/after-slider style. Works
// with mouse, touch or pen alike via Pointer Events. While dragging, the ratio tracks the
// pointer live (rAF-throttled) via the --split-showcase-live-ratio/-columns custom properties,
// which custom.css consumes with transitions disabled (.is-dragging) so there's no lag behind
// the pointer. On release those inline properties are cleared and .is-panel-2-active is left
// set to whichever side the drag ended past the midpoint on -- the same class the hover/tap
// swap use, so CSS takes over and animates the rest of the way to a clean 70/30 (or 30/70) with
// its normal transition, instead of resting wherever the pointer happened to let go.
(function() {
  const MIN_RATIO = 0.3;
  const MAX_RATIO = 0.7;

  document.querySelectorAll('.split-showcase--duo').forEach(function(container) {
    const handle = container.querySelector('.split-showcase__handle');
    if (!handle) return;

    let dragging = false;
    let ticking = false;
    let pendingRatio = 0.7;

    function apply(ratio) {
      const firstPct = ratio * 100;
      const secondPct = 100 - firstPct;
      container.style.setProperty('--split-showcase-live-ratio', firstPct.toFixed(2) + '%');
      container.style.setProperty('--split-showcase-live-columns', firstPct.toFixed(2) + 'fr ' + secondPct.toFixed(2) + 'fr');
      container.classList.toggle('is-panel-2-active', ratio < 0.5);
      ticking = false;
    }

    function queueRatio(ratio) {
      pendingRatio = ratio;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(function() {
          apply(pendingRatio);
        });
      }
    }

    function ratioFromEvent(event) {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      return Math.min(MAX_RATIO, Math.max(MIN_RATIO, x));
    }

    handle.addEventListener('pointerdown', function(event) {
      dragging = true;
      handle.setPointerCapture(event.pointerId);
      container.classList.add('is-dragging');
      queueRatio(ratioFromEvent(event));
      event.preventDefault();
    });

    handle.addEventListener('pointermove', function(event) {
      if (!dragging) return;
      queueRatio(ratioFromEvent(event));
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      container.classList.remove('is-dragging');
      container.style.removeProperty('--split-showcase-live-ratio');
      container.style.removeProperty('--split-showcase-live-columns');
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  });
})();
