/**
 * QFIT Staff Management Dashboard Controller
 * Implements Active Sessions, Waitlist, Search, Expiration Filters,
 * Expired-at-Top Highlighting, and Timer Resync.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Authentication Check
  const authUser = window.QFitAuth ? window.QFitAuth.getCurrentUser() : null;
  const staffNameSidebar = document.getElementById('staff-name-sidebar');
  const staffTopName = document.getElementById('staff-top-name');
  const btnLogout = document.getElementById('btn-staff-logout');

  if (authUser) {
    if (staffNameSidebar) staffNameSidebar.textContent = authUser.fullName;
    if (staffTopName) staffTopName.textContent = authUser.fullName;
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      window.QFitAuth.logout();
    });
  }

  // Tab Elements
  const tabActiveSessions = document.getElementById('tab-active-sessions');
  const tabWaitlist = document.getElementById('tab-waitlist');
  const panelActiveSessions = document.getElementById('panel-active-sessions');
  const panelWaitlist = document.getElementById('panel-waitlist');
  const navTabActive = document.getElementById('nav-tab-active');
  const navTabWaitlist = document.getElementById('nav-tab-waitlist');

  const countTabActive = document.getElementById('count-tab-active');
  const countTabWaitlist = document.getElementById('count-tab-waitlist');
  const badgeNavActive = document.getElementById('badge-nav-active');
  const badgeNavWaitlist = document.getElementById('badge-nav-waitlist');
  const topOccupancyBadge = document.getElementById('top-occupancy-badge');

  // Filters
  const filterSearch = document.getElementById('filter-search');
  const filterExpiration = document.getElementById('filter-expiration');
  const sortTimer = document.getElementById('sort-timer');
  const btnQuickWalkin = document.getElementById('btn-quick-walkin');
  const btnStaffReset = document.getElementById('btn-staff-reset');

  // Table Bodies
  const activeSessionsTbody = document.getElementById('active-sessions-tbody');
  const waitlistTbody = document.getElementById('waitlist-tbody');
  const activeEmptyState = document.getElementById('active-empty-state');
  const waitlistEmptyState = document.getElementById('waitlist-empty-state');

  let currentTab = 'active'; // 'active' or 'waitlist'
  let tickInterval = null;

  // 2. Tab Switching
  function switchTab(tab) {
    currentTab = tab;
    if (tab === 'active') {
      tabActiveSessions.classList.add('active');
      tabWaitlist.classList.remove('active');
      navTabActive.classList.add('active');
      navTabWaitlist.classList.remove('active');
      panelActiveSessions.style.display = 'block';
      panelWaitlist.style.display = 'none';
      renderActiveSessions();
    } else {
      tabWaitlist.classList.add('active');
      tabActiveSessions.classList.remove('active');
      navTabWaitlist.classList.add('active');
      navTabActive.classList.remove('active');
      panelWaitlist.style.display = 'block';
      panelActiveSessions.style.display = 'none';
      renderWaitlist();
    }
  }

  tabActiveSessions.addEventListener('click', () => switchTab('active'));
  navTabActive.addEventListener('click', () => switchTab('active'));
  tabWaitlist.addEventListener('click', () => switchTab('waitlist'));
  navTabWaitlist.addEventListener('click', () => switchTab('waitlist'));

  // 3. Render Active Gym Sessions
  function renderActiveSessions() {
    const rawQueue = window.QFitStore.getQueue();
    const capacity = window.QFitStore.getCapacityStatus();

    // Update Counts & Badges
    countTabActive.textContent = `${rawQueue.length} / ${capacity.maxCapacity}`;
    badgeNavActive.textContent = rawQueue.length;
    topOccupancyBadge.textContent = `Occupancy: ${rawQueue.length} / ${capacity.maxCapacity} Students`;

    if (capacity.isFull) {
      topOccupancyBadge.className = 'badge badge-danger';
    } else {
      topOccupancyBadge.className = 'badge badge-success';
    }

    // Search & Filter
    const query = filterSearch.value.trim().toLowerCase();
    const expFilter = filterExpiration.value;
    const sortMode = sortTimer.value;
    const now = Date.now();

    let list = rawQueue.map(student => {
      const elapsedMs = now - student.joinedAt;
      const totalMs = student.durationMinutes * 60 * 1000;
      const remainingMs = totalMs - elapsedMs;
      const remainingMins = Math.round(remainingMs / (60 * 1000));
      const isExpired = remainingMs <= 0;
      return { ...student, remainingMs, remainingMins, isExpired };
    });

    // Apply Search
    if (query) {
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(query) ||
        s.studentId.toLowerCase().includes(query)
      );
    }

    // Apply Expiration Filter
    if (expFilter === 'expired') {
      list = list.filter(s => s.isExpired);
    } else if (expFilter === '10') {
      list = list.filter(s => s.remainingMins <= 10);
    } else if (expFilter === '15') {
      list = list.filter(s => s.remainingMins <= 15);
    } else if (expFilter === '30') {
      list = list.filter(s => s.remainingMins <= 30);
    }

    // Apply Sorting (Expired students prioritized at top when time-asc)
    list.sort((a, b) => {
      if (sortMode === 'time-asc') {
        // Expired sessions highlighted at the very top of queue
        if (a.isExpired && !b.isExpired) return -1;
        if (!a.isExpired && b.isExpired) return 1;
        return a.remainingMs - b.remainingMs;
      } else if (sortMode === 'time-desc') {
        return b.remainingMs - a.remainingMs;
      } else if (sortMode === 'arrival-asc') {
        return a.joinedAt - b.joinedAt;
      }
      return 0;
    });

    if (list.length === 0) {
      activeSessionsTbody.innerHTML = '';
      activeEmptyState.style.display = 'block';
      return;
    }

    activeEmptyState.style.display = 'none';

    let html = '';
    list.forEach((student, index) => {
      const entryTimeStr = new Date(student.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const initials = student.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const expiredClass = student.isExpired ? 'expired-row' : '';

      html += `
        <tr id="row-${student.id}" class="${expiredClass}" data-id="${student.id}" data-joined="${student.joinedAt}" data-duration="${student.durationMinutes}">
          <td>
            <span style="font-weight: 900; color: ${student.isExpired ? 'var(--primary-600)' : 'var(--gray-700)'}; font-size: 1rem;">
              #${index + 1}
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="avatar-circle" style="width: 34px; height: 34px; font-size: 0.8rem;">${initials}</div>
              <div>
                <div style="font-weight: 800; color: var(--gray-900); font-size: 0.95rem;">${escapeHtml(student.fullName)}</div>
                <div style="font-size: 0.775rem; color: var(--gray-500); font-family: monospace;">ID: ${escapeHtml(student.studentId)}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--gray-700);">${entryTimeStr}</div>
            <div style="font-size: 0.725rem; color: var(--gray-400);">${student.durationMinutes} min limit</div>
          </td>
          <td>
            <div id="timer-${student.id}" class="timer-badge ${student.isExpired ? 'expired' : 'active'}">
              Calculating...
            </div>
          </td>
          <td>
            ${renderSyncColumn(student)}
          </td>
          <td style="text-align: right;">
            <button class="btn btn-danger btn-sm btn-checkout" data-id="${student.id}" title="Check out student to free gym capacity">
              Check Out
            </button>
          </td>
        </tr>
      `;
    });

    activeSessionsTbody.innerHTML = html;
    updateAllTimers();
  }

  function renderSyncColumn(student) {
    if (student.syncFailed) {
      return `
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span class="badge badge-warning" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Out of Sync
          </span>
          <button class="btn btn-secondary btn-sm btn-resync" data-id="${student.id}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;" title="Resync timer with student portal">
            🔄 Resync
          </button>
        </div>
      `;
    }
    return `<span class="badge badge-success">✓ Synced</span>`;
  }

  // 4. Live Countdown Update Loop
  function updateAllTimers() {
    const rows = document.querySelectorAll('#active-sessions-tbody tr');
    const now = Date.now();

    rows.forEach(row => {
      const studentId = row.getAttribute('data-id');
      const joinedAt = parseInt(row.getAttribute('data-joined'), 10);
      const durationMin = parseInt(row.getAttribute('data-duration'), 10);
      const timerElement = document.getElementById(`timer-${studentId}`);

      if (!timerElement) return;

      const totalAllowedMs = durationMin * 60 * 1000;
      const elapsedMs = now - joinedAt;
      const remainingMs = totalAllowedMs - elapsedMs;

      if (remainingMs > 0) {
        const totalSec = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        timerElement.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        row.classList.remove('expired-row');

        if (mins < 5) {
          timerElement.className = 'timer-badge warning';
        } else {
          timerElement.className = 'timer-badge active';
        }
      } else {
        // Expired (Highlight in red at the top of queue)
        const overtimeSec = Math.abs(Math.floor(remainingMs / 1000));
        const oMins = Math.floor(overtimeSec / 60);
        const oSecs = overtimeSec % 60;
        timerElement.textContent = `⏰ EXPIRED (-${String(oMins).padStart(2, '0')}:${String(oSecs).padStart(2, '0')})`;
        timerElement.className = 'timer-badge expired';
        row.classList.add('expired-row');
      }
    });
  }

  // 5. Render Waitlist Panel
  function renderWaitlist() {
    const waitlist = window.QFitStore.getWaitlist();
    countTabWaitlist.textContent = waitlist.length;
    badgeNavWaitlist.textContent = waitlist.length;

    if (waitlist.length === 0) {
      waitlistTbody.innerHTML = '';
      waitlistEmptyState.style.display = 'block';
      return;
    }

    waitlistEmptyState.style.display = 'none';

    let html = '';
    waitlist.forEach((entry, index) => {
      const timeStr = new Date(entry.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const initials = entry.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      html += `
        <tr>
          <td>
            <span style="font-weight: 900; color: var(--primary-600); font-size: 1.05rem;">
              #${index + 1}
            </span>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="avatar-circle" style="width: 34px; height: 34px; font-size: 0.8rem;">${initials}</div>
              <div>
                <div style="font-weight: 800; color: var(--gray-900); font-size: 0.95rem;">${escapeHtml(entry.fullName)}</div>
                <div style="font-size: 0.775rem; color: var(--gray-500); font-family: monospace;">ID: ${escapeHtml(entry.studentId)}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--gray-700);">${timeStr}</div>
          </td>
          <td>
            ${entry.notify5MinBefore 
              ? '<span class="badge badge-success">🔔 5-Min Alert ON</span>' 
              : '<span class="badge badge-secondary" style="background: var(--gray-100); color: var(--gray-600);">Off</span>'}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; justify-content: flex-end; gap: 0.4rem;">
              <button class="btn btn-success btn-sm btn-admit-waitlist" data-id="${entry.studentId}" title="Admit to active gym queue">
                ✅ Admit
              </button>
              <button class="btn btn-secondary btn-sm btn-remove-waitlist" data-id="${entry.id}">
                &times; Remove
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    waitlistTbody.innerHTML = html;
  }

  // 6. Action Listeners
  activeSessionsTbody.addEventListener('click', (e) => {
    // Check out student
    const checkoutBtn = e.target.closest('.btn-checkout');
    if (checkoutBtn) {
      const id = checkoutBtn.getAttribute('data-id');
      window.QFitStore.removeStudent(id, { removedBy: 'staff' });
      renderActiveSessions();
      return;
    }

    // Staff manual timer resync
    const resyncBtn = e.target.closest('.btn-resync');
    if (resyncBtn) {
      const id = resyncBtn.getAttribute('data-id');
      window.QFitStore.resyncStudent(id);
      renderActiveSessions();
      return;
    }
  });

  waitlistTbody.addEventListener('click', (e) => {
    const admitBtn = e.target.closest('.btn-admit-waitlist');
    if (admitBtn) {
      const studentId = admitBtn.getAttribute('data-id');
      const promoted = window.QFitStore.promoteFromWaitlist(studentId);
      if (promoted) {
        switchTab('active');
      } else {
        admitBtn.textContent = 'Gym Full (20/20)';
        admitBtn.disabled = true;
        setTimeout(() => {
          renderWaitlist();
        }, 1800);
      }
      return;
    }

    const removeBtn = e.target.closest('.btn-remove-waitlist');
    if (removeBtn) {
      const id = removeBtn.getAttribute('data-id');
      window.QFitStore.removeWaitlistEntry(id);
      renderWaitlist();
    }
  });

  // Filter & Search events
  filterSearch.addEventListener('input', () => renderActiveSessions());
  filterExpiration.addEventListener('change', () => renderActiveSessions());
  sortTimer.addEventListener('change', () => renderActiveSessions());

  // Quick Walk-in Add
  if (btnQuickWalkin) {
    btnQuickWalkin.addEventListener('click', async () => {
      const sampleNames = ['Toni-Ann Smith', 'Daniel Campbell', 'Joshua White', 'Renee Miller', 'Darius Morgan'];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomId = '620' + Math.floor(100000 + Math.random() * 900000);

      window.QFitStore.addStudent({
        fullName: randomName,
        studentId: randomId,
        durationMinutes: 60
      });
    });
  }

  // Reset Demo Data
  btnStaffReset.addEventListener('click', () => {
    window.QFitStore.resetDemoData();
    renderActiveSessions();
    renderWaitlist();
  });

  // 7. Store Subscription
  window.QFitStore.subscribe(() => {
    renderActiveSessions();
    renderWaitlist();
  });

  // Tick interval
  tickInterval = setInterval(updateAllTimers, 1000);

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial load
  renderActiveSessions();
  renderWaitlist();
});
