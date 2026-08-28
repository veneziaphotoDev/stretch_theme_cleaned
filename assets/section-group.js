/**
 * Section grouping
 *
 * Sections are independent boxes, so a gradient color scheme repeats once per section instead of
 * spanning them. This wraps a run of sections into a single <section-group> that carries the color
 * scheme, so the gradient paints once across the whole run.
 *
 * A run starts at any section whose wrapper carries data-group-with-next and extends to the first
 * member that does not, so consecutive flagged sections chain into one group.
 *
 * Runs synchronously at the end of <body> rather than on DOMContentLoaded, so the grouped background
 * is in place before the first paint, and re-runs on the theme editor's section events.
 */
(() => {
  const GROUP_TAG = 'section-group';
  const FIT_CLASS = 'section-group--fit';

  // A section does not always open with its color-scheme element: featured-collections emits a <style>
  // block first, so firstElementChild would miss it. Select the direct children explicitly instead.
  const schemeOf = (section) => section.querySelector(':scope > .color-scheme');
  const flagOf = (section) => section.querySelector(':scope > [data-group-with-next]');

  const startsGroup = (section) => !!flagOf(section);

  const SCHEME_CLASS = /^color-scheme(--.+)?$/;
  const COLLAPSE_VAR = '--section-has-same-background-as-previous-section';

  /** Undo a previous pass so the editor can regroup from a clean DOM after an edit or reorder. */
  const unwrap = (main) => {
    main.querySelectorAll(GROUP_TAG).forEach((group) => {
      while (group.firstChild) {
        const child = group.firstChild;

        if (child.nodeType === Node.ELEMENT_NODE) {
          child.style.removeProperty(COLLAPSE_VAR);

          const wrapper = child.querySelector(':scope > [data-group-restore-scheme]');
          const restore = wrapper && wrapper.dataset.groupRestoreScheme;

          if (restore) {
            wrapper.classList.add(...restore.split(' '));
            delete wrapper.dataset.groupRestoreScheme;
          }
        }

        main.insertBefore(child, group);
      }

      group.remove();
    });
  };

  const group = () => {
    const main = document.querySelector('main#main');
    if (!main) return;

    unwrap(main);

    const sections = Array.from(main.children).filter((el) => el.classList.contains('shopify-section'));
    let index = 0;

    while (index < sections.length) {
      if (!startsGroup(sections[index]) || index === sections.length - 1) {
        index++;
        continue;
      }

      // Extend the run while its tail still asks to group with the section after it.
      const members = [sections[index]];
      let tail = index;

      while (startsGroup(sections[tail]) && tail + 1 < sections.length) {
        members.push(sections[tail + 1]);
        tail++;
      }

      const flag = flagOf(sections[index]);
      const scheme = flag.dataset.groupColorScheme;
      const container = document.createElement(GROUP_TAG);

      // A starter asking to fit the screen hands its height to the group, so the run fills one viewport
      // between all of its members instead of each claiming one. The class carries it, since the layout
      // that shares the height out only applies at the width where the split sections lay out in columns.
      if (flag.hasAttribute('data-group-fit-screen')) {
        container.classList.add(FIT_CLASS);
      } else {
        container.style.display = 'block';
      }

      if (scheme) {
        container.classList.add('color-scheme', `color-scheme--${scheme}`);
      }

      sections[index].parentNode.insertBefore(container, sections[index]);

      members.forEach((section, position) => {
        container.appendChild(section);

        // Drop each member's own color scheme so the group's scheme governs the whole run. Without a
        // scheme class of their own they inherit the container's background and text colors, which
        // also stops them painting over the group's gradient.
        const wrapper = schemeOf(section);
        const own = wrapper ? Array.from(wrapper.classList).filter((name) => SCHEME_CLASS.test(name)) : [];

        if (own.length) {
          wrapper.dataset.groupRestoreScheme = own.join(' ');
          wrapper.classList.remove(...own);
        }

        // Collapse the seam between members. The theme already zeroes the top padding of a section
        // whose background matches the one before it (theme.css:2224); inside a group that is always
        // true, so set the flag it reads rather than adding padding rules of our own.
        if (position > 0) {
          section.style.setProperty(COLLAPSE_VAR, '1');
        }
      });

      index = tail + 1;
    }
  };

  group();

  // Shopify replaces section markup in place when settings change, and moves sections on reorder.
  // Both land members outside the group, so rebuild on each.
  if (typeof Shopify !== 'undefined' && Shopify.designMode) {
    ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder'].forEach((event) => {
      document.addEventListener(event, group);
    });
  }
})();
