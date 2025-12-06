
interface GameState {
    roomId: string;
    password?: string;
    status: 'LOBBY';
    players: any[];
}

export default GameState;