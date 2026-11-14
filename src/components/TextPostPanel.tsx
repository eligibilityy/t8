import { useMemo, useState } from "react";
import { Checkbox } from "@base-ui/react/checkbox";
import type { Entry, EventInfo } from "../types";
import { buildTextPost } from "../lib/textPost";

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
  const [copied, setCopied] = useState(false);
  const text = useMemo(
    () => buildTextPost(event, entries, opts),
    [event, entries, opts],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
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
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={copy}>
          {copied ? "Copied" : "Copy post text"}
        </button>
      </div>
    </div>
  );
}
