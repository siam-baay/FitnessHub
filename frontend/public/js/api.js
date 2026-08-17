const API = '/api';

function getToken(){ return localStorage.getItem('fh_token'); }
function getUser(){ try { return JSON.parse(localStorage.getItem('fh_user') || 'null'); } catch { return null; } }

async function api(path, options={}){
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  const token = getToken();
  if(token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(API + path, {...options, headers});
  } catch (e) {
    throw new Error('Cannot connect to the FitnessHub server. Make sure Node.js backend is running on http://localhost:5000.');
  }
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json().catch(()=>({})) : {};
  if(!response.ok) throw new Error(data.message || `Server error (${response.status}).`);
  return data;
}

function saveAuth(data){
  localStorage.setItem('fh_token', data.token);
  localStorage.setItem('fh_user', JSON.stringify(data.user));
}
function logout(){
  localStorage.removeItem('fh_token');
  localStorage.removeItem('fh_user');
  location.href='/';
}
