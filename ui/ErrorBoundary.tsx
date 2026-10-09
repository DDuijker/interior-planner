"use client";

import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { buildErrorReport } from "@/core/report/report";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { downloadText } from "@/ui/download";
import { exportProject, openProject } from "@/ui/projects/projectIO";
import { useSettings } from "@/ui/settings/settings";
import { getProjectRecord, listProjects } from "@/ui/storage/db";

interface State {
  error: Error | null;
  componentStack?: string;
}

/**
 * Catches crashes in the app (E12). Offers to try again, an emergency export
 * of every project in this browser, and an error report the user can copy.
 * Nothing is sent anywhere.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(_error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Crashed
        error={this.state.error}
        componentStack={this.state.componentStack}
        onRetry={() => this.setState({ error: null, componentStack: undefined })}
      />
    );
  }
}

function Crashed({
  error,
  componentStack,
  onRetry,
}: {
  error: Error;
  componentStack?: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [report, setReport] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  async function emergencyExport() {
    const metas = await listProjects();
    let n = 0;
    for (const meta of metas) {
      const opened = await openProject(meta.id);
      const name = `${meta.name || "project"}.maison.json`;
      if (opened.ok) downloadText(await exportProject(opened.project), name);
      else {
        // Even a damaged project is worth keeping: save it as it is.
        const record = await getProjectRecord(meta.id);
        if (!record) continue;
        downloadText(JSON.stringify(record.data), name);
      }
      n++;
    }
    setSaved(n);
  }

  return (
    <main className="page crash" id="main" role="alert">
      <h1 className="display">{t("crash.title")}</h1>
      <p>{t("crash.body")}</p>
      <div className="row">
        <Button variant="primary" onClick={onRetry}>
          {t("crash.retry")}
        </Button>
        <Button onClick={() => window.location.reload()}>{t("crash.reload")}</Button>
        <Button icon="download" onClick={() => void emergencyExport()}>
          {t("crash.export")}
        </Button>
      </div>
      {saved !== null && (
        <p role="status" className="small">
          {t("crash.exported", { count: saved })}
        </p>
      )}
      {settings.errorReports && (
        <section className="stack">
          {report === null ? (
            <Button
              variant="ghost"
              onClick={() =>
                setReport(
                  buildErrorReport({
                    message: error.message,
                    stack: error.stack,
                    componentStack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    time: new Date(),
                  }),
                )
              }
            >
              {t("crash.makeReport")}
            </Button>
          ) : (
            <>
              <label className="field">
                <span className="field-label">{t("crash.report")}</span>
                <textarea className="input code-area" rows={10} readOnly value={report} />
              </label>
              <div className="row">
                <Button icon="copy" onClick={() => void navigator.clipboard?.writeText(report)}>
                  {t("crash.copy")}
                </Button>
              </div>
              <p className="muted small">{t("crash.reportHint")}</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
