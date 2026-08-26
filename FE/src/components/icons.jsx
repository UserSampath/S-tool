// One stroked icon family: 24x24, no fills, colour and weight inherited from
// CSS so the same glyph works on a card, in a button, or on the nav bar.
function Icon({ children, className = "" }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function EyeIcon({ open }) {
  return (
    <Icon>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
      {!open && <path d="M4 20 20 4" />}
    </Icon>
  );
}

export function PullRequestIcon() {
  return (
    <Icon>
      <circle cx="6.5" cy="6" r="2.5" />
      <circle cx="6.5" cy="18" r="2.5" />
      <path d="M6.5 8.5v7" />
      <circle cx="17.5" cy="18" r="2.5" />
      <path d="M17.5 15.5V10a3 3 0 0 0-3-3h-3.5" />
      <path d="m13.5 4.5-2.5 2.5 2.5 2.5" />
    </Icon>
  );
}

export function GrammarIcon() {
  return (
    <Icon>
      <path d="M3.5 17 8 6.5 12.5 17" />
      <path d="M5.2 13.4h5.6" />
      <path d="m14.5 14.8 2.6 2.7 4.4-5.5" />
    </Icon>
  );
}

export function FlagIcon() {
  return (
    <Icon>
      <path d="M6 21V4" />
      <path d="M6 5h11.5l-2.3 3.6L17.5 12H6" />
    </Icon>
  );
}

export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 1.9" />
    </Icon>
  );
}

export function NotepadIcon() {
  return (
    <Icon>
      <rect x="5" y="3.5" width="14" height="17" rx="3.5" />
      <path d="M9 3.5v3M15 3.5v3" />
      <path d="M9 12h6M9 16h4" />
    </Icon>
  );
}

export function ProjectBoardIcon() {
  return (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M8 8.5v7" />
      <path d="M12 8.5v4.5" />
      <path d="M16 8.5v5.5" />
    </Icon>
  );
}

export function GripIcon() {
  return (
    <Icon>
      <circle cx="9" cy="6" r="1.15" />
      <circle cx="9" cy="12" r="1.15" />
      <circle cx="9" cy="18" r="1.15" />
      <circle cx="15" cy="6" r="1.15" />
      <circle cx="15" cy="12" r="1.15" />
      <circle cx="15" cy="18" r="1.15" />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
    </Icon>
  );
}

export function SortIcon() {
  return (
    <Icon>
      <path d="M4 7h9M4 12h6M4 17h3" />
      <path d="M17 5v14" />
      <path d="m14 16 3 3 3-3" />
    </Icon>
  );
}

export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3M16 3.5v3" />
      <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </Icon>
  );
}

/**
 * One glyph with three states, so a task's status reads at a glance without
 * relying on colour: an empty ring, a half-filled ring, a tick.
 */
export function StatusIcon({ status }) {
  if (status === "done") {
    return (
      <Icon className="filled-none">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.2 12.2 2.6 2.6 5-5.4" />
      </Icon>
    );
  }

  if (status === "doing") {
    return (
      <Icon>
        <circle cx="12" cy="12" r="8.5" />
        {/* Half the disc filled - "started, not finished" without a colour cue. */}
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
      </Icon>
    );
  }

  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
    </Icon>
  );
}

// An inbox tray: work that has arrived but has not been given a day yet.
export function BacklogIcon() {
  return (
    <Icon>
      <path d="M3.5 13.5 6.2 5.5h11.6l2.7 8" />
      <path d="M3.5 13.5v3.9A1.6 1.6 0 0 0 5.1 19h13.8a1.6 1.6 0 0 0 1.6-1.6v-3.9" />
      <path d="M3.5 13.5h4.2l1.2 2h6.2l1.2-2h4.2" />
    </Icon>
  );
}

export function PaletteIcon() {
  return (
    <Icon>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.9 2-1.8 0-1.1-1-1.7-1-2.7 0-.8.7-1.5 1.6-1.5h1.7A4.2 4.2 0 0 0 20.5 10c0-3.6-3.7-6.5-8.5-6.5Z" />
      <circle cx="7.8" cy="11.5" r="1.1" />
      <circle cx="11" cy="7.6" r="1.1" />
      <circle cx="15.6" cy="8.6" r="1.1" />
    </Icon>
  );
}

export function BracesIcon() {
  return (
    <Icon>
      <path d="M9.8 3.5C7.9 3.5 7.3 4.4 7.3 6.3v2.2c0 1.4-.8 2.4-2.4 2.9 1.6.5 2.4 1.5 2.4 2.9v2.4c0 1.9.6 2.8 2.5 2.8" />
      <path d="M14.2 3.5c1.9 0 2.5.9 2.5 2.8v2.2c0 1.4.8 2.4 2.4 2.9-1.6.5-2.4 1.5-2.4 2.9v2.4c0 1.9-.6 2.8-2.5 2.8" />
    </Icon>
  );
}

// A bolt, not another page: this tool is about speed, and the notepad already
// owns every note-shaped glyph on the grid.
export function QuickNoteIcon() {
  return (
    <Icon>
      <path d="M13.6 3 5.8 13.6h5.1l-1 7.4 8.3-10.6h-5.1l.5-7.4Z" />
    </Icon>
  );
}

export function CopyIcon() {
  return (
    <Icon>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2.5" />
      <path d="M15 6.5V6A2.5 2.5 0 0 0 12.5 3.5h-6A2.5 2.5 0 0 0 4 6v6a2.5 2.5 0 0 0 2.5 2.5H7" />
    </Icon>
  );
}

export function FolderIcon({ open }) {
  return (
    <Icon>
      {open ? (
        <path d="M3.5 19.5V6a1.5 1.5 0 0 1 1.5-1.5h3.9l2 2.5h5.6A1.5 1.5 0 0 1 18 8.5v1M3.5 19.5h13.2l3.6-8H7.1l-3.6 8Z" />
      ) : (
        <path d="M3.5 18.5V6A1.5 1.5 0 0 1 5 4.5h3.9l2 2.5h8.1a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      )}
    </Icon>
  );
}

export function NoteIcon() {
  return (
    <Icon>
      <path d="M6 3.5h7.5L18.5 8.5V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M13.2 3.6v5.2h5.2" />
      <path d="M8 13h7M8 16.5h5" />
    </Icon>
  );
}

export function ChevronIcon() {
  return (
    <Icon>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

export function FolderPlusIcon() {
  return (
    <Icon>
      <path d="M3.5 18.5V6A1.5 1.5 0 0 1 5 4.5h3.9l2 2.5h8.1a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      <path d="M12 11.5v5M9.5 14h5" />
    </Icon>
  );
}

export function NotePlusIcon() {
  return (
    <Icon>
      <path d="M18.5 10.5V8.5L13.5 3.5H6A1.5 1.5 0 0 0 4.5 5v15A1.5 1.5 0 0 0 6 21.5h5" />
      <path d="M13.2 3.6v5.2h5.2" />
      <path d="M17.5 14v6M14.5 17h6" />
    </Icon>
  );
}

export function BulletListIcon() {
  return (
    <Icon>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.6" cy="6.5" r="1.1" />
      <circle cx="4.6" cy="12" r="1.1" />
      <circle cx="4.6" cy="17.5" r="1.1" />
    </Icon>
  );
}

export function NumberListIcon() {
  return (
    <Icon>
      <path d="M9.5 6.5h10.5M9.5 12h10.5M9.5 17.5h10.5" />
      <path d="M3.4 4.9 4.9 4.2v4.1" />
      <path d="M3.2 10.6a1.4 1.4 0 1 1 2.3 1.1L3.2 13.8h2.4" />
      <path d="M3.4 16.1h2.2l-1.4 1.6a1.3 1.3 0 1 1-1 2" />
    </Icon>
  );
}

export function QuoteIcon() {
  return (
    <Icon>
      <path d="M4.5 5.5v13" />
      <path d="M9 8.5h11M9 12h11M9 15.5h7" />
    </Icon>
  );
}

export function CodeIcon() {
  return (
    <Icon>
      <path d="m8.5 8.5-4 3.5 4 3.5" />
      <path d="m15.5 8.5 4 3.5-4 3.5" />
      <path d="m13.5 5-3 14" />
    </Icon>
  );
}

export function LinkIcon() {
  return (
    <Icon>
      <path d="M10 13.5a3.6 3.6 0 0 0 5.2.3l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4" />
      <path d="M14 10.5a3.6 3.6 0 0 0-5.2-.3l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4" />
    </Icon>
  );
}

export function AlignIcon({ align }) {
  const short = { left: "M4 15.5h9", center: "M7.5 15.5h9", right: "M11 15.5h9" }[align];

  return (
    <Icon>
      <path d="M4 8.5h16M4 12h16" />
      <path d={short} />
    </Icon>
  );
}

export function ClearFormatIcon() {
  return (
    <Icon>
      <path d="M8 6.5h11" />
      <path d="M13.5 6.5 10 17.5" />
      <path d="m4.5 13 5 5M9.5 13l-5 5" />
    </Icon>
  );
}

// A thumbtack rather than a map pin - this marks "kept at the top", not a place.
// Solid when the project is pinned, so the state reads without colour alone.
export function PinIcon({ filled }) {
  return (
    <Icon className={filled ? "filled" : ""}>
      <path d="M9.6 3.5h4.8l-.6 5.6 3.2 2.7v1.4H7v-1.4l3.2-2.7-.6-5.6Z" />
      <path d="M12 13.2v7.3" />
    </Icon>
  );
}

export function ArrowLeftIcon() {
  return (
    <Icon>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Icon>
  );
}

export function SignOutIcon() {
  return (
    <Icon>
      <path d="M14.5 20H6.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
      <path d="M16 15.5 19.5 12 16 8.5" />
      <path d="M19.5 12h-10" />
    </Icon>
  );
}

export function ArrowRightIcon() {
  return (
    <Icon>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}
