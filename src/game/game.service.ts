import { Injectable } from '@nestjs/common';
import GameState from './interfaces/game-state.interface';
import Player from './interfaces/player.interface';
import { v4 as uuid } from 'uuid';

@Injectable()
export class GameService {
    private games: Map<string, GameState> = new Map();
    private players = new Map<string, Player>();

    createGame(playerId: string, playerName: string, avatarUrl: string, password: string): { gameState: GameState, gameId: string } {
        const roomId = uuid();
        const newPlayer: Player = {
            id: playerId,
            name: playerName,
            avatarUrl,
            score: 0,
            isReady: false,
            isHost: true,
        }
        const newGame: GameState = {
            roomId,
            status: 'LOBBY',
            players: [newPlayer],
            password: password
        };

        this.games.set(roomId, newGame);
        console.log("GAME created:", this.games);
        this.players.set(playerId, newPlayer);
        console.log("GAMES:", this.games);
        return { gameState: newGame, gameId: roomId };
    }

    joinGame(gameId: string, playerId: string, playerName: string, avatarUrl: string, password: string): GameState | null {
        console.log('\n>>> JOIN_GAME SERVICE called');
        console.log('Looking for gameId:', gameId);
        console.log('Total games stored:', this.games.size);
        
        const game = this.games.get(gameId);
        
        if (!game) {
            console.error('✗ Game not found for gameId:', gameId);
            console.log('Available games:', Array.from(this.games.keys()));
            return null;
        }
        
        console.log('✓ Game found');
        console.log('Game password:', game.password);
        console.log('Provided password:', password);
        
        if (game.password !== password) {
            console.error('✗ Password mismatch');
            return null;
        }
        
        console.log('✓ Password correct');

        const newPlayer: Player = {
            id: playerId,
            name: playerName,
            score: 0,
            avatarUrl,
            isReady: false,
            isHost: false,
        }
        game.players.push(newPlayer);
        this.players.set(playerId, newPlayer);
        
        console.log('✓ Player added, total players:', game.players.length);
        console.log('>>> JOIN_GAME SERVICE completed\n');
        
        return game;
    }

}

