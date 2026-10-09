"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ENTRIES,
  customEntry,
  searchCatalog,
  CATEGORIES,
  type CatalogEntry,
  type Category,
} from "@/catalog";
import type { CustomItemDef } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button, IconButton } from "@/ui/components/Button";
import { EntryThumb } from "./PartsSvg";
import { addRecent, getFavorites, getRecent, toggleFavorite } from "./favorites";

export const CATALOG_DRAG_TYPE = "application/x-maison-catalog";

/** Searchable catalogue. Click adds to the middle of the view, or drag onto the plan. */
export function CatalogPanel({
  onAdd,
  custom,
  onBuildCustom,
  showLife,
}: {
  onAdd: (entry: CatalogEntry) => void;
  custom: readonly CustomItemDef[];
  onBuildCustom: () => void;
  showLife: boolean;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "favorites" | "">("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    // Stored in localStorage, readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(getFavorites());
    setRecent(getRecent());
  }, []);

  const all = useMemo(() => [...ENTRIES, ...custom.map(customEntry)], [custom]);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all]);
  const results = useMemo(() => {
    let list: CatalogEntry[];
    if (category === "favorites")
      list = favorites.map((id) => byId.get(id)).filter((e): e is CatalogEntry => !!e);
    else list = searchCatalog(query, category ? { category } : {}, all);
    if (category === "favorites" && query) list = searchCatalog(query, {}, list);
    return showLife ? list : list.filter((e) => !e.life);
  }, [query, category, all, byId, favorites, showLife]);

  const quick = [...new Set([...favorites, ...recent])]
    .map((id) => byId.get(id))
    .filter((e): e is CatalogEntry => !!e)
    .slice(0, 8);

  const add = (entry: CatalogEntry) => {
    setRecent(addRecent(entry.id));
    onAdd(entry);
  };

  return (
    <div className="catalog">
      <label className="field">
        <span className="field-label">{t("catalog.search")}</span>
        <input
          className="input"
          type="search"
          value={query}
          placeholder={t("catalog.searchHint")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="chips" role="group" aria-label={t("catalog.categories")}>
        <button
          type="button"
          className="chip"
          aria-pressed={category === ""}
          onClick={() => setCategory("")}
        >
          {t("catalog.all")}
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={category === "favorites"}
          onClick={() => setCategory("favorites")}
        >
          {t("catalog.favorites")}
        </button>
        {CATEGORIES.filter((c) => c !== "custom" || custom.length).map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {t(`category.${c}` as MessageKey)}
          </button>
        ))}
      </div>
      {!query && category === "" && quick.length > 0 && (
        <section aria-label={t("catalog.quick")}>
          <h3 className="panel-subtitle">{t("catalog.quick")}</h3>
          <ul className="catalog-quick">
            {quick.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="quick-button"
                  onClick={() => add(e)}
                  aria-label={t("catalog.add", { name: e.name[locale] })}
                >
                  <EntryThumb entry={e} size={40} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted small" aria-live="polite">
        {t("catalog.count", { count: results.length })}
      </p>
      <ul className="catalog-list">
        {results.slice(0, 120).map((e) => {
          const fav = favorites.includes(e.id);
          return (
            <li
              key={e.id}
              className="catalog-row"
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData(CATALOG_DRAG_TYPE, e.id);
                ev.dataTransfer.effectAllowed = "copy";
              }}
            >
              <button
                type="button"
                className="catalog-add"
                onClick={() => add(e)}
                data-entry={e.id}
              >
                <EntryThumb entry={e} />
                <span className="catalog-name">
                  {e.name[locale]}
                  <span className="muted small">
                    {e.size.w} x {e.size.d} x {e.size.h} cm
                  </span>
                </span>
              </button>
              <IconButton
                icon="star"
                className={fav ? "is-fav" : ""}
                label={
                  fav
                    ? t("catalog.unfavorite", { name: e.name[locale] })
                    : t("catalog.favorite", { name: e.name[locale] })
                }
                pressed={fav}
                onClick={() => setFavorites(toggleFavorite(e.id))}
              />
            </li>
          );
        })}
      </ul>
      <Button icon="hammer" onClick={onBuildCustom}>
        {t("catalog.buildOwn")}
      </Button>
    </div>
  );
}
