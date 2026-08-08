import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export default function StarRating({
  value,
  onChange,
  disabled = false,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);

  return (
    <div
      className="star-rating"
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={(hover || value) >= star ? 'filled' : ''}
          onClick={() => onChange(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => setHover(0)}
          disabled={disabled}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          role="radio"
          aria-checked={value === star}
        >
          ★
        </button>
      ))}
    </div>
  );
}
