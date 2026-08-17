document.addEventListener('DOMContentLoaded', ()=>{
  const login = document.querySelector('#loginForm');
  const register = document.querySelector('#registerForm');

  login?.addEventListener('submit', async e=>{
    e.preventDefault();
    const button=e.submitter;
    button.disabled=true;
    try{
      const data=await api('/auth/login',{
        method:'POST',
        body:JSON.stringify({
          email:document.querySelector('#email').value,
          password:document.querySelector('#password').value
        })
      });
      saveAuth(data);
      location.href='/dashboard.html';
    }catch(err){ showAlert(err.message,'danger'); }
    finally{button.disabled=false;}
  });

  register?.addEventListener('submit', async e=>{
    e.preventDefault();
    const button=e.submitter; button.disabled=true;
    try{
      const data=await api('/auth/register',{
        method:'POST',
        body:JSON.stringify({
          full_name:document.querySelector('#full_name').value,
          email:document.querySelector('#email').value,
          password:document.querySelector('#password').value,
          phone:document.querySelector('#phone').value
        })
      });
      saveAuth(data);
      location.href='/dashboard.html';
    }catch(err){showAlert(err.message,'danger');}
    finally{button.disabled=false;}
  });
});
function showAlert(message,type='info'){
  const box=document.querySelector('#alertBox');
  if(box){box.className=`alert alert-${type}`;box.textContent=message;box.classList.remove('d-none');}
}
