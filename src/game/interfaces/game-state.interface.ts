import Player from './player.interface';
import { GameData } from './question.interface';

interface GameState {
    roomId: string;
    password?: string;
    status: 'LOBBY';
    players: Player[];
    package: GameData;
}

export default GameState;