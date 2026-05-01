let inviteEmails = [];

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  document.body.innerHTML = appShell('dashboard', `
    <div class="page-header fade-in">
      <h1 class="page-title">Your Groups</h1>
      <button class="btn btn-primary btn-sm" id="newGroupBtn">+ New Group</button>
    </div>
    <section class="groups-grid fade-in delay-1" id="groupsGrid"></section>
    <div class="modal-overlay" id="groupModal">
      <form class="modal" id="groupForm">
        <div class="modal-header">
          <h2 class="modal-title">New Group</h2>
          <button class="modal-close" type="button" data-close-modal="groupModal">×</button>
        </div>
        <label class="input-group">
          <span class="input-label">Group Name</span>
          <input class="input" id="groupName" required>
          <span class="input-error" id="groupNameError"></span>
        </label>
        <div class="input-group" style="margin-top:14px">
          <span class="input-label">Invite Members</span>
          <div class="tag-input-wrap" id="inviteInput"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" type="button" data-close-modal="groupModal">Cancel</button>
          <button class="btn btn-primary" id="createGroupBtn" type="submit">Create Group</button>
        </div>
      </form>
    </div>`);
  initSidebar('dashboard');
  initModals();
  initTagInput(document.getElementById('inviteInput'), (values) => { inviteEmails = values; });
  document.getElementById('newGroupBtn').addEventListener('click', () => openModal('groupModal'));
  document.getElementById('groupForm').addEventListener('submit', createGroup);
  loadGroups();
});

async function loadGroups() {
  const grid = document.getElementById('groupsGrid');
  renderSkeletons(grid, 4);
  try {
    const { groups } = await api.get('/api/groups');
    if (!groups.length) {
      grid.className = '';
      grid.innerHTML = `<div class="empty-state card card-flat"><div class="empty-state-icon">₹</div><div class="empty-state-title">No groups yet</div><p class="empty-state-sub">Create a group to start splitting expenses with friends.</p><button class="btn btn-primary" id="firstGroupBtn">+ Create your first group</button></div>`;
      document.getElementById('firstGroupBtn').addEventListener('click', () => openModal('groupModal'));
      return;
    }
    grid.className = 'groups-grid fade-in delay-1';
    grid.innerHTML = '';
    await Promise.all(groups.map(async (group) => {
      let balance = 0;
      try {
        const summary = await api.get(`/api/groups/${group._id}/summary`);
        balance = summary.currentUserBalance || 0;
      } catch (err) {
        balance = 0;
      }
      grid.append(renderGroupCard(group, balance));
    }));
    const scroll = Number(sessionStorage.getItem('dashboard_scroll') || 0);
    if (scroll) setTimeout(() => window.scrollTo(0, scroll), 50);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state card card-flat"><div class="empty-state-title">Could not load groups</div><p class="empty-state-sub">${err.message}</p></div>`;
    showToast(err.message, 'error');
  }
}

function renderGroupCard(group, balance) {
  const card = document.createElement('article');
  card.className = 'card group-card';
  const avatars = document.createElement('div');
  avatars.className = 'avatar-stack';
  group.members.slice(0, 4).forEach((member) => avatars.append(createAvatar(member.name || member.email, 'sm')));
  if (group.members.length > 4) {
    const extra = document.createElement('span');
    extra.className = 'avatar-overflow';
    extra.textContent = `+${group.members.length - 4}`;
    avatars.append(extra);
  }
  const badge = balance > 0.005
    ? `<span class="badge badge-success">You are owed ${formatAmount(balance)}</span>`
    : balance < -0.005
      ? `<span class="badge badge-danger">You owe ${formatAmount(Math.abs(balance))}</span>`
      : '<span class="badge badge-neutral">All settled up ✓</span>';
  card.innerHTML = `<h3>${group.name}</h3><div class="group-divider"></div>`;
  card.append(avatars);
  card.insertAdjacentHTML('beforeend', `<div class="group-meta">${badge}</div>`);
  card.addEventListener('click', () => {
    sessionStorage.setItem('dashboard_scroll', String(window.scrollY));
    window.location.href = `/group.html?id=${group._id}`;
  });
  return card;
}

async function createGroup(event) {
  event.preventDefault();
  const name = document.getElementById('groupName').value.trim();
  document.getElementById('groupNameError').textContent = name ? '' : 'Group name is required';
  if (!name) return;
  const button = document.getElementById('createGroupBtn');
  try {
    setButtonLoading(button, true, 'Creating...');
    await api.post('/api/groups', { name, inviteEmails });
    closeModal('groupModal');
    document.getElementById('groupForm').reset();
    showToast('Group created!', 'success');
    loadGroups();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}
