import { useState, type ReactNode } from "react";
import { Accordion } from "@base-ui/react/accordion";
import type {
  AppState,
  ArtAsset,
  ArtLibrary,
  BackgroundImage,
  BackgroundStyle,
  Entry,
  EventInfo,
  Theme,
} from "../types";
import { getTheme } from "../data/themes";
import { EventForm } from "./EventForm";
import { PlayerList } from "./PlayerList";
import { ArtLibraryPanel, usedCharacters } from "./ArtLibraryPanel";
import { StylePanel } from "./StylePanel";
import { ImportDialog } from "./ImportDialog";
import type { ImportedResults } from "../lib/importResults";
import { ChevronIcon } from "./ui";

type Props = {
  state: AppState;
  art: ArtLibrary;
  onEvent: (patch: Partial<EventInfo>) => void;
  onEntry: (index: number, patch: Partial<Entry>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onArt: (name: string, asset: ArtAsset | null) => void;
  onTheme: (id: string) => void;
  onCreateTheme: () => void;
  onUpdateTheme: (id: string, patch: Partial<Theme>) => void;
  onDeleteTheme: (id: string) => void;
  onRestoreTheme: (theme: Theme, index: number) => void;
  bgImage: BackgroundImage | null;
  onBgImage: (bg: BackgroundImage | null) => void;
  onBgStyle: (patch: Partial<BackgroundStyle>) => void;
  onImport: (results: ImportedResults) => void;
};

export function Sidebar({
  state,
  art,
  onEvent,
  onEntry,
  onMove,
  onArt,
  bgImage,
  onBgImage,
  onBgStyle,
  onImport,
  ...themeActions
}: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const used = usedCharacters(state.entries);
  const ready = used.filter((n) => art[n]).length;
  const filled = state.entries.filter((e) => e.tag.trim()).length;

  return (
    <aside className="sidebar" id="editor">
      <div className="sidebar-import">
        <button
          type="button"
          className="btn import-btn"
          onClick={() => setImportOpen(true)}
        >
          <ImportIcon />
          Import results
        </button>
        <span className="hint">from start.gg or Challonge</span>
      </div>
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={onImport}
      />
      <Accordion.Root className="sections" multiple defaultValue={["top8"]}>
        <Section
          value="event"
          title="Event"
          summary={[state.event.name, state.event.date]
            .filter(Boolean)
            .join(" · ")}
        >
          <EventForm event={state.event} onChange={onEvent} />
        </Section>
        <Section
          value="top8"
          title="Top 8"
          summary={`${filled} of ${state.entries.length} players`}
        >
          <PlayerList
            entries={state.entries}
            scheme={state.event.scheme}
            art={art}
            onChange={onEntry}
            onMove={onMove}
          />
        </Section>
        <Section
          value="art"
          title="Art"
          summary={
            used.length
              ? `${ready} of ${used.length} ready`
              : "No characters yet"
          }
          warn={ready < used.length}
        >
          <ArtLibraryPanel art={art} entries={state.entries} onSet={onArt} />
        </Section>
        <Section
          value="style"
          title="Style"
          summary={[
            getTheme(state.themeId, state.customThemes).label ||
              "Untitled theme",
            bgImage?.label,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <StylePanel
            themeId={state.themeId}
            customThemes={state.customThemes}
            {...themeActions}
            bgImage={bgImage}
            onBgImage={onBgImage}
            bgStyle={state.background}
            onBgStyle={onBgStyle}
          />
        </Section>
      </Accordion.Root>
    </aside>
  );
}

function Section({
  value,
  title,
  summary,
  warn,
  children,
}: {
  value: string;
  title: string;
  summary: string;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion.Item className="section" value={value}>
      <Accordion.Header className="section-header">
        <Accordion.Trigger className="section-trigger">
          <span className="section-title">{title}</span>
          <span className="section-summary" data-warn={warn || undefined}>
            {summary}
          </span>
          <ChevronIcon />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="section-panel">
        <div className="section-body">{children}</div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1.75v7m0 0L4.25 6M7 8.75 9.75 6M2 9.5v1.25c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
