import Player from './player.interface';
import { GameData, Question } from './question.interface';

interface GameState {
    roomId: string;
    password?: string;
    status: 'LOBBY' | 'PLAYING' | 'QUESTION_ACTIVE' | 'ANSWER' | 'FINISHED';
    players: Player[];
    package: GameData;
    currentSelector?: string;
    currentAnswerer: string[];
    bannedAnswerers: string[]; // Players who answered incorrectly
    currentQuestion?: {
        categoryIndex: number;
        questionIndex: number;
        question: Question;
    };
}

export default GameState;