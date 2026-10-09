"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { appendFloors, replaceCurrent } from "@/core/model/actions";
import type { Floor } from "@/core/model/types";
import { parsePlanCode, planCodeToFloors } from "@/core/plancode/plancode";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { Tabs } from "@/ui/components/Tabs";
import { useToast } from "@/ui/components/Toast";
import { useWorkspace } from "./context";

const AiImport = dynamic(() => import("@/ui/ai/AiImport").then((m) => m.AiImport), { ssr: false });

const EXAMPLE = `{
  "name": "Begane grond",
  "height": 260,
  "rooms": [
    {"name": "Woonkamer", "type": "living", "rects": [[0, 0, 500, 400]]},
    {"name": "Keuken", "type": "kitchen", "rects": [[500, 0, 300, 400]]}
  ],
  "doors": [{"x": 500, "y": 150, "w": 90, "dir": "v"}],
  "windows": [{"x": 100, "y": -15, "w": 200, "dir": "h"}]
}`;

/** Import into the open project: plan-code or a photo read by Claude. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("code");
  return (
    <Modal open onClose={onClose} title={t("workspace.import")}>
      <Tabs
        label={t("workspace.import")}
        value={tab}
        onChange={setTab}
        items={[
          { id: "code", label: t("import.tab.code"), content: <PlanCodeImport onDone={onClose} /> },
          { id: "ai", label: t("import.tab.ai"), content: <AiImport onDone={onClose} /> },
        ]}
      />
    </Modal>
  );
}

/** Put imported floors in the project: replace the open floor or add them. */
export function useApplyFloors() {
  const { apply, floor, dispatch } = useWorkspace();
  return (floors: Floor[], mode: "replace" | "append") => {
    if (mode === "replace" && floors.length === 1)
      apply((p) => replaceCurrent(p, floor.id, floors[0]!));
    else if (mode === "replace")
      apply((p) => appendFloors(replaceCurrent(p, floor.id, floors[0]!), floors.slice(1)));
    else apply((p) => appendFloors(p, floors));
    dispatch({ type: "view", view: "plan" });
  };
}

function PlanCodeImport({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? parsePlanCode(text) : null), [text]);
  const applyFloors = useApplyFloors();

  function run(mode: "replace" | "append") {
    if (!result?.ok) return;
    applyFloors(planCodeToFloors(result.plans), mode);
    if (result.warnings.length)
      toast(t("import.warnings", { count: result.warnings.length }), "warning");
    onDone();
  }

  return (
    <div className="stack">
      <label className="field">
        <span className="field-label">{t("import.codeLabel")}</span>
        <textarea
          className="input code-area"
          rows={12}
          spellCheck={false}
          value={text}
          placeholder={EXAMPLE}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="code-status"
          aria-invalid={result && !result.ok ? true : undefined}
        />
      </label>
      <div id="code-status" role="status">
        {result && !result.ok && (
          <ul className="error-list">
            {result.errors.map((e, i) => (
              <li key={i}>
                <strong>{t("import.lineCol", { line: e.line, col: e.col })}</strong>{" "}
                {e.path && <code>{e.path}</code>} {e.message}
              </li>
            ))}
          </ul>
        )}
        {result?.ok && (
          <p className="muted">
            {t("import.codeOk", { count: result.plans.length })}
            {result.warnings.map((w) => (
              <span key={w.path} className="block small">
                <code>{w.path}</code> {w.message}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="row">
        <Button variant="primary" disabled={!result?.ok} onClick={() => run("replace")}>
          {t("import.replace")}
        </Button>
        <Button disabled={!result?.ok} onClick={() => run("append")}>
          {t("import.append")}
        </Button>
        <Button variant="ghost" onClick={() => setText(EXAMPLE)}>
          {t("import.example")}
        </Button>
      </div>
      <p className="muted small">
        <Link href="/help/#plan-code" target="_blank">
          {t("import.docs")}
        </Link>
      </p>
    </div>
  );
}
