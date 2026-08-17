const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

async function api(endpoint, options = {}) {
  const isStaticHost = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

  // Direct mock response for GitHub Pages or offline preview
  if (isStaticHost) {
    return getMockResponse(endpoint);
  }

  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) throw new Error('Server error');
    return await res.json();
  } catch (err) {
    console.warn(`Backend offline at ${endpoint}. Using db.js seed fallback.`, err);
    return getMockResponse(endpoint);
  }
}

function getMockResponse(endpoint) {
  // Matches db.js seed user and profile metrics
  if (endpoint.includes('/profile') || endpoint.includes('/me') || endpoint.includes('/auth/me')) {
    return {
      id: 2,
      full_name: 'Alex Rahman',
      email: 'member@fitnesshub.local',
      phone: '+8801800000000',
      role: 'member'
    };
  }

  // Matches db.js seed membership plans & active user membership
  if (endpoint.includes('/memberships/plans') || endpoint.includes('/plans')) {
    return [
      { id: 1, name: 'Essential', duration_months: 1, price: 1500, description: 'Flexible access for one month.' },
      { id: 2, name: 'Performance', duration_months: 3, price: 3900, description: 'Three months with classes and progress tracking.' },
      { id: 3, name: 'Elite', duration_months: 12, price: 12000, description: 'Full-year membership with premium class access.' }
    ];
  }

  if (endpoint.includes('/memberships')) {
    return {
      id: 1,
      plan_name: 'Performance',
      duration_months: 3,
      price: 3900,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'active'
    };
  }

  // Matches db.js seed workout progress measurements
  if (endpoint.includes('/workouts') || endpoint.includes('/progress')) {
    return [
      { id: 1, metric_date: '2026-07-18', weight_kg: 71.5, body_fat: 18.2, chest_cm: 96, waist_cm: 82, notes: 'Starting measurement' },
      { id: 2, metric_date: '2026-08-18', weight_kg: 70.8, body_fat: 17.4, chest_cm: 98, waist_cm: 80, notes: 'Improved strength and consistency' }
    ];
  }

  // Matches db.js seed payments
  if (endpoint.includes('/payments')) {
    return [
      { id: 1, payment_date: '2026-08-18', amount: 3900, method: 'cash', status: 'paid', reference: 'FH-DEMO-001' }
    ];
  }

  // Matches db.js seed class bookings & attendance
  if (endpoint.includes('/bookings') || endpoint.includes('/attendance')) {
    return [
      { id: 1, title: 'Strength Lab', class_date: '2026-08-19', start_time: '07:00:00', status: 'booked' }
    ];
  }

  return { success: true };
}
