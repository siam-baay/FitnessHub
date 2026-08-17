document.addEventListener('DOMContentLoaded', ()=>{
  const user = getUser();
  const authBtn = document.querySelector('#authNav');
  if(user){
    authBtn.textContent='Dashboard';
    authBtn.href='/dashboard.html';
  }
});
