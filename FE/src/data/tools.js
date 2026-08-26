import {
  BracesIcon,
  CalendarIcon,
  FlagIcon,
  GrammarIcon,
  NotepadIcon,
  PaletteIcon,
  ProjectBoardIcon,
  PullRequestIcon,
  QuickNoteIcon,
} from "../components/icons";

// The home grid. `accent` drives the icon chip colour; `ready` marks a tool that
// actually has a screen behind it, so the card can say so instead of pretending.
// `screen` names the component HomePage should open; tools without one fall
// back to the placeholder detail panel.
export const tools = [
  {
    id: "pr-generator",
    name: "PR generator",
    description:
      "Generate a PR description from your branch name and commit messages.",
    icon: PullRequestIcon,
    accent: "violet",
    ready: true,
    screen: "pr",
  },
  {
    id: "grammar-helper",
    name: "Grammar helper",
    description: "Rewrite any text into clean, grammatically correct English.",
    icon: GrammarIcon,
    accent: "teal",
    ready: true,
    screen: "grammar",
  },
  {
    // Short and long term used to be two cards. They are the same tool with a
    // different timescale, so they share one card and split inside instead.
    id: "today-plan",
    name: "Today plan",
    description: "Plan the day, and the days either side of it.",
    icon: CalendarIcon,
    // Rose came free when short and long term plans merged into one card.
    accent: "rose",
    ready: true,
    screen: "today",
  },
  {
    id: "plans",
    name: "Plans",
    description: "This week's moves and the long game, in one place.",
    icon: FlagIcon,
    accent: "amber",
    ready: true,
    screen: "plans",
  },
  {
    id: "notepad",
    name: "Notepad",
    description: "A scratch pad for the thoughts that need somewhere to land.",
    icon: NotepadIcon,
    accent: "sky",
    ready: true,
    screen: "notes",
  },
  {
    id: "color-palette",
    name: "Colour palette",
    description: "Pick a colour, adjust it, and keep the ones worth keeping.",
    icon: PaletteIcon,
    accent: "fuchsia",
    ready: true,
    screen: "color",
  },
  {
    id: "json-toolkit",
    name: "JSON toolkit",
    description: "Format, validate and minify JSON, without it leaving the page.",
    icon: BracesIcon,
    accent: "slate",
    ready: true,
    screen: "json",
  },
  {
    id: "quick-note",
    name: "Quick note",
    description: "Catch a thought in one line, before it gets away.",
    icon: QuickNoteIcon,
    accent: "lime",
    ready: true,
    screen: "quicknote",
  },
  {
    id: "project-manager",
    name: "Project manager",
    description:
      "Track what each project needs next, and what is quietly blocked.",
    icon: ProjectBoardIcon,
    accent: "emerald",
    ready: true,
    screen: "projects",
  },
];
