import { Injectable } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway(
  {
    cors: {
      origin: '*',
    },
    maxHttpBufferSize: 50 * 1024 * 1024,
  }
)

export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private gameService: GameService) {}

  private formatGameStateForClients(gameState: any): any {
    if (!gameState) return gameState;

    return {
      ...gameState,
      players: gameState.players?.filter(p => p.isActive) || [],
      package: {
        categories: gameState.package?.categories?.map(category => ({
          title: category.title,
          questions: category.questions?.map(q => ({
            points: q.points
          })) || []
        })) || []
      }
    };
  }

  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const disconnectedGame = this.gameService.handleDisconnect(client.id);
    
    if (disconnectedGame) {
      this.server.to(disconnectedGame.roomId).emit('state_update', this.formatGameStateForClients(disconnectedGame));
    }
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
      this.server.to(gameId).emit('state_update', this.formatGameStateForClients(gameState));
      
      return { success: true, gameState };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }



  @SubscribeMessage('join_game')
  joinGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { 
    gameId: string, playerName: string, avatarUrl: string, password: string 
  }) {
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
      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('select_question')
  selectQuestion(@ConnectedSocket() client: Socket, @MessageBody() payload: {
    gameId: string, categoryIndex: number, questionIndex: number 
  }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }
      const gameState = this.gameService.selectQuestion(
        payload.gameId,
        payload.categoryIndex,
        payload.questionIndex,
      );
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }
      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true, gameState };
    } catch (error) {
      client.emit('error', { message: error.message });
    } 
  }
  

  @SubscribeMessage('load_package')
  loadPackage(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string, package: any[] }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }
      const gameState = this.gameService.loadPackage(payload.gameId, payload.package);

      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }
      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true, gameState };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('start_game')
  startGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.startGame(payload.gameId);
      
      if (!gameState) {
        client.emit('error', { message: 'Cannot start game' });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('activate_question')
  activateQuestion(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.activateQuestion(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('buzz_in')
  buzzIn(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.buzzIn(payload.gameId, client.id);
      
      if (!gameState) {
        client.emit('error', { message: 'Cannot buzz in' });
        return;
      }
      
      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('wrong_answer')
  wrongAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      this.gameService.minusScore(payload.gameId);
      const gameState = this.gameService.wrongAnswer(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('correct_answer')
  correctAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.addScore(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('skip_question')
  skipQuestion(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.skipQuestion(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('clear_queue')
  clearQueue(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.clearQuestion(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('next_question')
  nextQuestion(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
    try {
      if (!payload || !payload.gameId) {
        client.emit('error', { message: 'gameId required' });
        return;
      }

      const gameState = this.gameService.nextSelector(payload.gameId);
      
      if (!gameState) {
        client.emit('game_not_found', { gameId: payload.gameId });
        return;
      }

      this.server.to(payload.gameId).emit('state_update', this.formatGameStateForClients(gameState));
      return { success: true };
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }
}
