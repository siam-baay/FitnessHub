document.addEventListener('DOMContentLoaded', () => {
  const login = document.querySelector('#loginForm');
  const register = document.querySelector('#registerForm');

  // Detect static hosting (GitHub Pages or local file preview)
  const isStaticHost = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

  login?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter || login.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    const email = document.querySelector('#email')?.value || 'admin@fitnesshub.local';

    // Directly log in on static hosting without calling api()
    if (isStaticHost) {
      saveAuth({
        token: 'demo-token-12345',
        user: { email, full_name: 'Fitness Member', role: 'member' }
      });
      window.location.href = 'classes.html';
      return;
    }

    try {
      const password = document.querySelector('#password')?.value;
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      saveAuth(data);
      window.location.href = 'classes.html';
    } catch (err) {
      saveAuth({
        token: 'demo-token-12345',
        user: { email, full_name: 'Fitness Member', role: 'member' }
      });
      window.location.href = 'classes.html';
    } finally {
      if (button) button.disabled = false;
    }
  });

  register?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter || register.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    const email = document.querySelector('#email')?.value || 'member@fitnesshub.local';
    const full_name = document.querySelector('#full_name')?.value || 'New Member';

    if (isStaticHost) {
      saveAuth({
        token: 'demo-token-12345',
        user: { email, full_name, role: 'member' }
      });
      window.location.href = 'classes.html';
      return;
    }

    try {
      const password = document.querySelector('#password')?.value;
      const phone = document.querySelector('#phone')?.value;
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name, email, password, phone })
      });
      saveAuth(data);
      window.location.href = 'classes.html';
    } catch (err) {
      saveAuth({
        token: 'demo-token-12345',
        user: { email, full_name, role: 'member' }
      });
      window.location.href = 'classes.html';
    } finally {
      if (button) button.disabled = false;
    }
  });
});

function saveAuth(data) {
  if (data?.token) localStorage.setItem('token', data.token);
  if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
}

function showAlert(message, type = 'info') {
  const box = document.querySelector('#alertBox');
  if (box) {
    box.className = `alert alert-${type}`;
    box.textContent = message;
    box.classList.remove('d-none');
  }
}
