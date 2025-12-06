import { Injectable } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway(
  {
    cors: {
      origin: '*',
    },
  }
)

export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private gameService: GameService) {}

  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('echo')
  echo(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    client.emit('echo', { received: payload, timestamp: new Date() });
    return { success: true };
  }
 
  @SubscribeMessage('create_game')
  createGame(@ConnectedSocket() client: Socket, @MessageBody() payload:any) {
    try {
      if (!payload) {
        client.emit('error', { message: 'Payload missing' });
        return;
      }

      const { gameState, gameId } = this.gameService.createGame(
        client.id, 
        payload.playerName, 
        payload.avatarUrl,
        payload.password
      );
      
      client.join(gameId);
      client.emit('game_created', gameState);
      client.emit('gameState', gameState);  
      
      this.server.sockets.sockets.forEach((socket) => {
        if (socket.rooms.has(gameId)) {
          socket.emit('gameState', gameState);
        }
      });
      
      return { success: true, gameState };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('join_game')
  joinGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string, playerName: string, avatarUrl: string, password: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.joinGame(
        payload.gameId,
        client.id,
        payload.playerName,
        payload.avatarUrl,
        payload.password
      );
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      client.join(payload.gameId);
      client.emit('game_joined', { gameState });
      
      this.server.sockets.sockets.forEach((socket) => {
        if (socket.rooms.has(payload.gameId)) {
          socket.emit('state_update', gameState);
        }
      });
      
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}
