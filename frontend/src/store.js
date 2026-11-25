/**
 * QFIT shared state client.
 * The API is authoritative; this in-memory cache keeps existing views synchronous
 * while polling and mutations refresh it from the server.
 */

const DEFAULT_SETTINGS = {
  maxCapacity: 20,
  defaultDurationMin: 60,
  manualQrDeactivated: false
};

function toTimestamp(value) {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeStudent(student, isWaitlistEntry = false) {
  if (!student || typeof student !== 'object') {
    throw new Error('The API returned an invalid student record.');
  }

  const normalized = {
    ...student,
    studentId: student.studentId ?? student.student_id,
    fullName: student.fullName ?? student.full_name,
    joinedAt: toTimestamp(student.joinedAt ?? student.joined_at),
    addedAt: toTimestamp(student.addedAt ?? student.added_at),
    durationMinutes: student.durationMinutes ?? student.duration_minutes ?? 60,
    notify5MinBefore: student.notify5MinBefore ?? student.notify_5_min_before ?? false,
    syncFailed: student.syncFailed ?? student.sync_failed ?? false
  };
  normalized.id = normalized.id || normalized.studentId;

  const timestamp = isWaitlistEntry ? normalized.addedAt : normalized.joinedAt;
  if (!normalized.studentId || !normalized.fullName || !timestamp) {
    throw new Error('The API student record is missing its ID, name, or entry timestamp.');
  }
  return normalized;
}

function getItems(response, collectionName) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response[collectionName])) return response[collectionName];
  if (response && Array.isArray(response.items)) return response.items;
  throw new Error(`The API response did not contain a ${collectionName} list.`);
}

class QFitStore {
  constructor() {
    this.listeners = [];
    this.queue = null;
    this.waitlist = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.capacity = null;
    this.simulateQueueFailure = false;
    this.ready = this.refresh();

    this.pollTimer = setInterval(() => {
      this.refresh().catch(error => console.error('QFit API refresh failed:', error));
    }, window.QFitApi.config.pollIntervalMs);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(callback => {
      const result = callback(data);
      if (result && typeof result.catch === 'function') {
        result.catch(error => console.error('QFit store listener failed:', error));
      }
    });
  }

  async refresh() {
    const [queueResponse, waitlistResponse, capacityResponse] = await Promise.all([
      window.QFitApi.request('queue'),
      window.QFitApi.request('waitlist'),
      window.QFitApi.request('status')
    ]);

    if (!capacityResponse || typeof capacityResponse !== 'object') {
      throw new Error('The API did not return gym capacity status.');
    }

    const nextQueue = getItems(queueResponse, 'queue').map(student => normalizeStudent(student));
    const nextWaitlist = getItems(waitlistResponse, 'waitlist').map(student => normalizeStudent(student, true));
    const previousQueue = this.queue;
    const previousWaitlist = this.waitlist;

    this.queue = nextQueue;
    this.waitlist = nextWaitlist;
    this.capacity = capacityResponse;
    const serverSettings = capacityResponse.settings || {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...serverSettings,
      maxCapacity: capacityResponse.maxCapacity ?? capacityResponse.max_capacity ??
        serverSettings.maxCapacity ?? serverSettings.max_capacity ?? DEFAULT_SETTINGS.maxCapacity,
      defaultDurationMin: capacityResponse.defaultDurationMin ?? capacityResponse.default_duration_min ??
        serverSettings.defaultDurationMin ?? serverSettings.default_duration_min ?? DEFAULT_SETTINGS.defaultDurationMin,
      manualQrDeactivated: capacityResponse.manualQrDeactivated ?? capacityResponse.manual_qr_deactivated ??
        serverSettings.manualQrDeactivated ?? serverSettings.manual_qr_deactivated ?? false
    };

    if (previousQueue && previousWaitlist) {
      const currentQueueIds = new Set(nextQueue.map(student => student.id || student.studentId));
      const previousQueueIds = new Set(previousQueue.map(student => student.id || student.studentId));
      const removedStudents = previousQueue.filter(student =>
        !currentQueueIds.has(student.id || student.studentId)
      );
      const addedStudents = nextQueue.filter(student =>
        !previousQueueIds.has(student.id || student.studentId)
      );
      const currentStudentIds = new Set(nextQueue.map(student => student.studentId));

      addedStudents.forEach(student => {
        this.notifyListeners({ type: 'STUDENT_ADDED', payload: student });
      });

      removedStudents.forEach(student => {
        this.notifyListeners({ type: 'STUDENT_REMOVED', payload: student });
      });

      previousWaitlist
        .filter(student => currentStudentIds.has(student.studentId))
        .forEach(student => {
          const promotedStudent = nextQueue.find(active => active.studentId === student.studentId);
          this.notifyListeners({ type: 'WAITLIST_PROMOTED', payload: { student: promotedStudent } });
        });

      if (removedStudents.length > 0) {
        this.notifyListeners({ type: 'SLOT_AVAILABLE', payload: { nextStudent: nextWaitlist[0] } });
      }

      if (JSON.stringify(previousWaitlist) !== JSON.stringify(nextWaitlist)) {
        this.notifyListeners({ type: 'WAITLIST_UPDATED', payload: nextWaitlist });
      }
    }

    this.notifyListeners({ type: 'API_UPDATED' });
    return this;
  }

  getSettings() {
    return { ...this.settings };
  }

  async updateSettings(partial) {
    await window.QFitApi.request('settings', { method: 'PUT', body: partial });
    await this.refresh();
    return this.getSettings();
  }

  setMaxCapacity(limit) {
    return this.updateSettings({ maxCapacity: parseInt(limit, 10) || DEFAULT_SETTINGS.maxCapacity });
  }

  toggleManualQrDeactivation(forceDeactivated) {
    const next = forceDeactivated !== undefined ? forceDeactivated : !this.settings.manualQrDeactivated;
    return this.updateSettings({ manualQrDeactivated: next });
  }

  getCapacityStatus() {
    const currentCount = this.queue ? this.queue.length : 0;
    const maxCapacity = this.settings.maxCapacity;
    const isFull = this.capacity?.isFull ?? this.capacity?.is_full ?? currentCount >= maxCapacity;
    const manualDeactivated = this.settings.manualQrDeactivated;

    return {
      currentCount: this.capacity?.currentCount ?? this.capacity?.current_count ?? currentCount,
      maxCapacity,
      waitlistCount: this.waitlist ? this.waitlist.length : 0,
      isFull: Boolean(isFull),
      isQrActive: (this.capacity?.qrActive ?? this.capacity?.qr_active ?? (!manualDeactivated && !isFull)) && !manualDeactivated,
      manualDeactivated,
      remainingSlots: Math.max(0, maxCapacity - currentCount)
    };
  }

  getQueue() {
    return [...(this.queue || [])].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  getWaitlist() {
    return [...(this.waitlist || [])].sort((a, b) => a.addedAt - b.addedAt);
  }

  async addStudent(studentData) {
    if (this.shouldSimulateQueueFailure()) {
      return {
        success: false,
        error: 'SYSTEM_FAIL',
        message: 'System failed to add student to queue. Please rescan the QR code.'
      };
    }

    const result = await window.QFitApi.request('checkIn', {
      method: 'POST',
      body: studentData
    });
    await this.refresh();
    if (result?.success === false) return result;
    if (!result?.student || !['active', 'waitlist'].includes(result.status)) {
      throw new Error('The API check-in response did not include a valid student and queue status.');
    }
    return {
      ...result,
      student: normalizeStudent(result.student, result.status === 'waitlist')
    };
  }

  async promoteFromWaitlist(studentId) {
    const response = await window.QFitApi.request('promote', {
      method: 'POST',
      pathParams: { studentId }
    });
    await this.refresh();
    if (response?.success === false) return false;
    if (!response?.student) {
      throw new Error('The API promotion response did not include the promoted student.');
    }
    return normalizeStudent(response.student);
  }

  async getCheckoutNotices(studentId) {
    return window.QFitApi.request('checkoutNotice', { pathParams: { studentId } });
  }

  async consumeCheckoutNotice(studentId) {
    const notice = await this.getCheckoutNotices(studentId);
    if (notice) {
      await window.QFitApi.request('checkoutNotice', {
        method: 'DELETE',
        pathParams: { studentId }
      });
    }
    return notice;
  }

  async removeStudent(idOrStudentId, options = {}) {
    const student = this.getQueue().find(item =>
      item.id === idOrStudentId || item.studentId === idOrStudentId
    );
    if (!student) return false;

    const response = await window.QFitApi.request('checkout', {
      method: 'POST',
      pathParams: { studentId: student.studentId },
      body: { removedBy: options.removedBy || 'self' }
    });
    await this.refresh();
    return response?.success !== false;
  }

  async removeWaitlistEntry(idOrStudentId) {
    const entry = this.getWaitlist().find(item =>
      item.id === idOrStudentId || item.studentId === idOrStudentId
    );
    if (!entry) return false;

    await window.QFitApi.request('removeWaitlist', {
      method: 'DELETE',
      pathParams: { studentId: entry.studentId }
    });
    await this.refresh();
    return true;
  }

  async updateWaitlistNotification(studentId, notify5MinBefore) {
    const result = await window.QFitApi.request('updateWaitlist', {
      method: 'PATCH',
      pathParams: { studentId },
      body: { notify5MinBefore: Boolean(notify5MinBefore) }
    });
    await this.refresh();
    return result;
  }

  async toggleStudentSyncStatus(idOrStudentId, forceSyncFailed) {
    const student = this.getQueue().find(item =>
      item.id === idOrStudentId || item.studentId === idOrStudentId
    );
    if (!student) return false;

    const syncFailed = forceSyncFailed !== undefined ? forceSyncFailed : !student.syncFailed;
    const result = await window.QFitApi.request('resync', {
      method: 'PATCH',
      pathParams: { studentId: student.studentId },
      body: { syncFailed }
    });
    await this.refresh();
    return result;
  }

  resyncStudent(idOrStudentId) {
    return this.toggleStudentSyncStatus(idOrStudentId, false);
  }

  setSimulateQueueFailure(shouldFail) {
    this.simulateQueueFailure = Boolean(shouldFail);
  }

  shouldSimulateQueueFailure() {
    return this.simulateQueueFailure;
  }

  async resetDemoData() {
    await window.QFitApi.request('reset', { method: 'POST' });
    await this.refresh();
    this.notifyListeners({ type: 'DEMO_RESET' });
  }
}

window.QFitStore = new QFitStore();
