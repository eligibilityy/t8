import type { ReactNode } from "react";
import { Accordion } from "@base-ui/react/accordion";
import type { AppState, ArtAsset, ArtLibrary, BackgroundImage, BackgroundStyle, Entry, EventInfo, Theme } from "../types";
import { getTheme } from "../data/themes";
import { EventForm } from "./EventForm";
import { PlayerList } from "./PlayerList";
import { ArtLibraryPanel, usedCharacters } from "./ArtLibraryPanel";
import { StylePanel } from "./StylePanel";
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
  bgImage: BackgroundImage | null;
  onBgImage: (bg: BackgroundImage | null) => void;
  onBgStyle: (patch: Partial<BackgroundStyle>) => void;
};

export function Sidebar({ state, art, onEvent, onEntry, onMove, onArt, bgImage, onBgImage, onBgStyle, ...themeActions }: Props) {
  const used = usedCharacters(state.entries);
  const ready = used.filter((n) => art[n]).length;
  const filled = state.entries.filter((e) => e.tag.trim()).length;

  return (
    <aside className="sidebar" id="editor">
      <Accordion.Root className="sections" multiple defaultValue={["top8"]}>
        <Section value="event" title="Event" summary={[state.event.name, state.event.date].filter(Boolean).join(" · ")}>
          <EventForm event={state.event} onChange={onEvent} />
        </Section>
        <Section value="top8" title="Top 8" summary={`${filled} of ${state.entries.length} players`}>
          <PlayerList entries={state.entries} scheme={state.event.scheme} art={art} onChange={onEntry} onMove={onMove} />
        </Section>
        <Section
          value="art"
          title="Art"
          summary={used.length ? `${ready} of ${used.length} ready` : "No characters yet"}
          warn={ready < used.length}
        >
          <ArtLibraryPanel art={art} entries={state.entries} onSet={onArt} />
        </Section>
        <Section
          value="style"
          title="Style"
          summary={[getTheme(state.themeId, state.customThemes).label || "Untitled theme", bgImage?.label].filter(Boolean).join(" · ")}
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

function Section({ value, title, summary, warn, children }: { value: string; title: string; summary: string; warn?: boolean; children: ReactNode }) {
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
