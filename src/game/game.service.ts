import { Injectable } from '@nestjs/common';
import GameState from './interfaces/game-state.interface';
import Player from './interfaces/player.interface';
import { v4 as uuid } from 'uuid';
import { Category } from './interfaces/question.interface';

@Injectable()
export class GameService {
    private games: Map<string, GameState> = new Map();
    private players = new Map<string, Player>();
    private disconnectTimers = new Map<string, NodeJS.Timeout>();

    createGame(playerId: string, playerName: string, avatarUrl: string, password: string): { gameState: GameState, gameId: string } {
        const roomId = uuid();
        const newPlayer: Player = {
            id: playerId,
            name: playerName,
            avatarUrl: avatarUrl,
            score: 0,
            isReady: false,
            isHost: true,
            isActive: true,
        }
        const newGame: GameState = {
            roomId,
            status: 'LOBBY',
            players: [newPlayer],
            password: password,
            package: { categories: [] },
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

        // Check if a player with this name already exists (reconnecting player)
        const existingPlayer = game.players.find(p => p.name === playerName);
        
        if (existingPlayer) {
            // Player is reconnecting - update socket ID and reactivate
            const oldPlayerId = existingPlayer.id;
            existingPlayer.id = playerId;
            existingPlayer.isActive = true;
            this.players.set(playerId, existingPlayer);
            
            // Update currentSelector if this player was the selector
            if (game.currentSelector === oldPlayerId) {
                game.currentSelector = playerId;
            }
            
            // Update currentAnswerer if this player was the answerer
            const answererIndex = game.currentAnswerer.indexOf(oldPlayerId);
            if (answererIndex !== -1) {
                game.currentAnswerer[answererIndex] = playerId;
            }
            
            // Cancel disconnect timer if it exists (for both selector and answerer)
            const selectorTimerKey = `${gameId}_${existingPlayer.name}_selector`;
            const selectorTimer = this.disconnectTimers.get(selectorTimerKey);
            if (selectorTimer) {
                clearTimeout(selectorTimer);
                this.disconnectTimers.delete(selectorTimerKey);
            }
            
            const answererTimerKey = `${gameId}_${existingPlayer.name}_answerer`;
            const answererTimer = this.disconnectTimers.get(answererTimerKey);
            if (answererTimer) {
                clearTimeout(answererTimer);
                this.disconnectTimers.delete(answererTimerKey);
            }
            
            return game;
        }

        // New player
        const newPlayer: Player = {
            id: playerId,
            name: playerName,
            score: 0,
            avatarUrl: avatarUrl,
            isReady: false,
            isHost: false,
            isActive: true,
        }
        game.players.push(newPlayer);
        this.players.set(playerId, newPlayer);
        
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
            const player = game.players.find(p => p.id === playerId);
            if (player) {
                // Instead of removing the player, just deactivate them
                player.isActive = false;
                disconnectedGame = game;

                // If this player was currentSelector, give 2 seconds for reconnect
                const currentSelectorPlayer = game.players.find(p => p.id === game.currentSelector);
                if (currentSelectorPlayer && currentSelectorPlayer.name === player.name) {
                    const timerKey = `${gameId}_${player.name}_selector`;
                    
                    // Clear previous timer if exists
                    const existingTimer = this.disconnectTimers.get(timerKey);
                    if (existingTimer) {
                        clearTimeout(existingTimer);
                    }
                    
                    // Set new timer
                    const timer = setTimeout(() => {
                        const currentGame = this.games.get(gameId);
                        if (currentGame) {
                            const selector = currentGame.players.find(p => p.id === currentGame.currentSelector);
                            const disconnectedPlayer = currentGame.players.find(p => p.name === player.name);
                            
                            // Check if selector is still the disconnected player (by name) and still inactive
                            if (selector && disconnectedPlayer && selector.name === disconnectedPlayer.name && !disconnectedPlayer.isActive) {
                                // Player didn't return, select another one
                                const activePlayers = currentGame.players.filter(p => p.isActive && p.name !== player.name);
                                if (activePlayers.length > 0) {
                                    // Select player with lowest score
                                    const playerWithLowestScore = activePlayers.reduce((prev, curr) => 
                                        prev.score < curr.score ? prev : curr
                                    );
                                    currentGame.currentSelector = playerWithLowestScore.id;
                                } else {
                                    currentGame.currentSelector = undefined;
                                }
                            }
                        }
                        this.disconnectTimers.delete(timerKey);
                    }, 2000);
                    
                    this.disconnectTimers.set(timerKey, timer);
                }

                // If this player is in currentAnswerer, give 2 seconds for reconnect
                const isCurrentAnswerer = game.currentAnswerer.length > 0 && 
                    game.players.find(p => p.id === game.currentAnswerer[0])?.name === player.name;
                
                if (isCurrentAnswerer) {
                    const timerKey = `${gameId}_${player.name}_answerer`;
                    
                    // Clear previous timer if exists
                    const existingTimer = this.disconnectTimers.get(timerKey);
                    if (existingTimer) {
                        clearTimeout(existingTimer);
                    }
                    
                    // Set new timer
                    const timer = setTimeout(() => {
                        const currentGame = this.games.get(gameId);
                        if (currentGame && currentGame.currentAnswerer.length > 0) {
                            const answerer = currentGame.players.find(p => p.id === currentGame.currentAnswerer[0]);
                            const disconnectedPlayer = currentGame.players.find(p => p.name === player.name);
                            
                            // Check if answerer is still the disconnected player (by name) and still inactive
                            if (answerer && disconnectedPlayer && answerer.name === disconnectedPlayer.name && !disconnectedPlayer.isActive) {
                                // Player didn't return, clear currentAnswerer so others can buzz in
                                currentGame.currentAnswerer = [];
                            }
                        }
                        this.disconnectTimers.delete(timerKey);
                    }, 2000);
                    
                    this.disconnectTimers.set(timerKey, timer);
                }

                // Delete game only if all players are inactive
                const allInactive = game.players.every(p => !p.isActive);
                if (allInactive) {
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
        game.currentAnswerer = [];
        return game;
    }

    startGame(gameId: string): GameState | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.status !== 'LOBBY') return null;
        
        game.status = 'PLAYING';
        
        if (!game.currentSelector && game.players.length > 0) {
            game.currentSelector = game.players[0].id;
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
        game.status = 'ANSWER';
        
        // Player who answered correctly becomes the next selector
        game.currentSelector = game.currentAnswerer[0];
        
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
        
        this.clearQuestion(gameId);

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
        
        game.status = 'ANSWER';
        
        // const activePlayers = game.players.filter(p => p.isActive && !p.isHost);
        // if (activePlayers.length > 0) {
        //     const randomIndex = Math.floor(Math.random() * activePlayers.length);
        //     const randomPlayer = activePlayers[randomIndex];
        //     game.currentSelector = randomPlayer.id;
        // }

        const playerWithLowestScore = game.players.reduce((prev, curr) => prev.score < curr.score ? prev : curr);
        game.currentSelector = playerWithLowestScore.id;
    
        
        return game;
    }
}

