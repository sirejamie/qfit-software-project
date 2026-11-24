/**
 * QFIT Shared State & Broadcast Store
 * Handles 20-student capacity, active queue, waitlist, timer synchronization,
 * and real-time cross-tab updates via BroadcastChannel.
 */

const STORAGE_KEYS = {
  QUEUE: 'qfit_v4_students_queue',
  WAITLIST: 'qfit_v4_students_waitlist',
  SETTINGS: 'qfit_v4_gym_settings',
  USERS: 'qfit_v4_registered_users',
  SIM_FAIL: 'qfit_v4_simulate_queue_fail',
  CHECKOUT_NOTICES: 'qfit_v4_checkout_notices'
};

const DEFAULT_SETTINGS = {
  maxCapacity: 20,       // Gym capacity is 20 students
  defaultDurationMin: 60, // Standard 60-minute session
  manualQrDeactivated: false
};

// 19 Initial Students ALREADY inside the gym (leaving 1 spot free for Student 1, then Student 2 hits Waitlist)
// Note: Neither Alaena Sang (620123456) nor Tajae Jacobs (620198765) are in this initial list!
function generateInitial19Students() {
  const now = Date.now();
  return [
    {
      id: 'qfit-01',
      studentId: '620011223',
      fullName: 'Marcus Sterling',
      joinedAt: now - (63 * 60 * 1000), // Expired by 3 mins (Tests expired highlight)
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-02',
      studentId: '620022334',
      fullName: 'Kevon Campbell',
      joinedAt: now - (57 * 60 * 1000), // 3 mins remaining (Expiring soon)
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-03',
      studentId: '620033445',
      fullName: 'Brittany Watson',
      joinedAt: now - (48 * 60 * 1000), // 12 mins remaining
      durationMinutes: 60,
      syncFailed: true // Out of sync (Tests staff resync feature)
    },
    {
      id: 'qfit-04',
      studentId: '620044556',
      fullName: 'Taj Robinson',
      joinedAt: now - (45 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-05',
      studentId: '620055667',
      fullName: 'Shanice Edwards',
      joinedAt: now - (41 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-06',
      studentId: '620066778',
      fullName: 'Dwayne Clarke',
      joinedAt: now - (38 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-07',
      studentId: '620077889',
      fullName: 'Jada Powell',
      joinedAt: now - (35 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-08',
      studentId: '620088990',
      fullName: 'Tariq Anderson',
      joinedAt: now - (32 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-09',
      studentId: '620099001',
      fullName: 'Gabrielle Forbes',
      joinedAt: now - (29 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-10',
      studentId: '620100112',
      fullName: 'Romaine Blake',
      joinedAt: now - (26 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-11',
      studentId: '620111223',
      fullName: 'Chloe Barrett',
      joinedAt: now - (22 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-12',
      studentId: '620122334',
      fullName: 'Alwyn Brown',
      joinedAt: now - (19 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-13',
      studentId: '620133445',
      fullName: 'Siddiq Morgan',
      joinedAt: now - (16 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-14',
      studentId: '620144556',
      fullName: 'Rochelle Grant',
      joinedAt: now - (13 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-15',
      studentId: '620155667',
      fullName: 'Malik Thompson',
      joinedAt: now - (10 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-16',
      studentId: '620166778',
      fullName: 'Kimberly Russell',
      joinedAt: now - (7 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-17',
      studentId: '620177889',
      fullName: 'Jamie Gattie',
      joinedAt: now - (5 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-18',
      studentId: '620188001',
      fullName: 'Toni-Ann Smith',
      joinedAt: now - (3 * 60 * 1000),
      durationMinutes: 60,
      syncFailed: false
    },
    {
      id: 'qfit-19',
      studentId: '620199002',
      fullName: 'Daniel Campbell',
      joinedAt: now - (1 * 60 * 1000), // Just entered 1 min ago
      durationMinutes: 60,
      syncFailed: false
    }
  ];
}

const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qfit_v4_channel') : null;

class QFitStore {
  constructor() {
    this.listeners = [];
    this.cleanupLegacyStorage();
    this.initStorage();

    if (broadcast) {
      broadcast.onmessage = (event) => {
        this.notifyListeners(event.data);
      };
    }

    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        this.notifyListeners({ type: 'STORAGE_UPDATED', key: e.key });
      }
    });
  }

  cleanupLegacyStorage() {
    // Purge any outdated test data keys from earlier turns
    const legacyKeys = [
      'qfit_students_queue',
      'qfit_students_waitlist',
      'qfit_gym_settings',
      'qfit_active_student_id',
      'qfit_v3_students_queue',
      'qfit_v3_students_waitlist',
      'qfit_v3_gym_settings',
      'qfit_v3_registered_users',
      'qfit_v3_simulate_queue_fail',
      'qfit_v3_checkout_notices'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
  }

  initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(generateInitial19Students()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WAITLIST)) {
      localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify([]));
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(cb => cb(data));
  }

  broadcastChange(type, payload = {}) {
    const message = { type, payload, timestamp: Date.now() };
    if (broadcast) {
      broadcast.postMessage(message);
    }
    this.notifyListeners(message);
  }

  // Settings & Capacity
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  updateSettings(partial) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    this.broadcastChange('SETTINGS_UPDATED', updated);
    return updated;
  }

  setMaxCapacity(limit) {
    return this.updateSettings({ maxCapacity: parseInt(limit, 10) || 20 });
  }

  toggleManualQrDeactivation(forceDeactivated) {
    const current = this.getSettings();
    const newState = forceDeactivated !== undefined ? forceDeactivated : !current.manualQrDeactivated;
    return this.updateSettings({ manualQrDeactivated: newState });
  }

  getCapacityStatus() {
    const queue = this.getQueue();
    const waitlist = this.getWaitlist();
    const settings = this.getSettings();
    const currentCount = queue.length;
    const maxCapacity = settings.maxCapacity;
    const isFull = currentCount >= maxCapacity;
    const isQrActive = !settings.manualQrDeactivated && !isFull;

    return {
      currentCount,
      maxCapacity,
      waitlistCount: waitlist.length,
      isFull,
      isQrActive,
      manualDeactivated: settings.manualQrDeactivated,
      remainingSlots: Math.max(0, maxCapacity - currentCount)
    };
  }

  // Active Queue
  getQueue() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [];
      return list.sort((a, b) => a.joinedAt - b.joinedAt);
    } catch {
      return [];
    }
  }

  // Waitlist
  getWaitlist() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.WAITLIST)) || [];
      return list.sort((a, b) => a.addedAt - b.addedAt);
    } catch {
      return [];
    }
  }

  /**
   * Add student to gym queue or waitlist if full
   */
  addStudent(studentData) {
    if (this.shouldSimulateQueueFailure()) {
      return {
        success: false,
        error: 'SYSTEM_FAIL',
        message: 'System failed to add student to queue. Please rescan the QR code.'
      };
    }

    const queue = this.getQueue();
    const waitlist = this.getWaitlist();
    const capacity = this.getCapacityStatus();

    // Check if already in active queue
    const inQueue = queue.find(s => s.studentId === studentData.studentId);
    if (inQueue) {
      return {
        success: true,
        alreadyActive: true,
        student: inQueue,
        status: 'active'
      };
    }

    // Check if already in waitlist
    const inWaitlist = waitlist.find(s => s.studentId === studentData.studentId);
    if (inWaitlist) {
      const position = waitlist.findIndex(s => s.studentId === studentData.studentId) + 1;
      return {
        success: true,
        alreadyWaitlisted: true,
        student: inWaitlist,
        status: 'waitlist',
        position: position,
        peopleAhead: position - 1
      };
    }

    // If capacity reached (>= 20), add to WAITLIST
    if (capacity.isFull) {
      const waitlistEntry = {
        id: 'wait-' + Date.now(),
        studentId: studentData.studentId.trim(),
        fullName: studentData.fullName.trim(),
        addedAt: Date.now(),
        notify5MinBefore: studentData.notify5MinBefore || false,
        durationMinutes: studentData.durationMinutes || 60
      };

      waitlist.push(waitlistEntry);
      localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));
      this.broadcastChange('WAITLIST_UPDATED', waitlistEntry);

      return {
        success: true,
        status: 'waitlist',
        student: waitlistEntry,
        position: waitlist.length,
        peopleAhead: waitlist.length - 1,
        message: 'The gym is currently at full capacity (20/20). You have been added to the waitlist.'
      };
    }

    // Otherwise, add to ACTIVE QUEUE
    const newStudent = {
      id: 'qfit-' + Date.now(),
      studentId: studentData.studentId.trim(),
      fullName: studentData.fullName.trim(),
      joinedAt: Date.now(),
      durationMinutes: studentData.durationMinutes || this.getSettings().defaultDurationMin,
      syncFailed: false
    };

    queue.push(newStudent);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    this.broadcastChange('STUDENT_ADDED', newStudent);

    return {
      success: true,
      status: 'active',
      student: newStudent
    };
  }

  promoteFromWaitlist(studentId) {
    let waitlist = this.getWaitlist();
    const student = waitlist.find(s => s.studentId === studentId || s.id === studentId);
    if (!student) return false;

    const capacity = this.getCapacityStatus();
    if (capacity.isFull) return false;

    waitlist = waitlist.filter(s => s.id !== student.id);
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));

    const activeStudent = {
      id: 'qfit-' + Date.now(),
      studentId: student.studentId,
      fullName: student.fullName,
      joinedAt: Date.now(),
      durationMinutes: student.durationMinutes || 60,
      syncFailed: false
    };

    const queue = this.getQueue();
    queue.push(activeStudent);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));

    this.broadcastChange('WAITLIST_PROMOTED', { student: activeStudent });
    return activeStudent;
  }

  getCheckoutNotices() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CHECKOUT_NOTICES)) || {};
    } catch {
      return {};
    }
  }

  setCheckoutNotice(studentId, message) {
    if (!studentId) return;
    const notices = this.getCheckoutNotices();
    notices[studentId] = { message, at: Date.now() };
    localStorage.setItem(STORAGE_KEYS.CHECKOUT_NOTICES, JSON.stringify(notices));
  }

  consumeCheckoutNotice(studentId) {
    if (!studentId) return null;
    const notices = this.getCheckoutNotices();
    const notice = notices[studentId] || null;
    if (notice) {
      delete notices[studentId];
      localStorage.setItem(STORAGE_KEYS.CHECKOUT_NOTICES, JSON.stringify(notices));
    }
    return notice;
  }

  removeStudent(idOrStudentId, options = {}) {
    let queue = this.getQueue();
    const student = queue.find(s => s.id === idOrStudentId || s.studentId === idOrStudentId);
    if (!student) return false;

    queue = queue.filter(s => s.id !== student.id);
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));

    if (options.removedBy === 'staff') {
      this.setCheckoutNotice(student.studentId, 'You have been removed from the queue.');
    }

    this.broadcastChange('STUDENT_REMOVED', {
      ...student,
      removedBy: options.removedBy || 'self'
    });

    const waitlist = this.getWaitlist();
    if (waitlist.length > 0) {
      this.broadcastChange('SLOT_AVAILABLE', { nextStudent: waitlist[0] });
    }

    return true;
  }

  removeWaitlistEntry(idOrStudentId) {
    let waitlist = this.getWaitlist();
    waitlist = waitlist.filter(s => s.id !== idOrStudentId && s.studentId !== idOrStudentId);
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));
    this.broadcastChange('WAITLIST_UPDATED');
    return true;
  }

  updateWaitlistNotification(studentId, notify5MinBefore) {
    const waitlist = this.getWaitlist();
    const entry = waitlist.find(s => s.studentId === studentId || s.id === studentId);
    if (!entry) return false;

    entry.notify5MinBefore = Boolean(notify5MinBefore);
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));
    this.broadcastChange('WAITLIST_UPDATED', entry);
    return entry;
  }

  toggleStudentSyncStatus(idOrStudentId, forceSyncFailed) {
    const queue = this.getQueue();
    const student = queue.find(s => s.id === idOrStudentId || s.studentId === idOrStudentId);
    if (!student) return false;

    student.syncFailed = forceSyncFailed !== undefined ? forceSyncFailed : !student.syncFailed;
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    this.broadcastChange('STUDENT_SYNC_TOGGLED', student);
    return student;
  }

  resyncStudent(idOrStudentId) {
    return this.toggleStudentSyncStatus(idOrStudentId, false);
  }

  setSimulateQueueFailure(shouldFail) {
    localStorage.setItem(STORAGE_KEYS.SIM_FAIL, shouldFail ? 'true' : 'false');
    this.broadcastChange('SIM_SETTINGS_CHANGED', { simulateFail: shouldFail });
  }

  shouldSimulateQueueFailure() {
    return localStorage.getItem(STORAGE_KEYS.SIM_FAIL) === 'true';
  }

  resetDemoData() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(generateInitial19Students()));
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEYS.SIM_FAIL);
    localStorage.removeItem(STORAGE_KEYS.CHECKOUT_NOTICES);
    this.broadcastChange('DEMO_RESET');
  }
}

window.QFitStore = new QFitStore();
