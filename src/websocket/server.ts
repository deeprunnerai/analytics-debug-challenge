import { WebSocketServer, WebSocket } from 'ws';
import { ProcessedEvent, WebSocketMessage } from '../types';

const WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);

export class EventStreamServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private messageBuffer: ProcessedEvent[] = [];
  private bufferSize = 1000;

  constructor() {
    this.wss = new WebSocketServer({ port: WS_PORT });
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`Client connected. Total clients: ${this.clients.size}`);

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`Client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      this.sendRecentEvents(ws);
    });

    console.log(`WebSocket server listening on port ${WS_PORT}`);
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'subscribe') {
        console.log('Client subscribed to event stream');
      } else if (message.type === 'ping') {
        this.send(ws, { type: 'stats', payload: { clients: this.clients.size } });
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }

  private sendRecentEvents(ws: WebSocket): void {
    const recent = this.messageBuffer.slice(-50);
    recent.forEach(event => {
      this.send(ws, { type: 'event', payload: event });
    });
  }

  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(event: ProcessedEvent): void {
    this.messageBuffer.push(event);
    if (this.messageBuffer.length > this.bufferSize) {
      this.messageBuffer.shift();
    }

    const message: WebSocketMessage = { type: 'event', payload: event };
    const data = JSON.stringify(message);

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
    console.log('WebSocket server closed');
  }
}
