document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  const user = getStoredUser();
  document.body.innerHTML = appShell('settings', `
    <div class="page-header fade-in"><h1 class="page-title">Settings</h1></div>
    <section class="settings-grid">
      <form class="card form-grid fade-in delay-1" id="profileForm">
        <h2 class="modal-title">Profile</h2>
        <div id="avatarPreview"></div>
        <label class="input-group"><span class="input-label">Name</span><input class="input" id="name" value="${user.name || ''}"></label>
        <label class="input-group"><span class="input-label">Email</span><input class="input" value="${user.email || ''}" readonly></label>
        <button class="btn btn-primary" id="saveProfileBtn" type="submit">Save profile</button>
      </form>
      <form class="card form-grid fade-in delay-2" id="passwordForm">
        <h2 class="modal-title">Change Password</h2>
        <label class="input-group"><span class="input-label">Current Password</span><input class="input" id="currentPassword" type="password"></label>
        <label class="input-group"><span class="input-label">New Password</span><input class="input" id="newPassword" type="password"></label>
        <label class="input-group"><span class="input-label">Confirm New Password</span><input class="input" id="confirmPassword" type="password"></label>
        <button class="btn btn-primary" id="changePasswordBtn" type="submit">Change password</button>
      </form>
      <section class="card fade-in delay-2">
        <h2 class="modal-title">Notifications</h2>
        <p class="muted" style="margin-top:8px">Email nudges and settlement reminders are coming soon.</p>
        <label class="preview-row"><span>Expense updates</span><input type="checkbox" disabled></label>
        <label class="preview-row"><span>Settlement reminders</span><input type="checkbox" disabled></label>
      </section>
      <section class="card fade-in delay-2">
        <h2 class="modal-title">Danger Zone</h2>
        <p class="muted" style="margin:8px 0 14px">Deleting your account removes your login. Group history may remain for other members.</p>
        <button class="btn btn-danger" id="deleteAccountBtn">Delete Account</button>
      </section>
    </section>
    <div class="modal-overlay" id="deleteModal">
      <div class="modal">
        <div class="modal-header"><h2 class="modal-title">Delete account?</h2><button class="modal-close" data-close-modal="deleteModal">×</button></div>
        <p class="muted">This cannot be undone.</p>
        <div class="modal-footer"><button class="btn btn-ghost" data-close-modal="deleteModal">Cancel</button><button class="btn btn-danger" id="confirmDeleteBtn">Delete</button></div>
      </div>
    </div>`);
  initSidebar('settings');
  initModals();
  document.getElementById('avatarPreview').append(createAvatar(user.name || user.email, 'lg'));

  document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api.patch('/api/auth/profile', { name: document.getElementById('name').value.trim() });
      localStorage.setItem('sl_user', JSON.stringify(data.user));
      showToast('Profile saved', 'success');
      initSidebar('settings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    if (newPassword !== document.getElementById('confirmPassword').value) return showToast('New passwords must match', 'error');
    try {
      await api.post('/api/auth/change-password', { currentPassword: document.getElementById('currentPassword').value, newPassword });
      event.target.reset();
      showToast('Password changed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('deleteAccountBtn').addEventListener('click', () => openModal('deleteModal'));
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    try {
      await api.delete('/api/auth/account');
      localStorage.clear();
      window.location.href = '/index.html';
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});
