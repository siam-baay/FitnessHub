document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()) return location.href='/login.html';

  const box=document.querySelector('#classesGrid');

  try{
    const classes=await api('/classes');

    if(!Array.isArray(classes)){
      throw new Error('Invalid classes data returned by the server.');
    }

    if(classes.length === 0){
      box.innerHTML='<div class="col-12"><div class="alert alert-info">No upcoming classes are available.</div></div>';
      return;
    }

    box.innerHTML=classes.map(c=>{
      // The No-MySQL backend stores class data as date/time.
      // The MySQL backend uses class_date/start_time/end_time.
      const classDate = c.class_date || c.date || '';
      const startTime = c.start_time || c.time || '';
      const endTime = c.end_time || '';

      const displayDate = formatDate(classDate);
      const displayStart = formatTime(startTime);
      const displayEnd = endTime ? formatTime(endTime) : '';

      const schedule = classDate
        ? `${escapeHtml(displayDate)} · ${escapeHtml(displayStart)}${displayEnd ? `–${escapeHtml(displayEnd)}` : ''}`
        : 'Schedule not available';

      const booked = Number(c.booked_count ?? c.booked ?? 0);
      const capacity = Number(c.capacity ?? 0);
      const percentage = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : 0;

      return `
      <div class="col-md-6 col-xl-4">
        <div class="card class-card">
          <div class="class-time">${schedule}</div>
          <div class="class-title">${escapeHtml(c.title || 'Fitness class')}</div>
          <p class="muted small">${escapeHtml(c.description || 'Train consistently and track your progress.')}</p>
          <div class="d-flex justify-content-between small muted mb-3">
            <span>${escapeHtml(c.trainer_name || c.trainerName || 'Trainer')}</span>
            <span>${escapeHtml(c.room || 'Studio')}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <small class="muted">${booked} / ${capacity} booked</small>
            <div class="progress w-50">
              <div class="progress-bar" style="width:${percentage}%"></div>
            </div>
          </div>
          <button class="btn btn-red w-100" onclick="bookClass(${Number(c.id)})" ${capacity > 0 && booked >= capacity ? 'disabled' : ''}>
            ${capacity > 0 && booked >= capacity ? 'Class full' : 'Book class'}
          </button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    box.innerHTML=`<div class="col-12"><div class="alert alert-danger">${escapeHtml(e.message)}</div></div>`;
  }
});

async function bookClass(id){
  try{
    // No-MySQL backend exposes booking as /classes/:id/book.
    await api(`/classes/${id}/book`, {
      method:'POST',
      body:JSON.stringify({})
    });
    alert('Class booked successfully.');
    location.reload();
  }catch(e){
    alert(e.message);
  }
}

function formatDate(date){
  if(!date) return '';
  const d = new Date(`${String(date).slice(0,10)}T00:00:00`);
  if(Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('en-GB', {
    day:'2-digit',
    month:'short',
    year:'numeric'
  });
}

function formatTime(time){
  if(!time) return '';
  const raw=String(time).slice(0,5);
  const parts=raw.split(':');
  if(parts.length < 2) return raw;
  const hour=Number(parts[0]);
  const minute=parts[1];
  if(!Number.isFinite(hour)) return raw;
  const suffix=hour >= 12 ? 'PM' : 'AM';
  const hour12=hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}
