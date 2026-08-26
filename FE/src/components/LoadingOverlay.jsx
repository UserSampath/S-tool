import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./LoadingOverlay.css";

/**
 * A full-page loading veil.
 *
 * Rendered through a portal into <body> rather than in place: an ancestor with
 * a transform, filter or backdrop-filter becomes the containing block for
 * `position: fixed`, and several pages here animate with a translate. Portalling
 * makes the overlay cover the viewport wherever it is used from.
 *
 * The backdrop is a light veil with no blur - the page behind stays readable,
 * so it reads as "working on this" rather than hiding what you were looking at.
 */
function LoadingOverlay({ show, label = "Working", accent = "violet" }) {
  // A veil that blocks the page but lets it scroll underneath feels broken.
  useEffect(() => {
    if (!show) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div className="veil" data-accent={accent} role="status" aria-live="polite" aria-busy="true">
      <div className="veil-card">
        {/*
          An SVG arc whose dash pattern grows and shrinks while the whole svg
          turns. Animating stroke-dasharray is about as widely supported as CSS
          animation gets - the previous version leaned on conic-gradient plus a
          mask, which renders as a static ring anywhere that combination is not
          fully supported.
        */}
        <svg className="veil-spinner" viewBox="0 0 50 50" aria-hidden="true">
          <circle className="veil-track" cx="25" cy="25" r="20" />
          <circle className="veil-arc" cx="25" cy="25" r="20" />
        </svg>

        <p className="veil-label">
          {label}
          <span className="veil-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>
    </div>,
    document.body,
  );
}

export default LoadingOverlay;
