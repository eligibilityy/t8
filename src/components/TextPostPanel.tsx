import { useMemo, useState } from "react";
import { Checkbox } from "@base-ui/react/checkbox";
import type { Entry, EventInfo } from "../types";
import { buildTextPost } from "../lib/textPost";
import { SwapLabel } from "./ui";

export function TextPostPanel({
  event,
  entries,
}: {
  event: EventInfo;
  entries: Entry[];
}) {
  const [opts, setOpts] = useState({
    flags: true,
    handles: true,
    characters: true,
  });
  const [copyState, setCopyState] = useState<"idle" | "done" | "blocked">("idle");
  const text = useMemo(
    () => buildTextPost(event, entries, opts),
    [event, entries, opts],
  );

  async function copy() {
    let next: typeof copyState = "done";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = "blocked";
    }
    setCopyState(next);
    setTimeout(() => setCopyState((s) => (s === next ? "idle" : s)), 1800);
  }

  return (
    <div className="textpost">
      <div className="textpost-opts">
        {(["flags", "handles", "characters"] as const).map((k) => (
          <label key={k} className="check">
            <Checkbox.Root
              className="checkbox"
              checked={opts[k]}
              onCheckedChange={(v) => setOpts({ ...opts, [k]: v })}
            >
              <Checkbox.Indicator className="checkbox-indicator">
                ✓
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span>{k[0].toUpperCase() + k.slice(1)}</span>
          </label>
        ))}
        <span className="count">{text.length} chars</span>
      </div>
      <textarea
        className="input"
        readOnly
        value={text}
        rows={16}
        onFocus={(e) => e.currentTarget.select()}
      />
      <p className="sr-only" role="status">
        {copyState === "done" ? "Post text copied" : copyState === "blocked" ? "Couldn't copy. Select the text and copy it yourself." : ""}
      </p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={copy}>
          <SwapLabel state={copyState} labels={{ idle: "Copy post text", done: "Copied ✓", blocked: "Couldn't copy" }} />
        </button>
      </div>
    </div>
  );
}
