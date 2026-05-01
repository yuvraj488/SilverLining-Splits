function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname;

  if ((path === '/' || path.endsWith('/index.html')) && localStorage.getItem('sl_token')) {
    window.location.href = '/dashboard.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      setError('emailError', validEmail(email) ? '' : 'Enter a valid email');
      setError('passwordError', password ? '' : 'Password is required');
      if (!validEmail(email) || !password) return;
      const button = document.getElementById('loginBtn');
      try {
        setButtonLoading(button, true, 'Signing in...');
        const data = await api.post('/api/auth/login', { email, password });
        localStorage.setItem('sl_token', data.token);
        localStorage.setItem('sl_user', JSON.stringify(data.user));
        const pendingJoin = sessionStorage.getItem('pending_join');
        const redirect = pendingJoin || localStorage.getItem('sl_redirect') || '/dashboard.html';
        sessionStorage.removeItem('pending_join');
        localStorage.removeItem('sl_redirect');
        window.location.href = redirect;
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  const signupForm = document.getElementById('signupForm');
  const passwordInput = document.getElementById('password');
  if (passwordInput && document.getElementById('strengthBar')) {
    passwordInput.addEventListener('input', () => {
      const score = passwordStrength(passwordInput.value);
      const bar = document.getElementById('strengthBar');
      bar.style.width = `${score * 25}%`;
      bar.style.background = score < 2 ? 'var(--danger)' : score < 4 ? 'var(--warning)' : 'var(--success)';
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      setError('nameError', name ? '' : 'Name is required');
      setError('emailError', validEmail(email) ? '' : 'Enter a valid email');
      setError('passwordError', password.length >= 8 ? '' : 'Use at least 8 characters');
      setError('confirmError', password === confirmPassword ? '' : 'Passwords must match');
      if (!name || !validEmail(email) || password.length < 8 || password !== confirmPassword) return;
      const button = document.getElementById('signupBtn');
      try {
        setButtonLoading(button, true, 'Creating...');
        await api.post('/api/auth/signup', { name, email, password });
        document.getElementById('signupCard').innerHTML = `
          <div class="empty-state" style="padding:18px 0">
            <div class="empty-state-icon">✉</div>
            <h1 class="auth-heading">Check your inbox</h1>
            <p class="empty-state-sub">We sent a verification link to ${email}. Click it to activate your account.</p>
            <a class="btn btn-primary" href="/index.html">Back to sign in</a>
          </div>`;
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  const verifyCard = document.getElementById('verifyCard');
  if (verifyCard) {
    const token = new URLSearchParams(location.search).get('token');
    (async () => {
      try {
        if (!token) throw new Error('Verification token is missing');
        await api.get(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        verifyCard.innerHTML = '<div class="empty-state" style="padding:18px 0"><div class="empty-state-icon">✓</div><h1 class="auth-heading">Email verified!</h1><p class="empty-state-sub">Your account is active. You can sign in now.</p><a class="btn btn-primary" href="/index.html">Go to sign in</a></div>';
      } catch (err) {
        verifyCard.innerHTML = '<div class="empty-state" style="padding:18px 0"><div class="empty-state-icon">×</div><h1 class="auth-heading">Invalid or expired link</h1><p class="empty-state-sub">Ask for a fresh verification email from the sign-in flow.</p><a class="btn btn-ghost" href="/index.html">Back to sign in</a></div>';
      }
    })();
  }
});
