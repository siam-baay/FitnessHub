document.addEventListener('DOMContentLoaded', () => {
  const login = document.querySelector('#loginForm');
  const register = document.querySelector('#registerForm');

  login?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter || login.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    const email = document.querySelector('#email')?.value;
    const password = document.querySelector('#password')?.value;

    try {
      // Attempt backend API call
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      saveAuth(data);
      window.location.href = 'classes.html';
    } catch (err) {
      // Static host fallback (GitHub Pages 405 / server offline)
      if (err.message.includes('405') || err.message.includes('Failed to fetch')) {
        saveAuth({ token: 'demo-token', user: { email, role: 'member' } });
        window.location.href = 'classes.html';
      } else {
        showAlert(err.message, 'danger');
      }
    } finally {
      if (button) button.disabled = false;
    }
  });

  register?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter || register.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    const full_name = document.querySelector('#full_name')?.value;
    const email = document.querySelector('#email')?.value;
    const password = document.querySelector('#password')?.value;
    const phone = document.querySelector('#phone')?.value;

    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name, email, password, phone })
      });
      saveAuth(data);
      window.location.href = 'classes.html';
    } catch (err) {
      if (err.message.includes('405') || err.message.includes('Failed to fetch')) {
        saveAuth({ token: 'demo-token', user: { email, full_name, role: 'member' } });
        window.location.href = 'classes.html';
      } else {
        showAlert(err.message, 'danger');
      }
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