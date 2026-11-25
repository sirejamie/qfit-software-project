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

function normalizeUser(user, isWaitlistEntry = false) {
  console.log(user);

  if (!user || typeof user !== 'object') {
    throw new Error('The API returned an invalid user record.');
  }

  const normalized = {
    userId: user.userId ?? user.user_id,
    fullName: user.fullName ?? user.full_name,
    joinedAt: toTimestamp(user.joinedAt ?? user.joined_at),
    addedAt: toTimestamp(user.addedAt ?? user.added_at),
    durationMinutes: user.durationMinutes ?? user.duration_minutes ?? 60,
    notify5MinBefore: user.notify5MinBefore ?? user.notify_5_min_before ?? false,
    syncFailed: user.syncFailed ?? user.sync_failed ?? false
  };
  normalized.id = normalized.id || normalized.userId;

  const timestamp = isWaitlistEntry ? normalized.addedAt : normalized.joinedAt;

  if (!normalized.userId || !normalized.fullName || !timestamp) {
    throw new Error('The API user record is missing its ID, name, or entry timestamp.');
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

    const nextQueue = getItems(queueResponse, 'queue').map(user => normalizeUser(user));
    const nextWaitlist = getItems(waitlistResponse, 'waitlist').map(user => normalizeUser(user, true));
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
      const currentQueueIds = new Set(nextQueue.map(user => user.id || user.userId));
      const previousQueueIds = new Set(previousQueue.map(user => user.id || user.userId));
      const removedUsers = previousQueue.filter(user =>
        !currentQueueIds.has(user.id || user.userId)
      );
      const addedUsers = nextQueue.filter(user =>
        !previousQueueIds.has(user.id || user.userId)
      );
      const currentUserIds = new Set(nextQueue.map(user => user.userId));

      addedUsers.forEach(user => {
        this.notifyListeners({ type: 'USER_ADDED', payload: user });
      });

      removedUsers.forEach(user => {
        this.notifyListeners({ type: 'USER_REMOVED', payload: user });
      });

      previousWaitlist
        .filter(user => currentUserIds.has(user.userId))
        .forEach(user => {
          const promotedUser = nextQueue.find(active => active.userId === user.userId);
          this.notifyListeners({ type: 'WAITLIST_PROMOTED', payload: { user: promotedUser } });
        });

      if (removedUsers.length > 0) {
        this.notifyListeners({ type: 'SLOT_AVAILABLE', payload: { nextUser: nextWaitlist[0] } });
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

  async addUser(userData) {
    if (this.shouldSimulateQueueFailure()) {
      return {
        success: false,
        error: 'SYSTEM_FAIL',
        message: 'System failed to add user to queue. Please rescan the QR code.'
      };
    }

    const result = await window.QFitApi.request('checkIn', {
      method: 'POST',
      body: userData
    });

    await this.refresh();
    if (result?.success === false) return result;
    if (!result?.user || !['active', 'waitlist'].includes(result.status)) {
      throw new Error('The API check-in response did not include a valid user and queue status.');
    }

    console.log(normalizeUser(result.user))
    return {
      ...result,
      user: normalizeUser(result.user, result.status === 'waitlist')
    };
  }

  async promoteFromWaitlist(userId) {
    const response = await window.QFitApi.request('promote', {
      method: 'POST',
      pathParams: { userId }
    });
    await this.refresh();
    if (response?.success === false) return false;
    if (!response?.user) {
      throw new Error('The API promotion response did not include the promoted user.');
    }
    return normalizeUser(response.user);
  }

  async getCheckoutNotices(userId) {
    return window.QFitApi.request('checkoutNotice', { pathParams: { userId } });
  }

  async consumeCheckoutNotice(userId) {
    const notice = await this.getCheckoutNotices(userId);
    if (notice) {
      await window.QFitApi.request('checkoutNotice', {
        method: 'DELETE',
        pathParams: { userId }
      });
    }
    return notice;
  }

  async removeUser(idOrUserId, options = {}) {
    const user = this.getQueue().find(item =>
      item.id === idOrUserId || item.userId === idOrUserId
    );
    if (!user) return false;

    const response = await window.QFitApi.request('checkout', {
      method: 'POST',
      pathParams: { userId: user.userId },
      body: { removedBy: options.removedBy || 'self' }
    });
    await this.refresh();
    return response?.success !== false;
  }

  async removeWaitlistEntry(idOrUserId) {
    const entry = this.getWaitlist().find(item =>
      item.id === idOrUserId || item.userId === idOrUserId
    );
    if (!entry) return false;

    await window.QFitApi.request('removeWaitlist', {
      method: 'DELETE',
      pathParams: { userId: entry.userId }
    });
    await this.refresh();
    return true;
  }

  async updateWaitlistNotification(userId, notify5MinBefore) {
    const result = await window.QFitApi.request('updateWaitlist', {
      method: 'PATCH',
      pathParams: { userId },
      body: { notify5MinBefore: Boolean(notify5MinBefore) }
    });
    await this.refresh();
    return result;
  }

  async toggleUserSyncStatus(idOrUserId, forceSyncFailed) {
    const user = this.getQueue().find(item =>
      item.id === idOrUserId || item.userId === idOrUserId
    );
    if (!user) return false;

    const syncFailed = forceSyncFailed !== undefined ? forceSyncFailed : !user.syncFailed;
    const result = await window.QFitApi.request('resync', {
      method: 'PATCH',
      pathParams: { userId: user.userId },
      body: { syncFailed }
    });
    await this.refresh();
    return result;
  }

  resyncUser(idOrUserId) {
    return this.toggleUserSyncStatus(idOrUserId, false);
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
