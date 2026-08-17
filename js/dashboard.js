document.addEventListener('DOMContentLoaded', async ()=>{
  if(!getToken()) return location.href='/login.html';
  const user=getUser();
  document.querySelector('[data-role-note]').textContent =
    user?.role==='admin' ? 'Administrator control center' : 'Your fitness command center';

  try{
    const stats=await api('/dashboard/stats');
    if(user?.role==='admin'){
      set('members',stats.members); set('active',stats.active_memberships);
      set('revenue','৳'+Number(stats.revenue).toLocaleString()); set('classes',stats.upcoming_classes);
    }else{
      set('members',stats.membership_active?'Active':'Inactive');
      set('active',stats.attendance); set('revenue',stats.bookings); set('classes',stats.latest_progress?.weight_kg ? stats.latest_progress.weight_kg+' kg':'—');
    }
  }catch(e){ console.error(e); }
  try{
    const [classes, bookings] = await Promise.all([
      api('/classes'),
      api('/bookings/my').catch(() => [])
    ]);

    const bookedIds = new Set(
      (Array.isArray(bookings) ? bookings : [])
        .filter(b => String(b.status || '').toLowerCase() === 'confirmed')
        .map(b => Number(b.classId ?? b.class_id))
    );

    // Put the member's own upcoming bookings first. A booking is not
    // attendance: attendance will only appear after Admin/Reception checks
    // the member in.
    const ordered = [...(Array.isArray(classes) ? classes : [])].sort((a,b) => {
      const ab = bookedIds.has(Number(a.id)) ? 0 : 1;
      const bb = bookedIds.has(Number(b.id)) ? 0 : 1;
      if (ab !== bb) return ab - bb;
      return String(a.class_date).localeCompare(String(b.class_date)) ||
             String(a.start_time).localeCompare(String(b.start_time));
    });

    const box=document.querySelector('#upcomingClasses');
    box.innerHTML=ordered.slice(0,3).map(c=>`
      <div class="d-flex justify-content-between align-items-center py-3 border-bottom border-secondary border-opacity-10">
        <div>
          <div class="fw-semibold">${escapeHtml(c.title)}
            ${bookedIds.has(Number(c.id)) ? '<span class="badge badge-soft rounded-pill ms-2">Booked</span>' : ''}
          </div>
          <small class="muted">${escapeHtml(formatDate(c.class_date))} · ${escapeHtml(formatTime(c.start_time))}${c.end_time ? '–'+escapeHtml(formatTime(c.end_time)) : ''} · ${escapeHtml(c.room||'Studio')}</small>
        </div>
        <span class="badge badge-soft rounded-pill">${c.booked_count}/${c.capacity}</span>
      </div>`).join('') || '<div class="muted py-3">No upcoming classes.</div>';
  }catch(e){
    console.error('Could not load upcoming classes:', e);
  }
});
function set(id,value){const el=document.querySelector(`[data-stat="${id}"]`);if(el)el.textContent=value}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function formatDate(value){
  if(!value) return '';
  const dt=new Date(`${String(value).slice(0,10)}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? String(value) : dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function formatTime(value){
  if(!value) return '';
  const [hh,mm]=String(value).slice(0,5).split(':');
  const h=Number(hh);
  return `${h%12||12}:${mm} ${h>=12?'PM':'AM'}`;
}
