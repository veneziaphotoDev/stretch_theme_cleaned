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
// No hover handling on desktop any more, so mouse and touch/pen behave identically here: the
// first click/tap on a panel only brings it into focus (mirrors what tapping already did) --
// only a second click/tap, on the panel that's now already focused, navigates. Otherwise
// clicking the non-focused panel to bring it into view would immediately and unintentionally
// send you to its product page.
//
// Activation is driven by `click`, not `pointerup`/`pointerdown`: those are raw, lower-level
// signals that don't have `click`'s built-in tap-vs-scroll disambiguation -- on touch, a
// `pointerup` can simply not fire at all if the browser decides the gesture was a scroll
// instead (fires `pointercancel` then), so relying on it directly can make tapping silently
// stop working. `click` is what's reliable across mouse and touch.
(function() {
  const containers = document.querySelectorAll('.split-showcase--duo');
  if (!containers.length) return;

  containers.forEach(function(container) {
    const panels = container.querySelectorAll('.split-showcase__panel');
    if (panels.length !== 2) return;

    panels.forEach(function(panel, index) {
      panel.addEventListener('click', function(event) {
        // Suppresses exactly one stray click right after a handle drag ends -- see the comment
        // on endDrag() in the drag-handling script below for why that's needed.
        if (container.dataset.splitShowcaseSuppressClick) {
          delete container.dataset.splitShowcaseSuppressClick;
          return;
        }

        // Let clicks on the actual app block (Meety) act normally -- only the image/background
        // itself drives focus/navigation.
        if (event.target.closest('.split-showcase__actions')) return;

        const isActive = index === 1
          ? container.classList.contains('is-panel-2-active')
          : !container.classList.contains('is-panel-2-active');

        if (!isActive) {
          container.classList.toggle('is-panel-2-active', index === 1);
          return;
        }

        const url = panel.dataset.productUrl;
        if (url) window.location.href = url;
      });
    });
  });
})();

// Split showcase: draggable handle between the two panels, before/after-slider style. Works
// with mouse, touch or pen alike via Pointer Events. While dragging, the ratio tracks the
// pointer live (rAF-throttled) via the --split-showcase-live-ratio custom property, which
// custom.css consumes with transitions disabled (.is-dragging) so there's no lag behind the
// pointer -- both the grid columns and the handle position derive from that single value (see
// custom.css), so there's nothing here to keep in sync between two separate properties any
// more. On release the inline property is cleared and .is-panel-2-active is left set to
// whichever side the drag ended past the midpoint on -- the same class the hover/tap swap use,
// so CSS takes over and animates the rest of the way to a clean resting ratio (70/30 on
// desktop, 90/10 on mobile -- see getBounds() below) with its normal transition, instead of
// resting wherever the pointer happened to let go.
(function() {
  const isMobileQuery = window.matchMedia('(max-width: 999px)');

  // Mobile uses a much more dramatic 90/10 split (matches the --split-showcase-ratio override
  // in custom.css for the same breakpoint) instead of desktop's 70/30 -- checked fresh each
  // time rather than cached once, so it still tracks correctly across an orientation change.
  function getBounds() {
    return isMobileQuery.matches ? { min: 0.1, max: 0.9 } : { min: 0.3, max: 0.7 };
  }

  document.querySelectorAll('.split-showcase--duo').forEach(function(container) {
    const handle = container.querySelector('.split-showcase__handle');
    if (!handle) return;

    let dragging = false;
    let ticking = false;
    let pendingRatio = 0.7;

    function apply(ratio) {
      container.style.setProperty('--split-showcase-live-ratio', (ratio * 100).toFixed(2) + '%');
      container.classList.toggle('is-panel-2-active', ratio < 0.5);

      // Sun/moon icon opacity+scale, continuous with drag progress rather than snapping at the
      // midpoint: 0 = that panel is fully focused (icon hidden/small), 1 = fully non-focused
      // (icon full size). Each panel's own inactiveness is how close its ratio is to its own
      // min extreme.
      const bounds = getBounds();
      const firstInactiveness = (bounds.max - ratio) / (bounds.max - bounds.min);
      const lastInactiveness = (ratio - bounds.min) / (bounds.max - bounds.min);
      container.style.setProperty('--split-showcase-icon-first', firstInactiveness.toFixed(3));
      container.style.setProperty('--split-showcase-icon-last', lastInactiveness.toFixed(3));
    }

    function queueRatio(ratio) {
      pendingRatio = ratio;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(function() {
          ticking = false;
          // A pointermove right before release can queue this for the next frame, which then
          // fires AFTER pointerup already ran endDrag() and started the resting transition.
          // Applying it anyway would re-set the live properties (and can re-toggle
          // is-panel-2-active) mid-transition -- a stray, delayed update fighting the animation
          // that already started, which is what read as a lag/desync right as it released.
          if (!dragging) return;
          apply(pendingRatio);
        });
      }
    }

    function ratioFromEvent(event) {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const bounds = getBounds();
      return Math.min(bounds.max, Math.max(bounds.min, x));
    }

    function onMove(event) {
      if (!dragging) return;
      queueRatio(ratioFromEvent(event));
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      container.classList.remove('is-dragging');
      container.style.removeProperty('--split-showcase-live-ratio');
      container.style.removeProperty('--split-showcase-icon-first');
      container.style.removeProperty('--split-showcase-icon-last');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);

      // Some browsers still synthesize a `click` on whatever panel the finger happens to end up
      // over when the drag releases, even though this was clearly a drag and not a tap. That
      // panel has its own click handler (separate IIFE below, for navigation/focus) which would
      // then re-toggle is-panel-2-active -- silently undoing the exact state the drag just set,
      // which is what read as the drag getting "cancelled" right past the midpoint. Flagged here
      // so that handler can ignore exactly one stray click; self-clears on the next real click
      // too, via a short timeout as a safety net in case no stray click actually follows.
      container.dataset.splitShowcaseSuppressClick = '1';
      window.setTimeout(function() {
        delete container.dataset.splitShowcaseSuppressClick;
      }, 400);
    }

    handle.addEventListener('pointerdown', function(event) {
      dragging = true;
      // Belt and suspenders: capture still helps on browsers where it's solid (keeps the
      // cursor/touch feedback associated with the handle). But move/up/cancel are tracked on
      // window, not the handle -- during a real drag the finger spends almost the whole gesture
      // physically over the (much larger) panels, not the 40px handle strip, and relying only on
      // the handle to keep receiving events via capture was cutting drags short partway through
      // on mobile: the moment capture didn't hold (or the browser's gesture recognizer decided
      // the touch belonged to whatever was underneath), the drag just stopped dead instead of
      // tracking to where the finger actually let go, which read as an abrupt, premature snap.
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (error) {
        // Capture can throw in some browsers for a pointerId that's already gone (e.g. a very
        // fast tap-and-release) -- window-level tracking below doesn't depend on it anyway.
      }
      container.classList.add('is-dragging');
      queueRatio(ratioFromEvent(event));
      event.preventDefault();

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    });
  });
})();
