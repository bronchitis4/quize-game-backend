
interface Player {
    id: string;
    name: string;
    score: number;
    avatarUrl?: string;
    isReady: boolean;
    isHost: boolean;
    isActive: boolean;
}

export default Player;