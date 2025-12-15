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
            package: { categories: [] },
            selectionQueue: [],
            currentSelector: undefined,
            answerQueue: []
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

        game.selectionQueue.push(playerId);
        
        if (!game.currentSelector) {
            game.currentSelector = playerId;
        }

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

    selectQuestion(gameId: string, categoryIndex: number, questionIndex: number): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        const category = game.package.categories[categoryIndex];
        if (!category) return null;
        
        const question = category.questions[questionIndex];
        if (!question) return null;
        
        game.status = 'QUESTION_ACTIVE';
        game.currentQuestion = {
            categoryIndex,
            questionIndex,
            question
        };
        
        return game;
    }

    startGame(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.status !== 'LOBBY') return null;
        
        game.status = 'PLAYING';
        
        if (game.selectionQueue.length > 0 && !game.currentSelector) {
            game.currentSelector = game.selectionQueue[0];
        }
        
        return game;
    }

    addToAnswerQueue(gameId: string, playerId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'QUESTION_ACTIVE') return null;
        
        if (!game.answerQueue.includes(playerId)) {
            game.answerQueue.push(playerId);
        }
        
        if (!game.currentAnswerer && game.answerQueue.length > 0) {
            game.currentAnswerer = game.answerQueue[0];
        }
        
        return game;
    }

    nextAnswerer(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.answerQueue.length > 0) {
            game.answerQueue.shift();
        }
        
        game.currentAnswerer = game.answerQueue[0];
        
        return game;
    }

    minusScore(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;

        const player = game.players.find(p => p.id === game.currentSelector);
        if (!player) return null;
        player.score -= game.currentQuestion ? game.currentQuestion.question.points : 0;
        return game;
    }

    addScore(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        const player = game.players.find(p => p.id === game.currentSelector);
        if (!player) return null;
        player.score += game.currentQuestion ? game.currentQuestion.question.points : 0;
        return game;
    }

    nextSelector(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.selectionQueue.length > 0) {
            const current = game.selectionQueue.shift();
            if (current) {
                game.selectionQueue.push(current);
            }
        }
        
        game.currentSelector = game.selectionQueue[0];
        game.status = 'PLAYING';
        
        this.clearAnswerQueue(gameId);
        
        return game;
    }

    clearAnswerQueue(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        game.answerQueue = [];
        game.currentAnswerer = undefined;
        game.currentQuestion = undefined;
        
        return game;
    }

    activateQuestion(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        game.status = 'QUESTION_ACTIVE';
        
        if (game.currentSelector) {
            game.answerQueue = [game.currentSelector];
            game.currentAnswerer = game.currentSelector;
        } else {
            game.answerQueue = [];
            game.currentAnswerer = undefined;
        }
        
        return game;
    }
}

