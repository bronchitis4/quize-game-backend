import Player from './player.interface';
import { GameData, Question } from './question.interface';

interface GameState {
    roomId: string;
    password?: string;
    status: 'LOBBY' | 'PLAYING' | 'QUESTION_ACTIVE' | 'FINISHED';
    players: Player[];
    package: GameData;
    selectionQueue: string[];
    currentSelector?: string;
    answerQueue: string[];
    currentAnswerer?: string;
    currentQuestion?: {
        categoryIndex: number;
        questionIndex: number;
        question: Question;
    };
}

export default GameState;