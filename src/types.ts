export type PlacementScheme = "DE" | "SE" | "custom";

export type CharacterPick = {
  name: string;
};

export type Entry = {
  id: string;
  placement: number;
  tag: string;
  sponsor: string;
  /** ISO alpha-2, lowercase ("kr") */
  country: string;
  handle: string;
  characters: CharacterPick[]; // 0–3
};

export type EventInfo = {
  name: string;
  game: string;
  subtitle: string; // e.g. "TOP 8"
  date: string;
  location: string;
  entrants: string;
  url: string;
  hashtag: string;
  scheme: PlacementScheme;
};

/** Where the face is in a piece of art; layouts scale the image around it. */
export type ArtFrame = {
  /** Face centre, % of image */
  focusX: number;
  focusY: number;
  /** Face height / image height */
  face: number;
  zoom: number;
};

export type ArtAsset = ArtFrame & {
  src: string;
  source?: "builtin" | "upload";
  /** Cropped by hand */
  manual?: boolean;
};

export type ArtLibrary = Record<string, ArtAsset>;

export type Theme = {
  id: string;
  label: string;
  bg: string;
  bg2: string;
  surface: string;
  surfaceEdge: string;
  accent: string;
  accentInk: string; // text on accent
  accent2: string;
  text: string;
  textDim: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
};

export type BackgroundImage = {
  src: string;
  /** "stage:<slug>" or "upload" */
  id: string;
  label: string;
};

export type BackgroundStyle = {
  /** Shade opacity, 0–1 */
  dim: number;
  /** px */
  blur: number;
  /** object-position, % */
  posX: number;
  posY: number;
};

export type Format = { id: string; label: string; width: number; height: number };

export type AppState = {
  event: EventInfo;
  entries: Entry[];
  themeId: string;
  standingsFormat: string;
  background: BackgroundStyle;
};
