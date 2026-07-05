// components/ui/RatingBadge.jsx
import { getRankClassName } from '../../utils/dashboard';

function RatingBadge({ rank, rating, size = 'md' }) {
  if (rank === undefined && rating === undefined) return null;

  return (
    <span className={`rating-badge ${getRankClassName(rank)} rating-badge-${size}`}>
      <span className="rating-badge-rank">{rank}</span>
      {Number.isFinite(rating) && (
        <span className="rating-badge-value">{rating}</span>
      )}
    </span>
  );
}

export default RatingBadge;