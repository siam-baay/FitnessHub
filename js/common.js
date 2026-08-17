document.addEventListener('DOMContentLoaded', ()=>{
  const user = getUser();
  document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=user?.full_name || 'Guest');
  document.querySelectorAll('[data-user-role]').forEach(el=>el.textContent=user?.role || '');
  document.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();logout()}));

  const initials = user?.full_name?.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase() || 'FH';
  document.querySelectorAll('[data-avatar]').forEach(el=>el.textContent=initials);

  const menu = document.querySelector('[data-menu-toggle]');
  const sidebar = document.querySelector('.sidebar');
  if(menu && sidebar) menu.addEventListener('click',()=>sidebar.classList.toggle('open'));
});
