import { WebSocket, Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { Notification } from '../repositories/NotificationRepository';

type WebSocketClient = WebSocket & {
  walletAddress?: string;
  isAlive?: boolean;
}

interface AuthenticatedMessage {
  token: string;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>>;
  private heartbeatInterval: NodeJS.Timeout | null;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.initialize();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocketClient, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start heartbeat to detect broken connections
    this.startHeartbeat();

    logger.info('WebSocket manager initialized');
  }

  private handleConnection(ws: WebSocketClient, _request: IncomingMessage): void {
    ws.isAlive = true;

    logger.info('New WebSocket connection established');

    // Ping/pong for connection health
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      payload: { message: 'Connected to notification server' }
    });
  }

  private async handleMessage(ws: WebSocketClient, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message.payload);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleAuthentication(ws: WebSocketClient, payload: AuthenticatedMessage): Promise<void> {
    try {
      const { token } = payload;

      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        this.sendError(ws, 'Server configuration error');
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as { address?: string; walletAddress?: string };
      const walletAddress = (decoded.address || decoded.walletAddress)?.toLowerCase();

      if (!walletAddress) {
        this.sendError(ws, 'Invalid token: wallet address not found');
        ws.close();
        return;
      }

      // Associate wallet address with this connection
      ws.walletAddress = walletAddress;

      // Add to clients map
      if (!this.clients.has(walletAddress)) {
        this.clients.set(walletAddress, new Set());
      }
      this.clients.get(walletAddress)!.add(ws);

      logger.info(`WebSocket authenticated for wallet: ${walletAddress}`);

      // Send authentication success
      this.send(ws, {
        type: 'authenticated',
        payload: { walletAddress }
      });
    } catch (error: any) {
      logger.error('WebSocket authentication error:', error);
      this.sendError(ws, 'Authentication failed');
      ws.close();
    }
  }

  private handleDisconnection(ws: WebSocketClient): void {
    if (ws.walletAddress) {
      const addressClients = this.clients.get(ws.walletAddress);
      if (addressClients) {
        addressClients.delete(ws);
        if (addressClients.size === 0) {
          this.clients.delete(ws.walletAddress);
        }
      }
      logger.info(`WebSocket disconnected for wallet: ${ws.walletAddress}`);
    } else {
      logger.info('Unauthenticated WebSocket disconnected');
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as WebSocketClient;
        if (client.isAlive === false) {
          logger.info('Terminating inactive WebSocket connection');
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds
  }

  public sendNotificationToUser(walletAddress: string, notification: Notification): void {
    const normalizedAddress = walletAddress.toLowerCase();
    const addressClients = this.clients.get(normalizedAddress);

    if (!addressClients || addressClients.size === 0) {
      logger.debug(`No active WebSocket connections for wallet: ${normalizedAddress}`);
      return;
    }

    const message = {
      type: 'notification',
      payload: notification
    };

    addressClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client, message);
      }
    });

    logger.info(`Notification sent via WebSocket to ${normalizedAddress}`);
  }

  public broadcastToAll(message: WebSocketMessage): void {
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client as WebSocketClient, message);
      }
    });
  }

  private send(ws: WebSocketClient, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
    }
  }

  private sendError(ws: WebSocketClient, error: string): void {
    this.send(ws, {
      type: 'error',
      payload: { error }
    });
  }

  public getConnectedClients(): number {
    return this.wss.clients.size;
  }

  public getAuthenticatedUsers(): number {
    return this.clients.size;
  }

  public isUserConnected(walletAddress: string): boolean {
    const normalizedAddress = walletAddress.toLowerCase();
    const addressClients = this.clients.get(normalizedAddress);
    return addressClients ? addressClients.size > 0 : false;
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.wss.clients.forEach((client) => {
      client.close();
    });

    this.wss.close();
    logger.info('WebSocket manager closed');
  }
}
