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
            currentAnswerer: [],
            bannedAnswerers: []
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
            game.currentAnswerer.push(playerId);
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
            game.currentAnswerer.push(game.selectionQueue[0]);
        }
        
        return game;
    }

    buzzIn(gameId: string, playerId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'QUESTION_ACTIVE') return null;
        
        if (game.bannedAnswerers.includes(playerId)) {
            return game;
        }
        
        if (game.currentAnswerer.length === 0) {
            game.currentAnswerer.push(playerId);
        }
        
        return game;
    }

    wrongAnswer(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'QUESTION_ACTIVE') return null;
        
        if (game.currentAnswerer.length > 0) {
            const answerer = game.currentAnswerer[0];
            if (!game.bannedAnswerers.includes(answerer)) {
                game.bannedAnswerers.push(answerer);
            }
        }
        
        game.currentAnswerer = [];
        
        return game;
    }

    minusScore(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;

        const player = game.players.find(p => p.id === game.currentAnswerer[0]);
        if (!player) return null;
        player.score -= game.currentQuestion ? game.currentQuestion.question.points : 0;
        return game;
    }

    addScore(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        const player = game.players.find(p => p.id === game.currentAnswerer[0]);
        if (!player) return null;
        player.score += game.currentQuestion ? game.currentQuestion.question.points : 0;
        return game;
    }

    nextSelector(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.currentQuestion) {
            const { categoryIndex, questionIndex } = game.currentQuestion;
            const category = game.package.categories[categoryIndex];
            if (category && category.questions[questionIndex]) {
                category.questions.splice(questionIndex, 1);
            }
        }

        // If no questions remain, finish the game
        const hasQuestions = game.package.categories.some(cat => Array.isArray(cat.questions) && cat.questions.length > 0);
        if (!hasQuestions) {
            game.status = 'FINISHED';
            this.clearQuestion(gameId);
            game.currentSelector = undefined;
            return game;
        }

        if (game.selectionQueue.length > 0) {
            const current = game.selectionQueue.shift();
            if (current) {
                game.selectionQueue.push(current);
            }
        }

        game.currentSelector = game.selectionQueue[0];
        
        this.clearQuestion(gameId);

        // Set currentAnswerer after clearing (if needed)
        if (game.currentSelector) {
            game.currentAnswerer.push(game.currentSelector);
        }

        game.status = 'PLAYING';

        return game;
    }

    clearQuestion(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        game.bannedAnswerers = [];
        game.currentAnswerer = [];
        game.currentQuestion = undefined;
        
        return game;
    }

    activateQuestion(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        game.status = 'QUESTION_ACTIVE';
        game.bannedAnswerers = [];
        game.currentAnswerer = [];
        
        return game;
    }

    skipQuestion(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        // Rotate to next selector
        return this.nextSelector(gameId);
    }
}

