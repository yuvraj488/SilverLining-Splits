const avatarColors = ['#5c7a6e', '#6a5c7a', '#7a6a5c', '#5c6a7a', '#7a5c6a', '#6e7a5c', '#5c7a7a', '#7a6e5c'];

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.append(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '!' : '•'}</span><span>${message}</span>`;
  container.append(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 220);
  }, 3500);
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function initModals() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.remove('open');
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
}

function nameHash(name) {
  return [...String(name || 'User')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function initials(name) {
  const parts = String(name || 'User').trim().split(/\s+/);
  return parts.map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

function createAvatar(name, size = 'md') {
  const div = document.createElement('div');
  div.className = `avatar ${size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : ''}`.trim();
  div.style.background = avatarColors[nameHash(name) % avatarColors.length];
  div.textContent = initials(name);
  div.title = name || 'User';
  return div;
}

function formatAmount(amount, currency = '₹') {
  return `${currency}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function requireAuth() {
  if (!localStorage.getItem('sl_token')) {
    localStorage.setItem('sl_redirect', location.pathname + location.search);
    window.location.href = '/index.html';
  }
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('sl_user') || '{}');
  } catch (err) {
    return {};
  }
}

function initSidebar(page) {
  const user = getStoredUser();
  const target = document.getElementById('sidebarUser');
  if (target) {
    target.innerHTML = '';
    target.append(createAvatar(user.name || user.email, 'sm'));
    const info = document.createElement('div');
    info.className = 'user-card-info';
    info.innerHTML = `<div class="user-card-name">${user.name || 'Silver user'}</div><div class="user-card-email">${user.email || ''}</div>`;
    target.append(info);
  }
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('sl_token');
    localStorage.removeItem('sl_user');
    window.location.href = '/index.html';
  });
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay.classList.remove('active');
  });
}

function initTagInput(wrapEl, onUpdate) {
  const values = [];
  const input = document.createElement('input');
  input.className = 'tag-input-inner';
  input.placeholder = 'Press Enter to add an email';
  wrapEl.append(input);

  function render() {
    wrapEl.querySelectorAll('.tag-chip').forEach((chip) => chip.remove());
    values.forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${value}<button type="button" class="tag-chip-remove">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        values.splice(values.indexOf(value), 1);
        render();
      });
      wrapEl.insertBefore(chip, input);
    });
    onUpdate([...values]);
  }

  function add(raw) {
    const email = raw.trim().replace(/,$/, '').toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast(`Invalid email: ${email}`, 'error');
      return;
    }
    if (!values.includes(email)) values.push(email);
    input.value = '';
    render();
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(input.value);
    }
    if (event.key === 'Backspace' && !input.value && values.length) {
      values.pop();
      render();
    }
  });
  input.addEventListener('blur', () => add(input.value));
  wrapEl.addEventListener('click', () => input.focus());
  return { getValues: () => [...values], setValues: (next) => { values.splice(0, values.length, ...next); render(); } };
}

function renderSkeletons(container, count = 4) {
  container.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="skeleton" style="height:18px;width:60%;margin-bottom:18px"></div><div class="skeleton" style="height:1px;width:100%;margin-bottom:24px"></div><div class="skeleton" style="height:36px;width:46%;margin-bottom:24px"></div><div class="skeleton" style="height:24px;width:52%"></div>';
    container.append(card);
  }
}

function appShell(page, content) {
  return `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <a class="sidebar-brand" href="/dashboard.html"><span class="brand-icon">✦</span><span class="brand-name">SilverLining</span></a>
        <nav class="sidebar-nav">
          <a href="/dashboard.html" class="nav-item" data-page="dashboard"><span class="nav-icon">▦</span> Groups</a>
          <a href="/settings.html" class="nav-item" data-page="settings"><span class="nav-icon">⚙</span> Settings</a>
        </nav>
        <div class="sidebar-footer">
          <div class="user-card" id="sidebarUser"></div>
          <button class="btn btn-ghost btn-sm" id="logoutBtn">Sign out</button>
        </div>
      </aside>
      <header class="mobile-header">
        <button class="btn-icon" id="menuBtn">☰</button>
        <span class="brand-name-sm">SilverLining</span>
        <div style="width:36px"></div>
      </header>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <main class="main-content"><div class="page-container">${content}</div></main>
    </div>`;
}

function setButtonLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text || 'Working...';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function animateAmount(el, target) {
  const start = performance.now();
  const value = Number(target || 0);
  function frame(now) {
    const t = Math.min((now - start) / 600, 1);
    el.textContent = formatAmount(value * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
