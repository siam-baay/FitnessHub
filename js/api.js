async function api(endpoint, options = {}) {
  const isStaticHost = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

  // Return static mock data directly on GitHub Pages
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

    const res = await fetch(endpoint, { ...options, headers });
    
    if (!res.ok) {
      throw new Error('Server error');
    }

    return await res.json();
  } catch (err) {
    console.warn(`API server offline for ${endpoint}. Using static fallback.`, err);
    return getMockResponse(endpoint);
  }
}

function getMockResponse(endpoint) {
  if (endpoint.includes('/auth')) {
    return {
      token: 'demo-token-12345',
      user: {
        id: 1,
        email: 'member@fitnesshub.local',
        full_name: 'Fitness Member',
        role: 'member'
      }
    };
  }

  if (endpoint.includes('/classes')) {
    return [
      {
        id: 1,
        title: 'Strength Lab',
        description: 'Progressive strength and resistance training built for all fitness levels.',
        class_date: new Date().toISOString().split('T')[0],
        start_time: '07:00:00',
        end_time: '08:00:00',
        trainer_name: 'Nadia Trainer',
        room: 'Studio A',
        booked_count: 5,
        capacity: 18
      },
      {
        id: 2,
        title: 'Redline HIIT',
        description: 'High-intensity interval training designed to burn calories and boost endurance.',
        class_date: new Date().toISOString().split('T')[0],
        start_time: '18:00:00',
        end_time: '19:00:00',
        trainer_name: 'Alex Rahman',
        room: 'Studio B',
        booked_count: 12,
        capacity: 20
      }
    ];
  }

  return { success: true };
}
