"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { Preferences } from "@/ui/Preferences";

export default function Home() {
  const { t } = useI18n();
  return (
    <main className="page" id="main">
      <h1 className="display" style={{ fontSize: "var(--font-xxl)" }}>
        {t("app.name")}
      </h1>
      <p style={{ fontSize: "var(--font-lg)" }}>{t("app.tagline")}</p>
      <section className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
        <p className="muted" style={{ margin: 0 }}>
          {t("home.intro")}
        </p>
        <div className="row">
          <Link href="/editor/" className="btn btn-primary">
            {t("home.openSample")}
          </Link>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {t("home.comingSoon")}
        </p>
        <Preferences />
      </section>
    </main>
  );
}
