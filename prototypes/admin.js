document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#project-form');
  const projectList = document.querySelector('#project-list-admin');
  const itemCount = document.querySelector('#item-count');
  const status = document.querySelector('#form-status');
  const projectId = document.querySelector('#project-id');
  const mediaType = document.querySelector('#media-type');
  const mediaFile = document.querySelector('#media-file');
  const mediaHint = document.querySelector('#media-hint');
  const currentMedia = document.querySelector('#current-media');
  const title = document.querySelector('#project-title');
  const alt = document.querySelector('#project-alt');
  const kzText = document.querySelector('#project-kz');
  const ruText = document.querySelector('#project-ru');
  const published = document.querySelector('#project-published');
  const resetButton = document.querySelector('#reset-form');
  const cancelButton = document.querySelector('#cancel-edit');
  const submitButton = form?.querySelector('button[type="submit"]');

  let projects = [];
  let editingId = '';
  let currentMediaPath = '';
  let previewUrl = '';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const pluralize = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} карточка`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} карточки`;
    return `${count} карточек`;
  };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };

  const api = async (url, options = {}) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Сервер не смог выполнить запрос.');
    return payload;
  };

  const updateMediaHints = () => {
    const isImage = mediaType.value === 'image';
    mediaFile.accept = isImage
      ? 'image/jpeg,image/png,image/webp,image/avif'
      : 'video/mp4,video/webm,video/quicktime';
    mediaHint.textContent = isImage
      ? 'Фотографии: JPG, PNG, WebP или AVIF. Выбор нового файла заменит текущий.'
      : 'Видео: MP4, WebM или MOV. Максимальный размер — 512 МБ.';
  };

  const showMediaPreview = (src, type, label = '') => {
    currentMedia.hidden = !src;
    if (!src) {
      currentMedia.innerHTML = '';
      return;
    }
    const safeSrc = escapeHtml(src);
    const safeLabel = escapeHtml(label);
    currentMedia.innerHTML = type === 'image'
      ? `<img src="${safeSrc}" alt="${safeLabel}">`
      : `<video src="${safeSrc}" controls muted></video>`;
  };

  const renderLibrary = () => {
    itemCount.textContent = pluralize(projects.length);
    if (!projects.length) {
      projectList.innerHTML = '<p class="library-empty">Карточек пока нет. Создайте первую через форму.</p>';
      return;
    }

    projectList.innerHTML = projects.map((project, index) => {
      const media = project.mediaType === 'image'
        ? `<img src="${escapeHtml(project.media)}" alt="">`
        : `<video src="${escapeHtml(project.media)}" muted preload="metadata"></video>`;
      const state = project.published === false ? 'Скрыта на сайте' : 'Опубликована';
      return `<article class="admin-card" data-project-id="${escapeHtml(project.id)}">
        <div class="admin-card__media">${media}</div>
        <div class="admin-card__body">
          <div class="admin-card__meta"><span>${index + 1}</span><span>${project.mediaType === 'image' ? 'Фото' : 'Видео'}</span></div>
          <h3 class="admin-card__title">${escapeHtml(project.title)}</h3>
          <div class="admin-card__state ${project.published === false ? 'is-hidden' : ''}">${state}</div>
          <div class="admin-card__actions">
            <button class="button button--quiet" type="button" data-action="edit">Изменить</button>
            <button class="button button--quiet" type="button" data-action="up" ${index === 0 ? 'disabled' : ''}>Выше</button>
            <button class="button button--quiet" type="button" data-action="down" ${index === projects.length - 1 ? 'disabled' : ''}>Ниже</button>
            <button class="button button--quiet" type="button" data-action="toggle">${project.published === false ? 'Показать' : 'Скрыть'}</button>
            <button class="button button--quiet" type="button" data-action="delete">Удалить</button>
          </div>
        </div>
      </article>`;
    }).join('');
  };

  const saveProjects = async () => {
    const result = await api('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects })
    });
    projects = result.projects;
    renderLibrary();
  };

  const resetForm = () => {
    editingId = '';
    projectId.value = '';
    form.reset();
    currentMediaPath = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    showMediaPreview('', 'video');
    cancelButton.hidden = true;
    submitButton.textContent = 'Сохранить карточку';
    updateMediaHints();
    setStatus('');
  };

  const editProject = (project) => {
    editingId = project.id;
    projectId.value = project.id;
    mediaType.value = project.mediaType || 'video';
    currentMediaPath = project.media || '';
    title.value = project.title || '';
    alt.value = project.alt || '';
    kzText.value = project.kzText || '';
    ruText.value = project.ruText || '';
    published.checked = project.published !== false;
    mediaFile.value = '';
    cancelButton.hidden = false;
    submitButton.textContent = 'Сохранить изменения';
    updateMediaHints();
    showMediaPreview(currentMediaPath, mediaType.value, project.title);
    title.focus();
    setStatus(`Редактируется: ${project.title}`);
  };

  const makeId = (value) => {
    const slug = value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48);
    return `${slug || 'project'}-${Date.now().toString(36)}`;
  };

  mediaType.addEventListener('change', () => {
    updateMediaHints();
    if (mediaFile.files[0]) showMediaPreview(URL.createObjectURL(mediaFile.files[0]), mediaType.value, title.value);
  });

  mediaFile.addEventListener('change', () => {
    const file = mediaFile.files[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    showMediaPreview(previewUrl, mediaType.value, file.name);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = mediaFile.files[0];
    const titleValue = title.value.trim();
    if (!titleValue) {
      setStatus('Укажите заголовок карточки.', true);
      title.focus();
      return;
    }
    if (!editingId && !file) {
      setStatus('Для новой карточки выберите видео или фотографию.', true);
      mediaFile.focus();
      return;
    }

    submitButton.disabled = true;
    setStatus(file ? 'Загружаю медиафайл и сохраняю карточку…' : 'Сохраняю карточку…');
    try {
      let mediaPath = currentMediaPath;
      let selectedType = mediaType.value;
      if (file) {
        const formData = new FormData();
        formData.append('mediaType', selectedType);
        formData.append('file', file);
        const upload = await api('/api/media', { method: 'POST', body: formData });
        mediaPath = upload.media;
        selectedType = upload.mediaType;
      }

      const project = {
        id: editingId || makeId(titleValue),
        title: titleValue,
        mediaType: selectedType,
        media: mediaPath,
        alt: alt.value.trim() || titleValue,
        kzText: kzText.value.trim(),
        ruText: ruText.value.trim(),
        published: published.checked
      };
      const existingIndex = projects.findIndex((item) => item.id === editingId);
      if (existingIndex === -1) projects.push(project);
      else projects[existingIndex] = project;
      await saveProjects();
      resetForm();
      setStatus('Карточка сохранена. Обновите главную страницу, чтобы увидеть изменения.');
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });

  projectList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('[data-project-id]');
    const index = projects.findIndex((project) => project.id === card?.dataset.projectId);
    if (index < 0) return;
    const action = button.dataset.action;

    if (action === 'edit') {
      editProject(projects[index]);
      return;
    }
    if (action === 'delete') {
      if (!window.confirm(`Удалить карточку «${projects[index].title}»? Сам медиафайл останется в папке assets для восстановления.`)) return;
      projects.splice(index, 1);
    } else if (action === 'toggle') {
      projects[index].published = projects[index].published === false;
    } else if (action === 'up' && index > 0) {
      [projects[index - 1], projects[index]] = [projects[index], projects[index - 1]];
    } else if (action === 'down' && index < projects.length - 1) {
      [projects[index + 1], projects[index]] = [projects[index], projects[index + 1]];
    } else {
      return;
    }

    try {
      await saveProjects();
      setStatus('Изменения сохранены.');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  resetButton.addEventListener('click', resetForm);
  cancelButton.addEventListener('click', resetForm);

  updateMediaHints();
  api('/api/projects', { cache: 'no-store' })
    .then((payload) => {
      projects = Array.isArray(payload) ? payload : (payload.projects || []);
      renderLibrary();
    })
    .catch((error) => setStatus(`Не удалось загрузить библиотеку: ${error.message}`, true));
});
