import { Injectable } from '@nestjs/common';
import GameState from './interfaces/game-state.interface';
import Player from './interfaces/player.interface';
import { v4 as uuid } from 'uuid';
import { Category } from './interfaces/question.interface';

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
            password: password,
            package: { categories: [] }
        };

        this.games.set(roomId, newGame);
        this.players.set(playerId, newPlayer);
        return { gameState: newGame, gameId: roomId };
    }

    joinGame(gameId: string, playerId: string, playerName: string, avatarUrl: string, password: string): GameState | null {
        const game = this.games.get(gameId);

        if (!game) {
            return null;
        }

        if (game.password !== password) {
            return null;
        }

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

        return game;
    }

    getGameState(gameId: string): GameState | null {
        return this.games.get(gameId) || null;
    }

    handleDisconnect(playerId: string): GameState | null {
        this.players.delete(playerId);

        let disconnectedGame: GameState | null = null;

        this.games.forEach((game, gameId) => {
            const playerIndex = game.players.findIndex(p => p.id === playerId);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                disconnectedGame = game;

                if (game.players.length === 0) {
                    this.games.delete(gameId);
                }
            }
        });

        return disconnectedGame;
    }

    loadPackage(gameId: string, packageData: any): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        game.package = { 
            categories: Array.isArray(packageData) ? packageData : []
        };
        return game;
    }
}

