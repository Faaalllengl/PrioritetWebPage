document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('js');

  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navLinks.getAttribute('data-open') === 'true';
      navLinks.setAttribute('data-open', String(!isOpen));
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.setAttribute('data-open', 'false');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const projectScroller = document.querySelector('#project-scroller');
  const projectList = projectScroller?.querySelector('[data-project-list]');
  const projectControls = document.querySelectorAll('[data-scroll-target="#project-scroller"]');
  const projectScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  let projectCards = [];
  let activeProjectIndex = 0;

  const escapeProjectHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const renderProjectParagraphs = (value) => String(value ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeProjectHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const renderSoundControl = () => `<button class="project-card__sound" type="button" data-sound-toggle aria-pressed="false" aria-label="Включить звук" title="Включить звук">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path class="project-card__sound-slash" d="m4 4 16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <path class="project-card__sound-wave" d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    <span>Включить звук</span>
  </button>`;

  const renderProjectCard = (project, index) => {
    const media = project.mediaType === 'image'
      ? `<img class="project-card__art" src="${escapeProjectHtml(project.media)}" alt="${escapeProjectHtml(project.alt || project.title)}" loading="lazy">`
      : `<video class="project-card__art" muted loop playsinline preload="metadata" aria-label="${escapeProjectHtml(project.alt || project.title)}"><source src="${escapeProjectHtml(project.media)}" type="${project.media.toLowerCase().endsWith('.webm') ? 'video/webm' : project.media.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'}"></video>${renderSoundControl()}`;
    const typeClass = index % 2 === 1 ? 'project-card--plant' : 'project-card--road';
    return `<article class="project-card ${typeClass}" data-project-id="${escapeProjectHtml(project.id)}" aria-current="false">
      <div class="project-card__media">${media}</div>
      <div class="project-card__body"><h3>${escapeProjectHtml(project.title)}</h3><div class="project-card__copy">
        <div class="project-card__copy-block"><span class="project-card__lang">Қазақша</span>${renderProjectParagraphs(project.kzText)}</div>
        <div class="project-card__copy-block"><span class="project-card__lang">Русский</span>${renderProjectParagraphs(project.ruText)}</div>
      </div></div>
    </article>`;
  };

  const syncSoundControl = (button, video) => {
    const isMuted = video.muted;
    button.classList.toggle('is-on', !isMuted);
    button.setAttribute('aria-pressed', String(!isMuted));
    button.setAttribute('aria-label', isMuted ? 'Включить звук' : 'Выключить звук');
    button.title = isMuted ? 'Включить звук' : 'Выключить звук';
    const label = button.querySelector('span');
    if (label) label.textContent = isMuted ? 'Включить звук' : 'Выключить звук';
  };

  const renderProjectList = (projects) => {
    if (!projectList || !projectScroller) return [];
    projectScroller.querySelectorAll('.project-card').forEach((card) => card.remove());
    const visibleProjects = projects.filter((project) => project.published !== false);
    projectList.innerHTML = visibleProjects.map(renderProjectCard).join('');
    return [...projectScroller.querySelectorAll('.project-card')];
  };

  const activateProject = (card, shouldPlay = true) => {
    const nextIndex = projectCards.indexOf(card);
    if (nextIndex < 0) return;
    activeProjectIndex = nextIndex;

    projectCards.forEach((item, index) => {
      const video = item.querySelector('video');
      const soundButton = item.querySelector('[data-sound-toggle]');
      const isActive = index === activeProjectIndex;
      item.classList.toggle('is-active', isActive);
      item.classList.toggle('is-before', index === activeProjectIndex - 1);
      item.classList.toggle('is-after', index === activeProjectIndex + 1);
      item.setAttribute('aria-current', isActive ? 'true' : 'false');
      if (!video) return;
      if (soundButton) syncSoundControl(soundButton, video);
      if (isActive && shouldPlay) {
        video.play().catch(() => {});
      } else if (!isActive) {
        video.pause();
      }
    });

    projectControls.forEach((button) => {
      const isPrevious = button.dataset.direction === 'prev';
      const isDisabled = isPrevious ? activeProjectIndex === 0 : activeProjectIndex === projectCards.length - 1;
      button.disabled = isDisabled;
    });
  };

  const setupProjectCarousel = () => {
    if (!projectScroller || !projectCards.length) return;
    projectScroller.addEventListener('click', (event) => {
      const soundButton = event.target.closest('[data-sound-toggle]');
      if (!soundButton) return;
      const video = soundButton.closest('.project-card__media')?.querySelector('video');
      if (!video) return;
      event.stopPropagation();
      video.muted = !video.muted;
      syncSoundControl(soundButton, video);
      if (!video.paused) return;
      video.play().catch(() => {});
    });

    projectControls.forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.dataset.direction === 'next' ? 1 : -1;
        const nextIndex = Math.min(Math.max(activeProjectIndex + direction, 0), projectCards.length - 1);
        const nextCard = projectCards[nextIndex];
        activateProject(nextCard);
        if (window.matchMedia('(max-width: 860px)').matches) {
          nextCard.scrollIntoView({
            behavior: projectScrollBehavior,
            block: 'nearest',
            inline: nextIndex === 0 ? 'start' : 'center'
          });
        }
      });
    });

    projectScroller.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const control = event.key === 'ArrowRight' ? projectControls[1] : projectControls[0];
      control?.click();
    });

    activateProject(projectCards[0]);
  };

  if (projectScroller && projectList) {
    fetch('/api/projects', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить карточки.');
        return response.json();
      })
      .then((payload) => {
        projectCards = renderProjectList(Array.isArray(payload) ? payload : (payload.projects || []));
        if (projectCards.length) {
          setupProjectCarousel();
        } else {
          projectList.innerHTML = '<p class="project-list__empty">Пока нет опубликованных материалов.</p>';
        }
      })
      .catch((error) => {
        projectList.innerHTML = `<p class="project-list__empty">${escapeProjectHtml(error.message)}</p>`;
      });
  }

  const labTable = document.querySelector('[data-price-table]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const searchInput = document.querySelector('[data-price-search]');
  const resultCount = document.querySelector('[data-result-count]');
  let activeFilter = 'all';

  function filterPrices() {
    if (!labTable) return;
    const query = (searchInput?.value || '').trim().toLowerCase();
    const rows = [...labTable.querySelectorAll('tbody tr[data-category]')];
    let visibleCount = 0;

    rows.forEach((row) => {
      const matchesFilter = activeFilter === 'all' || row.dataset.category === activeFilter;
      const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
      const isVisible = matchesFilter && matchesQuery;
      row.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    labTable.querySelectorAll('tbody tr[data-category-heading]').forEach((heading) => {
      const category = heading.dataset.categoryHeading;
      const hasVisibleRows = rows.some((row) => row.dataset.category === category && !row.hidden);
      heading.hidden = !hasVisibleRows;
    });

    if (resultCount) {
      resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'услуга' : 'услуг'} в демонстрационной выборке`;
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      filterPrices();
    });
  });
  searchInput?.addEventListener('input', filterPrices);
  filterPrices();

  const demoForm = document.querySelector('[data-demo-form]');
  const formStatus = document.querySelector('[data-form-status]');
  demoForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!formStatus) return;
    formStatus.textContent = 'Спасибо. В прототипе заявка не отправляется — здесь появится интеграция с почтой или WhatsApp.';
    formStatus.setAttribute('role', 'status');
  });

  const siteHeader = document.querySelector('.site-header');
  let lastScrollY = window.scrollY;
  let scrollFrame = 0;
  const closeMenu = () => {
    navLinks?.setAttribute('data-open', 'false');
    menuToggle?.setAttribute('aria-expanded', 'false');
  };

  const updateHeader = () => {
    scrollFrame = 0;
    const currentScrollY = Math.max(window.scrollY, 0);
    if (!siteHeader) return;
    if (currentScrollY <= 20 || currentScrollY < lastScrollY - 4) {
      siteHeader.classList.remove('is-hidden');
    } else if (currentScrollY > lastScrollY + 5) {
      siteHeader.classList.add('is-hidden');
      closeMenu();
    }
    lastScrollY = currentScrollY;
  };

  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateHeader);
  }, { passive: true });

  const revealSelector = [
    '.section-head', '.trust-item', '.capability-card', '.project-card',
    '.story > *', '.award', '.final-cta .container > *'
  ].join(',');
  const heroSelector = '.hero__inner > *, .hero__visual > *, .hero__bottom > *';

  document.querySelectorAll(heroSelector).forEach((element, index) => {
    element.classList.add('hero-enter');
    element.style.setProperty('--hero-delay', `${Math.min(index, 7) * 75}ms`);
  });

  const candidates = [...document.querySelectorAll(revealSelector)];
  if (!('IntersectionObserver' in window)) {
    candidates.forEach((element) => element.classList.add('reveal', 'reveal-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('reveal-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

  candidates.forEach((element) => {
    const siblings = [...element.parentElement.children].filter((sibling) => sibling.matches(revealSelector));
    const siblingIndex = Math.max(siblings.indexOf(element), 0);
    element.classList.add('reveal');
    element.style.setProperty('--reveal-delay', `${Math.min(siblingIndex, 4) * 70}ms`);
    observer.observe(element);
  });
});
