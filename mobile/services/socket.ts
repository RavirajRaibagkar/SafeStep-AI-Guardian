import io from 'socket.io-client';

/**
 * SOCKET_URL resolution order:
 *  1. EXPO_PUBLIC_SOCKET_URL  — set in .env for production/staging
 *  2. EXPO_PUBLIC_API_URL     — same host as REST API (strips /api suffix)
 *  3. 10.0.2.2:5000           — Android emulator → host machine fallback
 *
 * On a PHYSICAL device running on the same Wi-Fi as the dev machine,
 * set EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:5000/api in mobile/.env
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || '';
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (rawApiUrl ? rawApiUrl.replace(/\/api\/?$/, '') : 'http://10.0.2.2:5000');

let _errorCount = 0;
const MAX_LOGGED_ERRORS = 3; // avoid log spam after repeated failures

class SocketService {
  private socket: any = null;
  private isConnected = false;

  connect() {
    if (this.socket?.connected) return this.socket;

    _errorCount = 0;

    this.socket = io(SOCKET_URL, {
      // polling first is more reliable on physical devices / corporate Wi-Fi;
      // upgrade to websocket happens automatically after handshake succeeds
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,         // 20 s — give physical device time to reach server
      forceNew: false,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      _errorCount = 0;
      console.log('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err: Error) => {
      _errorCount += 1;
      if (_errorCount <= MAX_LOGGED_ERRORS) {
        console.warn(`[Socket] Connection error (${_errorCount}/${MAX_LOGGED_ERRORS}):`, err.message);
      } else if (_errorCount === MAX_LOGGED_ERRORS + 1) {
        console.warn('[Socket] Further connection errors suppressed. Check EXPO_PUBLIC_API_URL in mobile/.env');
      }
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }

  joinCase(caseId: string) {
    if (!this.socket) this.connect();
    this.socket?.emit('join_case', { case_id: caseId });
  }

  leaveCase(caseId: string) {
    this.socket?.emit('leave_case', { case_id: caseId });
  }

  /**
   * F03: Emit live location every 3 seconds during SOS.
   * Silently drops if not connected (REST fallback handles persistence).
   */
  emitLocation(caseId: string, lat: number, lng: number, battery?: number) {
    if (!this.socket?.connected) return; // silent — REST endpoint is the source of truth
    this.socket.emit('location_update', {
      case_id: caseId,
      lat,
      lng,
      battery: battery ?? 100,
      timestamp: new Date().toISOString(),
    });
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.socket) this.connect();
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (data: any) => void) {
    this.socket?.off(event, callback);
  }

  get connected() {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
