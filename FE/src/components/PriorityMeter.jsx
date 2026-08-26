import { useRef, useState } from "react";

const PRIORITY_MIN = 0;
const PRIORITY_MAX = 10;

const SEGMENTS = Array.from({ length: PRIORITY_MAX }, (_, i) => i + 1);

const clamp = (n) => Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, n));

// Priority reads as a band rather than ten separate colours: past a point the
// exact number matters less than "is this urgent", and three bands are easier
// to scan down a long list than a ten-step gradient.
function bandFor(value) {
  if (value >= 8) return "high";
  if (value >= 4) return "mid";
  return "low";
}

/**
 * A 0-10 priority control that doubles as its own readout: N filled segments
 * out of ten, which is also the percentage the user asked for (N x 10%).
 *
 * Deliberately not a popover or an expanding row - the value is always visible
 * and always directly clickable, so setting priority costs one click and
 * reading it costs none.
 */
function PriorityMeter({ value, onChange, disabled = false, label = "Priority" }) {
  const trackRef = useRef(null);
  const [preview, setPreview] = useState(null);

  // What the segments should show right now: the hovered value while the
  // pointer is over the track, otherwise the committed one.
  const shown = preview ?? value;

  const valueFromPointer = (clientX) => {
    const track = trackRef.current;
    if (!track) return value;

    const { left, width } = track.getBoundingClientRect();
    const ratio = (clientX - left) / width;

    // Anything left of the first segment means "none".
    return clamp(Math.ceil(ratio * PRIORITY_MAX));
  };

  const commit = (next) => {
    if (disabled || next === value) return;
    onChange(next);
  };

  const handlePointerDown = (event) => {
    if (disabled || event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const next = valueFromPointer(event.clientX);
    setPreview(next);
    commit(next);
  };

  const handlePointerMove = (event) => {
    if (disabled) return;

    // Only track the pointer while it is held down; a plain hover previews too.
    const next = valueFromPointer(event.clientX);
    setPreview(next);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) commit(next);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    const step = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 3,
      PageDown: -3,
    }[event.key];

    if (step !== undefined) {
      event.preventDefault();
      commit(clamp(value + step));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      commit(PRIORITY_MIN);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(PRIORITY_MAX);
    }
  };

  return (
    <div className="priority" data-band={bandFor(shown)} data-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        className="priority-track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={PRIORITY_MIN}
        aria-valuemax={PRIORITY_MAX}
        aria-valuenow={value}
        aria-valuetext={`${value} of ${PRIORITY_MAX}, ${value * 10} percent`}
        aria-disabled={disabled || undefined}
        title={`${label}: ${value}/10 (${value * 10}%)`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setPreview(null)}
        onPointerUp={() => setPreview(null)}
        onKeyDown={handleKeyDown}
        onBlur={() => setPreview(null)}
      >
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className="priority-segment"
            data-on={segment <= shown || undefined}
            data-ghost={segment <= shown && segment > value ? true : undefined}
          />
        ))}
      </div>

      <span className="priority-value" aria-hidden="true">
        {shown}
      </span>
    </div>
  );
}

export default PriorityMeter;
