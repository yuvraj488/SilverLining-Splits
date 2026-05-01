document.addEventListener('DOMContentLoaded', async () => {
  const token = new URLSearchParams(location.search).get('token');
  const card = document.getElementById('joinCard');
  if (!token) {
    card.innerHTML = '<div class="empty-state"><div class="empty-state-title">Invite token missing</div><a class="btn btn-ghost" href="/dashboard.html">Go to dashboard</a></div>';
    return;
  }

  if (!localStorage.getItem('sl_token')) {
    sessionStorage.setItem('pending_join', `/join.html?token=${encodeURIComponent(token)}`);
    card.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✦</div><h1 class="auth-heading">Sign in to join this group</h1><p class="empty-state-sub">Use your account first, then SilverLining will bring you back here.</p><div class="page-actions"><a class="btn btn-primary" href="/index.html">Sign in</a><a class="btn btn-ghost" href="/signup.html">Create account</a></div></div>`;
    return;
  }

  try {
    const { group, alreadyMember } = await api.get(`/api/groups/join?token=${encodeURIComponent(token)}`);
    if (alreadyMember) {
      card.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✓</div><h1 class="auth-heading">You're already in ${group.name}</h1><p class="empty-state-sub">${group.memberCount} members are splitting here.</p><a class="btn btn-primary" href="/group.html?id=${group.id}">Go to group</a></div>`;
      return;
    }
    card.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✦</div><h1 class="auth-heading">${group.name}</h1><p class="empty-state-sub">${group.memberCount} members. Join to see balances and expenses.</p><button class="btn btn-primary" id="joinBtn">Join Group</button></div>`;
    document.getElementById('joinBtn').addEventListener('click', async () => {
      try {
        const data = await api.post('/api/groups/join', { token });
        showToast('Joined group', 'success');
        window.location.href = `/group.html?id=${data.groupId}`;
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    card.innerHTML = `<div class="empty-state"><div class="empty-state-title">Invite not found</div><p class="empty-state-sub">${err.message}</p><a class="btn btn-ghost" href="/dashboard.html">Go to dashboard</a></div>`;
  }
});
