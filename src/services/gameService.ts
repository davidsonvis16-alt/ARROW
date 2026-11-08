import { rpc, rpcSafe } from './rpc';
import { GameKind, GamePack, GameRound } from '../types';

/**
 * Date games inside a match. The server deals the cards, keeps every answer
 * sealed until both people have played, and proves match membership on every
 * call. Answers arrive here already encrypted on this device.
 */
export const gameService = {
  async getGames(matchId: string): Promise<GameRound[]> {
    return rpcSafe<GameRound[]>('arrow_get_games', { p_match_id: matchId, p_limit: 30 }, []);
  },

  async startGame(
    matchId: string,
    kind: GameKind,
    pack: GamePack = 'starter',
    setup?: string,
    answer?: string
  ): Promise<GameRound> {
    return rpc<GameRound>('arrow_start_game', {
      p_match_id: matchId,
      p_kind: kind,
      p_pack: pack,
      p_setup: setup ?? null,
      p_answer: answer ?? null,
    });
  },

  async answerGame(gameId: string, answer: string): Promise<GameRound> {
    return rpc<GameRound>('arrow_answer_game', { p_game_id: gameId, p_answer: answer });
  },
};
