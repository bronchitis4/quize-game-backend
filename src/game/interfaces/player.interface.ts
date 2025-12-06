
interface Player {
    id: string;
    name: string;
    score: number;
    avatarUrl?: string;
    isReady: boolean;
    isHost: boolean;
}

export default Player;