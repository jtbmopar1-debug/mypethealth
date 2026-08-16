import { Heart, PawPrint } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="My Pet Health">
      <span className="brand-icon" aria-hidden="true">
        <Heart size={22} fill="currentColor" />
        <PawPrint className="brand-paw" size={10} fill="currentColor" />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>MY PET</strong>
          <small>HEALTH</small>
        </span>
      )}
    </div>
  );
}
