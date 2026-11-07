import { sha256 } from '../../utils/crypto';

/** Token binds the decision to exactly the text, rating and image order shown to the moderator. */
export function reviewContentVersion(review: { comment: string; rating: number; images?: string[] }): string {
  return sha256(JSON.stringify([review.comment, review.rating, review.images ?? []]));
}
