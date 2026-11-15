import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Tabs } from "@base-ui/react/tabs";
import type {
  AppState,
  ArtAsset,
  ArtLibrary,
  BackgroundImage,
  Entry,
  EventInfo,
} from "./types";
import { defaultState, hydrate } from "./state";
import { applyScheme } from "./lib/placements";
import { applyImport } from "./lib/importResults";
import {
  loadArt,
  loadBackground,
  loadState,
  putArt,
  putBackground,
  saveState,
} from "./lib/storage";
import { isKeptOverride, resolveArt } from "./lib/artProcess";
import { STAGES, stageBackground } from "./lib/background";
import { downloadPng, slug } from "./lib/exportImage";
import {
  FORMATS,
  createTheme,
  deleteTheme,
  getFormat,
  getTheme,
  restoreTheme,
  updateTheme,
} from "./data/themes";
import { BladeStandings } from "./layouts/BladeStandings";
import { ScaledCanvas } from "./components/ScaledCanvas";
import { Sidebar } from "./components/Sidebar";
import { TextPostPanel } from "./components/TextPostPanel";
import {
  CheckIcon,
  MoreIcon,
  SelectField,
  Spinner,
  SwapLabel,
} from "./components/ui";

type Tab = "standings" | "text";

const nextPaint = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
const FORMAT_ITEMS = FORMATS.map((f) => ({ value: f.id, label: f.label }));

const EDITOR_KEY = "fgc-graphics:editor-hidden";
const readEditorHidden = () => {
  try {
    return localStorage.getItem(EDITOR_KEY) === "1";
  } catch {
    return false;
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(() =>
    hydrate(loadState<AppState>()),
  );
  // Only uploads and hand-adjusted crops get saved.
  const [savedArt, setSavedArt] = useState<ArtLibrary>({});
  const [bgImage, setBgImage] = useState<BackgroundImage | null>(null);
  const [tab, setTab] = useState<Tab>("standings");
  const [exportState, setExportState] = useState<"idle" | "busy" | "done">(
    "idle",
  );
  const [error, setError] = useState("");
  const [editorHidden, setEditorHidden] = useState(readEditorHidden);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadBackground().then((bg) => {
      // Stage file names change every time the art is published, so look them up again.
      if (bg?.id.startsWith("stage:") && !bg.src.startsWith("data:")) {
        const stage = STAGES.find((s) => `stage:${s.slug}` === bg.id);
        return setBgImage(stage ? stageBackground(stage) : null);
      }
      setBgImage(bg);
    });
  }, []);

  useEffect(() => {
    void loadArt().then((lib) => {
      const kept = Object.fromEntries(
        Object.entries(lib).filter(
          ([k, a]) => !k.startsWith("__") && isKeptOverride(a),
        ),
      );
      setSavedArt(kept);
      for (const k of Object.keys(lib)) if (!(k in kept)) void putArt(k, null);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => saveState(state), 300);
    return () => clearTimeout(t);
  }, [state]);

  const theme = getTheme(state.themeId, state.customThemes);
  const format = getFormat(state.standingsFormat);
  const [confirmReset, setConfirmReset] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const setEvent = (patch: Partial<EventInfo>) =>
    setState((s) => {
      const event = { ...s.event, ...patch };
      const entries = patch.scheme
        ? applyScheme(s.entries, patch.scheme)
        : s.entries;
      return { ...s, event, entries };
    });

  const setEntry = (i: number, patch: Partial<Entry>) =>
    setState((s) => ({
      ...s,
      entries: s.entries.map((e, ei) => (ei === i ? { ...e, ...patch } : e)),
    }));

  const moveEntry = (i: number, dir: -1 | 1) =>
    setState((s) => {
      const entries = [...s.entries];
      const j = i + dir;
      if (j < 0 || j >= entries.length) return s;
      [entries[i], entries[j]] = [entries[j], entries[i]];
      return { ...s, entries: applyScheme(entries, s.event.scheme) };
    });

  const setArtFor = (name: string, asset: ArtAsset | null) => {
    setSavedArt((a) => {
      const next = { ...a };
      if (asset) next[name] = asset;
      else delete next[name];
      return next;
    });
    void putArt(name, asset);
  };

  const usedNames = useMemo(
    () => [
      ...new Set(
        state.entries
          .flatMap((e) => e.characters.map((c) => c.name))
          .filter(Boolean),
      ),
    ],
    [state.entries],
  );
  const art = useMemo(
    () => resolveArt(usedNames, savedArt),
    [usedNames, savedArt],
  );

  const filename = useMemo(
    () =>
      `${slug(state.event.name)}-standings-${format.width}x${format.height}.png`,
    [state.event.name, format],
  );

  async function exportPng() {
    if (!canvasRef.current || exportState === "busy") return;
    setExportState("busy");
    setError("");
    try {
      // Rendering hogs the main thread, so let the spinner show up first.
      await nextPaint();
      const node = canvasRef.current.firstElementChild as HTMLElement;
      await downloadPng(node, format.width, format.height, filename);
      setExportState("done");
      setTimeout(
        () => setExportState((s) => (s === "done" ? "idle" : s)),
        1800,
      );
    } catch (e) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      setExportState("idle");
    }
  }

  function toggleEditor() {
    const next = !editorHidden;
    setEditorHidden(next);
    try {
      localStorage.setItem(EDITOR_KEY, next ? "1" : "0");
    } catch {}
  }

  return (
    <div className="app" data-editor-hidden={editorHidden || undefined}>
      <Sidebar
        state={state}
        art={art}
        onImport={(results) => setState((s) => applyImport(s, results))}
        onEvent={setEvent}
        onEntry={setEntry}
        onMove={moveEntry}
        onArt={setArtFor}
        onTheme={(themeId) => setState((s) => ({ ...s, themeId }))}
        onCreateTheme={() => setState((s) => createTheme(s))}
        onUpdateTheme={(id, patch) =>
          setState((s) => updateTheme(s, id, patch))
        }
        onDeleteTheme={(id) => setState((s) => deleteTheme(s, id))}
        onRestoreTheme={(theme, index) =>
          setState((s) => restoreTheme(s, theme, index))
        }
        bgImage={bgImage}
        onBgImage={(bg) => {
          setBgImage(bg);
          void putBackground(bg);
        }}
        onBgStyle={(patch) =>
          setState((s) => ({ ...s, background: { ...s.background, ...patch } }))
        }
      />

      <Tabs.Root
        className="stage"
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
      >
        <div className="toolbar">
          <div className="toolbar-left">
            <button
              type="button"
              className="icon-btn editor-toggle"
              aria-controls="editor"
              aria-expanded={!editorHidden}
              aria-label={editorHidden ? "Show editor" : "Hide editor"}
              title={
                editorHidden
                  ? "Show editor"
                  : "Hide editor for a bigger preview"
              }
              onClick={toggleEditor}
            >
              <SidebarIcon />
            </button>
            <Tabs.List className="tabs" aria-label="Output">
              <Tabs.Tab className="tab" value="standings">
                Standings
              </Tabs.Tab>
              <Tabs.Tab className="tab" value="text">
                Text post
              </Tabs.Tab>
              <Tabs.Indicator className="tab-indicator" />
            </Tabs.List>
          </div>
          <div className="toolbar-right">
            {tab === "standings" && (
              <>
                <SelectField
                  className="format-select"
                  value={state.standingsFormat}
                  items={FORMAT_ITEMS}
                  onChange={(standingsFormat) =>
                    setState((s) => ({ ...s, standingsFormat }))
                  }
                />
                <button
                  type="button"
                  className="btn primary"
                  onClick={exportPng}
                  aria-disabled={exportState === "busy" || undefined}
                  data-busy={exportState === "busy" || undefined}
                >
                  <SwapLabel
                    state={exportState}
                    labels={{
                      idle: "Download PNG",
                      busy: (
                        <>
                          <Spinner /> Rendering
                        </>
                      ),
                      done: (
                        <>
                          Downloaded <CheckIcon />
                        </>
                      ),
                    }}
                  />
                </button>
              </>
            )}
            <Menu.Root>
              <Menu.Trigger className="icon-btn more" aria-label="More options">
                <MoreIcon />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  className="positioner"
                  sideOffset={6}
                  align="end"
                >
                  <Menu.Popup className="popup list-popup">
                    <Menu.Item
                      className="list-item"
                      onClick={() => setAboutOpen(true)}
                    >
                      About this site
                    </Menu.Item>
                    <Menu.Item
                      className="list-item danger"
                      onClick={() => setConfirmReset(true)}
                    >
                      Reset to sample data…
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </div>
        {error && <p className="notice warn">{error}</p>}

        <p className="sr-only" role="status">
          {exportState === "busy"
            ? "Rendering the PNG"
            : exportState === "done"
              ? "PNG downloaded"
              : ""}
        </p>
        <Tabs.Panel
          className="stage-panel"
          value="standings"
          data-busy={exportState === "busy" || undefined}
        >
          <ScaledCanvas
            ref={canvasRef}
            width={format.width}
            height={format.height}
          >
            <BladeStandings
              event={state.event}
              entries={state.entries}
              art={art}
              theme={theme}
              format={format}
              background={{ image: bgImage, style: state.background }}
            />
          </ScaledCanvas>
        </Tabs.Panel>
        <Tabs.Panel className="stage-panel" value="text">
          <TextPostPanel event={state.event} entries={state.entries} />
        </Tabs.Panel>
      </Tabs.Root>

      <Dialog.Root open={aboutOpen} onOpenChange={setAboutOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="backdrop" />
          <Dialog.Popup className="popup dialog">
            <Dialog.Title className="dialog-title">
              t8.yiliya.studio
            </Dialog.Title>
            <div className="about">
              <p>
                Top 8 graphic generator, originally made for fun by{" "}
                <a
                  href="https://yiliya.studio"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Yiliya
                </a>{" "}
                for DLSL IGNIS. More supported games coming soon!
              </p>
              <img
                src="https://tekkenwarehouse.com/wp-content/uploads/2024/02/T_UI_STAMP_034.png"
                width="100"
                alt="Kuma holding his salmon"
              />
              <p className="hint">
                Fan-made and free. Not affiliated with or endorsed by Bandai
                Namco Entertainment. TEKKEN™8 character art and stage images
                &copy; Bandai Namco Entertainment Inc.
              </p>
            </div>
            <div className="btn-row end">
              <Dialog.Close className="btn">Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="backdrop" />
          <AlertDialog.Popup className="popup dialog">
            <AlertDialog.Title className="dialog-title">
              Reset to sample data?
            </AlertDialog.Title>
            <AlertDialog.Description className="hint">
              This replaces the event details, all 8 players and the style
              settings with the sample data. Character art, the background
              picture and your saved themes stay.
            </AlertDialog.Description>
            <div className="btn-row end">
              <AlertDialog.Close className="btn">Cancel</AlertDialog.Close>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setState((s) => ({
                    ...defaultState(),
                    customThemes: s.customThemes,
                  }));
                  setConfirmReset(false);
                }}
              >
                Reset
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="1.75"
        y="2.75"
        width="12.5"
        height="10.5"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
