document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }

  const membershipBox = document.querySelector('#membershipBox');
  const saveButton = document.querySelector('#saveProfile');

  try {
    const results = await Promise.allSettled([
      api('/auth/me'),
      api('/memberships'),
      api('/attendance'),
      api('/bookings/my').catch(() => [])
    ]);

    const value = i => results[i].status === 'fulfilled' ? results[i].value : [];
    const meResponse = results[0].status === 'fulfilled' ? results[0].value : {};
    const membershipsResponse = value(1);
    const attendanceResponse = value(2);
    const bookingsResponse = value(3);

    const currentUser = meResponse?.user || meResponse || {};
    const memberships = Array.isArray(membershipsResponse) ? membershipsResponse : [];
    const attendance = Array.isArray(attendanceResponse) ? attendanceResponse : [];
    const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : [];

    // Progress is intentionally kept in browser storage so the project
    // remains a simple four-table database. Older versions could leave
    // duplicate rows in the JSON file, so remove duplicates when reading.
    const progressKey = `fh_progress_${currentUser.id || currentUser.email || 'member'}`;
    const storedProgress = JSON.parse(localStorage.getItem(progressKey) || '[]');
    const progress = Array.isArray(storedProgress)
      ? dedupeProgress(storedProgress)
      : [];

    // There is no payments table in the four-table design. Show the
    // current membership as the payment record instead of an empty panel.
    const payments = memberships
      .filter(m => Number(m.price || 0) > 0)
      .map(m => ({
        date: m.join_date || m.start_date || '—',
        amount: m.price,
        method: 'Membership',
        status: String(m.status || 'Active')
      }));

    fill('full_name', currentUser.full_name || currentUser.name || '');
    fill('email', currentUser.email || '');
    fill('phone', currentUser.phone || '');

    const today = new Date().toISOString().slice(0, 10);
    const active = memberships.find(m =>
      String(m.status || '').toLowerCase() === 'active' &&
      (!m.expiry_date && !m.end_date && !m.endDate || String(m.expiry_date || m.end_date || m.endDate) >= today)
    ) || memberships[0];

    renderMembership(active);
    renderUpcomingBookings(bookings);
    renderAttendance(attendance);
    renderPayments(payments);
    renderProgress(progress);
  } catch (e) {
    console.error('Profile loading error:', e);
    renderMembership(null);
    renderUpcomingBookings([]);
    renderAttendance([]);
    renderPayments([]);
    renderProgress([]);
  }

  saveButton?.addEventListener('click', async () => {
    const fullNameEl = document.querySelector('#full_name');
    const emailEl = document.querySelector('#email');
    const phoneEl = document.querySelector('#phone');

    const fullName = fullNameEl?.value.trim() || '';
    const email = emailEl?.value.trim() || '';
    const phone = phoneEl?.value.trim() || '';

    if (!fullName || !email) {
      alert('Full name and email are required.');
      return;
    }

    saveButton.disabled = true;
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      const updated = await api('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, email, phone })
      });

      const updatedUser = updated?.user || updated || {};
      const oldUser = getUser() || {};

      localStorage.setItem('fh_user', JSON.stringify({
        ...oldUser,
        id: updatedUser.id ?? oldUser.id,
        name: updatedUser.name || updatedUser.full_name || fullName,
        full_name: updatedUser.full_name || updatedUser.name || fullName,
        email: updatedUser.email || email,
        phone: updatedUser.phone || phone,
        role: updatedUser.role || oldUser.role
      }));

      fill('full_name', updatedUser.full_name || updatedUser.name || fullName);
      fill('email', updatedUser.email || email);
      fill('phone', updatedUser.phone || phone);

      alert('Profile updated successfully.');
    } catch (err) {
      console.error('Save profile error:', err);
      alert(err.message || 'Unable to save your profile.');
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
    }
  });

  document.querySelector('#progressForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const user = getUser() || {};
      const progressKey = `fh_progress_${user.id || user.email || 'member'}`;
      const entry = {
        id: Date.now(),
        date: document.querySelector('#metric_date').value,
        metric_date: document.querySelector('#metric_date').value,
        weight_kg: document.querySelector('#weight_kg').value || null,
        body_fat: document.querySelector('#body_fat').value || null,
        chest_cm: document.querySelector('#chest_cm').value || null,
        waist_cm: document.querySelector('#waist_cm').value || null,
        notes: document.querySelector('#notes').value || ''
      };
      const existing = JSON.parse(localStorage.getItem(progressKey) || '[]');
      const rows = dedupeProgress([entry, ...(Array.isArray(existing) ? existing : [])]);
      localStorage.setItem(progressKey, JSON.stringify(rows));
      alert('Progress saved.');
      location.reload();
    } catch (err) {
      alert(err.message || 'Unable to save progress.');
    }
  });
});

function renderMembership(active) {
  const box = document.querySelector('#membershipBox');
  if (!box) return;

  const plan = active?.plan_name || active?.plan || 'Membership';
  const start = active?.start_date || active?.join_date || active?.startDate || '';
  const end = active?.end_date || active?.expiry_date || active?.endDate || '';

  box.innerHTML = `
    <div class="membership-panel">
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="membership-plan">${escapeHtml(plan)}</div>
          <div class="membership-meta small">
            ${escapeHtml(start || '—')} → ${escapeHtml(end || '—')}
          </div>
        </div>
        <span class="badge badge-soft rounded-pill">
          ${active ? 'Active' : 'No membership'}
        </span>
      </div>
      <div class="membership-actions">
        <button type="button" class="btn btn-membership" id="manageMembershipBtn">
          <i class="bi ${active ? 'bi-gear-fill' : 'bi-card-checklist'} me-1"></i>
          ${active ? 'Manage Membership' : 'View Membership'}
        </button>
      </div>
    </div>`;

  document.querySelector('#manageMembershipBtn')?.addEventListener('click', async () => {
    const modalBody = document.querySelector('#membershipModalBody');
    const modalEl = document.querySelector('#membershipModal');
    if (!modalBody || !modalEl) {
      alert(active
        ? `Your ${plan} membership is active until ${end || 'the current end date'}.`
        : 'You do not have an active membership.');
      return;
    }

    if (active) {
      let plans = [];
      try {
        const planResponse = await api('/memberships/plans');
        plans = Array.isArray(planResponse) ? planResponse : [];
      } catch (err) {
        console.error('Could not load membership plans:', err);
      }

      const selectedPlanId = active?.plan_id ?? active?.planId ?? '';
      const defaultStart = active?.start_date || active?.join_date || active?.startDate || new Date().toISOString().slice(0, 10);

      modalBody.innerHTML = `
        <div class="membership-panel">
          <div class="membership-plan mb-3">Change Membership</div>
          <label class="form-label text-white" for="membershipPlanSelect">Membership plan</label>
          <select id="membershipPlanSelect" class="form-select mb-3">
            ${plans.length
              ? plans.map(p => `
                <option value="${escapeHtml(p.id)}" ${String(p.id) === String(selectedPlanId) ? 'selected' : ''}>
                  ${escapeHtml(p.plan_name || p.name || 'Plan')} — ৳${Number(p.price || 0).toLocaleString()}
                </option>`).join('')
              : '<option value="">No plans available</option>'}
          </select>

          <label class="form-label text-white" for="membershipStartDate">Start date</label>
          <input id="membershipStartDate" type="date" class="form-control mb-3"
                 value="${escapeHtml(defaultStart)}">

          <div id="membershipChangeMessage" class="small text-white mb-2"></div>

          <button type="button" class="btn btn-membership w-100" id="saveMembershipBtn" ${plans.length ? '' : 'disabled'}>
            Save Membership Change
          </button>
        </div>`;

      document.querySelector('#saveMembershipBtn')?.addEventListener('click', async () => {
        const planId = document.querySelector('#membershipPlanSelect')?.value;
        const startDate = document.querySelector('#membershipStartDate')?.value;
        const saveBtn = document.querySelector('#saveMembershipBtn');
        const message = document.querySelector('#membershipChangeMessage');

        if (!planId) {
          message.textContent = 'Please select a membership plan.';
          return;
        }
        if (!startDate) {
          message.textContent = 'Please select a start date.';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        message.textContent = '';

        try {
          const updated = await api('/memberships', {
            method: 'POST',
            body: JSON.stringify({
              plan_id: Number(planId),
              start_date: startDate
            })
          });

          message.textContent = 'Membership updated successfully.';
          message.className = 'small text-white mb-2';

          // Refresh the membership card with the saved plan.
          renderMembership(updated);

          setTimeout(() => {
            if (window.bootstrap) {
              bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            }
          }, 700);
        } catch (err) {
          console.error('Membership change error:', err);
          message.textContent = err.message || 'Unable to change membership.';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Membership Change';
        }
      });
    } else {
      let plans = [];
      try {
        const planResponse = await api('/memberships/plans');
        plans = Array.isArray(planResponse) ? planResponse : [];
      } catch (err) {
        console.error('Could not load membership plans:', err);
      }

      modalBody.innerHTML = `
        <div class="membership-panel">
          <div class="membership-plan mb-3">Choose a Membership</div>
          <label class="form-label text-white" for="membershipPlanSelect">Membership plan</label>
          <select id="membershipPlanSelect" class="form-select mb-3">
            ${plans.map(p => `
              <option value="${escapeHtml(p.id)}">
                ${escapeHtml(p.plan_name || p.name || 'Plan')} — ৳${Number(p.price || 0).toLocaleString()}
              </option>`).join('')}
          </select>

          <label class="form-label text-white" for="membershipStartDate">Start date</label>
          <input id="membershipStartDate" type="date" class="form-control mb-3"
                 value="${new Date().toISOString().slice(0, 10)}">

          <div id="membershipChangeMessage" class="small text-white mb-2"></div>
          <button type="button" class="btn btn-membership w-100" id="saveMembershipBtn" ${plans.length ? '' : 'disabled'}>
            Start Membership
          </button>
        </div>`;

      document.querySelector('#saveMembershipBtn')?.addEventListener('click', async () => {
        const planId = document.querySelector('#membershipPlanSelect')?.value;
        const startDate = document.querySelector('#membershipStartDate')?.value;
        const saveBtn = document.querySelector('#saveMembershipBtn');
        const message = document.querySelector('#membershipChangeMessage');

        if (!planId || !startDate) {
          message.textContent = 'Please select a plan and start date.';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          const updated = await api('/memberships', {
            method: 'POST',
            body: JSON.stringify({ plan_id: Number(planId), start_date: startDate })
          });

          message.textContent = 'Membership updated successfully.';
          renderMembership(updated);

          setTimeout(() => {
            if (window.bootstrap) {
              bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            }
          }, 700);
        } catch (err) {
          message.textContent = err.message || 'Unable to start membership.';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Start Membership';
        }
      });
    }

    if (window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    } else {
      alert(active
        ? `${plan} — Active until ${end || 'the current end date'}.`
        : 'You do not have an active membership.');
    }
  });
}


function renderUpcomingBookings(rows) {
  const el = document.querySelector('#upcomingBookingRows');
  if (!el) return;

  const today = new Date().toISOString().slice(0,10);
  const upcoming = (Array.isArray(rows) ? rows : [])
    .filter(b => String(b.status || '').toLowerCase() === 'confirmed')
    .filter(b => !b.class_date || String(b.class_date) >= today)
    .sort((a,b) => String(a.class_date).localeCompare(String(b.class_date)) || String(a.start_time).localeCompare(String(b.start_time)));

  el.innerHTML = upcoming.slice(0, 8).map(b => `
    <tr>
      <td>${escapeHtml(formatDate(b.class_date || '—'))}</td>
      <td>${escapeHtml(b.title || 'Fitness class')}</td>
      <td>${escapeHtml(formatTime(b.start_time))}${b.end_time ? '–' + escapeHtml(formatTime(b.end_time)) : ''}</td>
      <td><span class="badge badge-soft rounded-pill">Booked</span></td>
    </tr>`).join('');

  if (!upcoming.length) {
    el.innerHTML = `<tr><td colspan="4" class="text-white-50">No upcoming bookings. Book a class from the Classes page.</td></tr>`;
  }
}

function formatTime(value) {
  if (!value) return '—';
  const [hh, mm] = String(value).slice(0,5).split(':');
  const h = Number(hh);
  return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
}

function renderAttendance(rows) {
  const el = document.querySelector('#attendanceRows');
  if (!el) return;

  const clean = Array.isArray(rows) ? rows : [];
  el.innerHTML = clean.slice(0, 8).map(a => `
    <tr>
      <td>${escapeHtml(formatDate(a.attendance_date || a.date || '—'))}</td>
      <td>${escapeHtml(a.title || a.className || a.class_name || 'Gym check-in')}</td>
      <td><span class="badge badge-soft rounded-pill">${escapeHtml(a.status || 'Present')}</span></td>
    </tr>`).join('');

  if (!clean.length) {
    el.innerHTML = `<tr><td colspan="3" class="text-white-50">No attendance records yet.</td></tr>`;
  }
}

function renderPayments(rows) {
  const el = document.querySelector('#paymentRows');
  if (!el) return;

  const clean = Array.isArray(rows) ? rows : [];
  el.innerHTML = clean.slice(0, 8).map(p => `
    <tr>
      <td>${escapeHtml(formatDate(p.payment_date || p.date || '—'))}</td>
      <td>৳${Number(p.amount || 0).toLocaleString()}</td>
      <td>${escapeHtml(p.method || 'Membership')}</td>
      <td>${escapeHtml(p.status || 'Active')}</td>
    </tr>`).join('');

  if (!clean.length) {
    el.innerHTML = `<tr><td colspan="4" class="text-white-50">No payment history yet.</td></tr>`;
  }
}

function renderProgress(rows) {
  const el = document.querySelector('#progressRows');
  if (!el) return;

  const clean = dedupeProgress(Array.isArray(rows) ? rows : []);
  el.innerHTML = clean.slice(0, 8).map(p => `
    <tr>
      <td>${escapeHtml(formatDate(p.metric_date || p.date || '—'))}</td>
      <td>${p.weight_kg ?? p.weight ?? '—'}</td>
      <td>${p.body_fat ?? p.bodyFat ?? '—'}</td>
      <td>${p.waist_cm ?? '—'}</td>
    </tr>`).join('');

  if (!clean.length) {
    el.innerHTML = `<tr><td colspan="4" class="text-white-50">No measurements yet. Click “Add measurement” to record your first one.</td></tr>`;
  }
}

function dedupeProgress(rows) {
  const seen = new Set();
  return rows.filter(p => {
    const key = [
      p.metric_date || p.date || '',
      p.weight_kg ?? p.weight ?? '',
      p.body_fat ?? p.bodyFat ?? '',
      p.waist_cm ?? '',
      p.chest_cm ?? ''
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDate(value) {
  if (!value || value === '—') return value || '—';
  const d = new Date(`${String(value).slice(0,10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fill(id, value) {
  const el = document.querySelector('#' + id);
  if (el) el.value = value;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}