document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();

  // Populate user information across UI elements
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = user?.full_name || user?.email?.split('@')[0] || 'Member';
  });

  document.querySelectorAll('[data-user-role]').forEach(el => {
    el.textContent = user?.role || 'member';
  });

  document.querySelectorAll('[data-logout]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      logout();
    });
  });

  // Display user initials in avatar slots
  const nameParts = (user?.full_name || user?.email || 'FH').trim().split(/\s+/);
  const initials = nameParts.map(x => x[0]).slice(0, 2).join('').toUpperCase() || 'FH';
  document.querySelectorAll('[data-avatar]').forEach(el => {
    el.textContent = initials;
  });

  // Mobile menu sidebar toggle
  const menu = document.querySelector('[data-menu-toggle]');
  const sidebar = document.querySelector('.sidebar');
  if (menu && sidebar) {
    menu.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
});

// Safely retrieve user session object from localStorage
function getUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

// Clear local session storage and redirect via relative path
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html'; // Relative path prevents GitHub Pages 404
}