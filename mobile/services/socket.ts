import io from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://10.0.2.2:5000';

class SocketService {
  private socket: any = null;
  private isConnected = false;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err: Error) => {
      console.warn('[Socket] Connection error:', err.message);
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
   * F03: Emit live location update every 3 seconds during SOS
   */
  emitLocation(caseId: string, lat: number, lng: number, battery?: number) {
    if (!this.socket?.connected) {
      console.warn('[Socket] Not connected — location update dropped');
      return;
    }
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
