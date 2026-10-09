#!/usr/bin/env bash
# Maakt labels, milestones en alle issues aan met de GitHub CLI.
# Gebruik:  ./create-issues.sh eigenaar/repo            (echt aanmaken)
#           DRY_RUN=1 ./create-issues.sh eigenaar/repo   (alleen tonen)
# Vereist: gh (ingelogd, `gh auth login`) en schrijfrechten op de repo.
set -euo pipefail
REPO="${1:?Gebruik: $0 eigenaar/repo}"
DRY="${DRY_RUN:-0}"
run() { if [ "$DRY" = "1" ]; then echo "[dry] $*"; else "$@"; fi; }

echo "Labels aanmaken..."
run gh label create "epic:E01" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E02" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E03" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E04" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E05" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E06" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E07" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E08" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E09" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E10" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E11" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "epic:E12" --color 5B7F6B --force -R "$REPO" >/dev/null
run gh label create "size:S" --color C9D6CF --force -R "$REPO" >/dev/null
run gh label create "size:M" --color A9BFB2 --force -R "$REPO" >/dev/null
run gh label create "size:L" --color 7E9C8B --force -R "$REPO" >/dev/null
run gh label create "size:XL" --color 4F6F5E --force -R "$REPO" >/dev/null
run gh label create "backlog" --color B08D57 --force -R "$REPO" >/dev/null

echo "Milestones aanmaken..."
run gh api -X POST "repos/$REPO/milestones" -f title="Fase 1: Fundament" >/dev/null 2>&1 || echo "  (milestone bestaat al: Fase 1: Fundament)"
run gh api -X POST "repos/$REPO/milestones" -f title="Fase 2: Kern" >/dev/null 2>&1 || echo "  (milestone bestaat al: Fase 2: Kern)"
run gh api -X POST "repos/$REPO/milestones" -f title="Fase 3: Uitbreiding" >/dev/null 2>&1 || echo "  (milestone bestaat al: Fase 3: Uitbreiding)"
run gh api -X POST "repos/$REPO/milestones" -f title="Fase 4: Afwerking" >/dev/null 2>&1 || echo "  (milestone bestaat al: Fase 4: Afwerking)"

echo "Issues aanmaken..."
TMP="$(mktemp)"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik een nette repo met Next.js, TypeScript en strikte linting, zodat het project schaalbaar blijft.

**Acceptatiecriteria**
- [ ] Next.js (App Router) met TypeScript strict en static export
- [ ] ESLint, Prettier en commit hooks werken
- [ ] README met setup, scripts en architectuurschets
- [ ] Mappenstructuur: /core (pure logica), /ui, /three, /catalog, /i18n

---
Epic: E01 Project setup & fundament · Maat: S · Fase 1: Fundament · Ref: E01-01
BODY_EOF
run gh issue create -R "$REPO" --title "E01-01 Repo en monorepo-structuur opzetten" --body-file "$TMP" --label "epic:E01,size:S,backlog" --milestone "Fase 1: Fundament" >/dev/null
echo "  ok: E01-01"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik dat GitHub Actions elke PR test, zodat er niets kapotgaat.

**Acceptatiecriteria**
- [ ] Workflow draait lint, typecheck en unit tests
- [ ] PR kan niet gemerged worden bij rood
- [ ] Node-versie en dependencies gecachet

---
Epic: E01 Project setup & fundament · Maat: S · Fase 1: Fundament · Ref: E01-02
BODY_EOF
run gh issue create -R "$REPO" --title "E01-02 CI: lint, typecheck en tests op elke PR" --body-file "$TMP" --label "epic:E01,size:S,backlog" --milestone "Fase 1: Fundament" >/dev/null
echo "  ok: E01-02"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik de app online openen via een vaste URL.

**Acceptatiecriteria**
- [ ] Merge naar main deployt automatisch
- [ ] Base path voor Pages werkt (assets, routes)
- [ ] Preview-build als artifact bij PR

---
Epic: E01 Project setup & fundament · Maat: S · Fase 1: Fundament · Ref: E01-03
BODY_EOF
run gh issue create -R "$REPO" --title "E01-03 Deploy naar GitHub Pages via Actions" --body-file "$TMP" --label "epic:E01,size:S,backlog" --milestone "Fase 1: Fundament" >/dev/null
echo "  ok: E01-03"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een rustige, consistente interface in mijn kleuren.

**Acceptatiecriteria**
- [ ] Design tokens voor kleur, spacing, radius, typografie
- [ ] Licht en donker thema
- [ ] Basiscomponenten: knop, input, tabs, kleurkiezer, modal, toast
- [ ] Contrast voldoet aan WCAG AA

---
Epic: E01 Project setup & fundament · Maat: M · Fase 1: Fundament · Ref: E01-04
BODY_EOF
run gh issue create -R "$REPO" --title "E01-04 Designsysteem en thema (salie, crème, messing)" --body-file "$TMP" --label "epic:E01,size:M,backlog" --milestone "Fase 1: Fundament" >/dev/null
echo "  ok: E01-04"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik één getypeerd datamodel met versienummer, zodat oude opslag later gemigreerd kan worden.

**Acceptatiecriteria**
- [ ] Types voor Project, Floor, Room, Wall, Opening, Fixture, Item, Style
- [ ] Schema-versie in elk project
- [ ] Migratiefuncties met tests
- [ ] Undo/redo-ready (immutable updates of patches)

---
Epic: E01 Project setup & fundament · Maat: M · Fase 1: Fundament · Ref: E01-05
BODY_EOF
run gh issue create -R "$REPO" --title "E01-05 State management en datamodel (versioned)" --body-file "$TMP" --label "epic:E01,size:M,backlog" --milestone "Fase 1: Fundament" >/dev/null
echo "  ok: E01-05"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik dat muren automatisch uit mijn kamers ontstaan.

**Acceptatiecriteria**
- [ ] Binnenmuren tussen kamers, buitenmuren aan de rand
- [ ] Loggia/balkon krijgt lage rand
- [ ] Dikte instelbaar (binnen/buiten)
- [ ] Unit tests met minstens 10 testplannen, incl. L-vormen

---
Epic: E02 Plattegrond-engine (core) · Maat: L · Fase 2: Kern · Ref: E02-06
BODY_EOF
run gh issue create -R "$REPO" --title "E02-06 Kamers rasteriseren en muren genereren" --body-file "$TMP" --label "epic:E02,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E02-06"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik deuren, ramen en glazen puien op een muur zetten en verschuiven.

**Acceptatiecriteria**
- [ ] Snappen aan muur, breedte en hoogte instelbaar
- [ ] Draairichting en scharnierkant van deuren
- [ ] Raamdorpel- en latei-hoogte instelbaar
- [ ] Opening verdwijnt netjes uit de muur in 2D en 3D

---
Epic: E02 Plattegrond-engine (core) · Maat: M · Fase 2: Kern · Ref: E02-07
BODY_EOF
run gh issue create -R "$REPO" --title "E02-07 Deuren en ramen op muren plaatsen" --body-file "$TMP" --label "epic:E02,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E02-07"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik vaste elementen plaatsen die niet per ongeluk verschuiven.

**Acceptatiecriteria**
- [ ] Types: keuken, koelkast, toilet, wastafel, douche, bad, kolom, trap, schoorsteen
- [ ] Vergrendeld door default, wel te ontgrendelen
- [ ] Maten instelbaar

---
Epic: E02 Plattegrond-engine (core) · Maat: M · Fase 2: Kern · Ref: E02-08
BODY_EOF
run gh issue create -R "$REPO" --title "E02-08 Vaste elementen (keuken, sanitair, trap, schouw)" --body-file "$TMP" --label "epic:E02,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E02-08"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik gewaarschuwd worden als iets niet past of de doorloop te smal is.

**Acceptatiecriteria**
- [ ] Overlap met muur of ander meubel is rood
- [ ] Doorloopbreedte-waarschuwing (instelbaar, standaard 80 cm)
- [ ] Deur-draaicirkel mag niet geblokkeerd worden
- [ ] Unit tests voor randgevallen (rotatie, ronde meubels)

---
Epic: E02 Plattegrond-engine (core) · Maat: M · Fase 2: Kern · Ref: E02-09
BODY_EOF
run gh issue create -R "$REPO" --title "E02-09 Collision- en afstandscontrole" --body-file "$TMP" --label "epic:E02,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E02-09"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik stappen ongedaan maken.

**Acceptatiecriteria**
- [ ] Ctrl/Cmd+Z en Shift+Z, knoppen op touch
- [ ] Minstens 100 stappen
- [ ] Slepen telt als één stap

---
Epic: E02 Plattegrond-engine (core) · Maat: M · Fase 2: Kern · Ref: E02-10
BODY_EOF
run gh issue create -R "$REPO" --title "E02-10 Undo/redo en geschiedenis" --body-file "$TMP" --label "epic:E02,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E02-10"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik afstanden meten en zien.

**Acceptatiecriteria**
- [ ] Meetlint-tool tussen twee punten
- [ ] Automatische maatlijnen bij selectie
- [ ] cm/inch-schakelaar werkt overal

---
Epic: E02 Plattegrond-engine (core) · Maat: S · Fase 3: Uitbreiding · Ref: E02-11
BODY_EOF
run gh issue create -R "$REPO" --title "E02-11 Meetfuncties en maatvoering" --body-file "$TMP" --label "epic:E02,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E02-11"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik soepel door mijn plattegrond navigeren.

**Acceptatiecriteria**
- [ ] Scrollwiel/pinch-zoom, slepen met spatie of twee vingers
- [ ] Raster en snap-to-grid instelbaar
- [ ] Minimap bij grote plannen
- [ ] 60 fps bij 150 items

---
Epic: E03 2D-editor · Maat: M · Fase 2: Kern · Ref: E03-12
BODY_EOF
run gh issue create -R "$REPO" --title "E03-12 SVG-canvas met zoomen, pannen en raster" --body-file "$TMP" --label "epic:E03,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E03-12"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik meubels direct manipuleren.

**Acceptatiecriteria**
- [ ] Handvatten voor draaien (15°-stappen, vrij met Alt) en formaat
- [ ] Meervoudige selectie met rechthoek of Shift
- [ ] Pijltjestoetsen verplaatsen 1 cm of 10 cm met Shift
- [ ] Dupliceren, verwijderen, groeperen

---
Epic: E03 2D-editor · Maat: L · Fase 2: Kern · Ref: E03-13
BODY_EOF
run gh issue create -R "$REPO" --title "E03-13 Selecteren, verslepen, draaien en schalen" --body-file "$TMP" --label "epic:E03,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E03-13"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik categorieën verbergen of vergrendelen.

**Acceptatiecriteria**
- [ ] Lagen: meubels, decoratie, verlichting, maatvoering, elektra
- [ ] Oog- en slotje per laag
- [ ] Staat wordt bewaard in project

---
Epic: E03 2D-editor · Maat: S · Fase 3: Uitbreiding · Ref: E03-14
BODY_EOF
run gh issue create -R "$REPO" --title "E03-14 Lagen en zichtbaarheid" --body-file "$TMP" --label "epic:E03,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E03-14"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik naam en m² per kamer zien.

**Acceptatiecriteria**
- [ ] Naam en oppervlakte (m² of sqft) automatisch
- [ ] Labels verplaatsbaar en te verbergen

---
Epic: E03 2D-editor · Maat: S · Fase 2: Kern · Ref: E03-15
BODY_EOF
run gh issue create -R "$REPO" --title "E03-15 Kamerlabels, oppervlakte en legenda" --body-file "$TMP" --label "epic:E03,size:S,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E03-15"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik snel kunnen werken.

**Acceptatiecriteria**
- [ ] Rechtermuisknop-menu op elk object
- [ ] Sneltoetsoverzicht met ?
- [ ] Alle sneltoetsen configureerbaar-ready

---
Epic: E03 2D-editor · Maat: S · Fase 3: Uitbreiding · Ref: E03-16
BODY_EOF
run gh issue create -R "$REPO" --title "E03-16 Contextmenu en sneltoetsen" --body-file "$TMP" --label "epic:E03,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E03-16"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik mijn plan in 3D zien.

**Acceptatiecriteria**
- [ ] Muren op plafondhoogte per verdieping
- [ ] Openingen in muren voor deuren en ramen
- [ ] OrbitControls met sane limieten
- [ ] Resize en devicePixelRatio correct

---
Epic: E04 3D-weergave · Maat: L · Fase 2: Kern · Ref: E04-17
BODY_EOF
run gh issue create -R "$REPO" --title "E04-17 Basisscène: muren, vloeren, plafond, verlichting" --body-file "$TMP" --label "epic:E04,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E04-17"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik snel tussen standpunten schakelen.

**Acceptatiecriteria**
- [ ] Bovenaanzicht, per kamer, vogelvlucht
- [ ] Dollhouse: muren aan de camerakant transparant
- [ ] Soepele camera-overgangen

---
Epic: E04 3D-weergave · Maat: M · Fase 3: Uitbreiding · Ref: E04-18
BODY_EOF
run gh issue create -R "$REPO" --title "E04-18 Camerastandpunten en dollhouse-modus" --body-file "$TMP" --label "epic:E04,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E04-18"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik door mijn huis lopen.

**Acceptatiecriteria**
- [ ] WASD/pijltjes en muis, op touch virtuele joystick
- [ ] Oogniveau instelbaar (standaard 160 cm)
- [ ] Botsing met muren, trap werkt tussen verdiepingen
- [ ] Knop om terug te gaan naar overzicht

---
Epic: E04 3D-weergave · Maat: L · Fase 3: Uitbreiding · Ref: E04-19
BODY_EOF
run gh issue create -R "$REPO" --title "E04-19 Rondleiding in eerste persoon" --body-file "$TMP" --label "epic:E04,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E04-19"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker op een oude telefoon wil ik kunnen kiezen voor lichte weergave.

**Acceptatiecriteria**
- [ ] Presets laag/midden/hoog (schaduw, textures, details)
- [ ] Automatische detectie bij trage framerate
- [ ] Meshes en textures worden hergebruikt (instancing/caching)
- [ ] Geen geheugenlek bij wisselen van plan

---
Epic: E04 3D-weergave · Maat: M · Fase 3: Uitbreiding · Ref: E04-20
BODY_EOF
run gh issue create -R "$REPO" --title "E04-20 Prestatie-instellingen en details-schakelaar" --body-file "$TMP" --label "epic:E04,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E04-20"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik zien hoe mijn huis 's avonds voelt.

**Acceptatiecriteria**
- [ ] Zonstand en daglicht via ramen (richting instelbaar)
- [ ] Avondmodus met lampen als lichtbronnen
- [ ] Maximaal aantal lichten met slimme prioritering
- [ ] Schaduwen aan/uit

---
Epic: E04 3D-weergave · Maat: L · Fase 3: Uitbreiding · Ref: E04-21
BODY_EOF
run gh issue create -R "$REPO" --title "E04-21 Dag/avond-verlichting met echte lampen" --body-file "$TMP" --label "epic:E04,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E04-21"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik in 3D op een object klikken en het aanpassen.

**Acceptatiecriteria**
- [ ] Raycast-selectie met highlight
- [ ] Zijpaneel toont dezelfde opties als 2D
- [ ] Verslepen over de vloer in 3D

---
Epic: E04 3D-weergave · Maat: M · Fase 3: Uitbreiding · Ref: E04-22
BODY_EOF
run gh issue create -R "$REPO" --title "E04-22 Selecteren en bewerken vanuit 3D" --body-file "$TMP" --label "epic:E04,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E04-22"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een huis met meerdere verdiepingen in één project.

**Acceptatiecriteria**
- [ ] Tabs of lijst met verdiepingen, volgorde aanpasbaar
- [ ] Eigen plafondhoogte per verdieping
- [ ] Ghost-weergave van de verdieping eronder in 2D

---
Epic: E05 Meerdere verdiepingen & trappen · Maat: M · Fase 2: Kern · Ref: E05-23
BODY_EOF
run gh issue create -R "$REPO" --title "E05-23 Verdiepingen toevoegen, ordenen en hernoemen" --body-file "$TMP" --label "epic:E05,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E05-23"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik dat een trap op beide verdiepingen klopt.

**Acceptatiecriteria**
- [ ] Rechte, haakse en wenteltrap
- [ ] Gat in vloer/plafond op de bovenverdieping automatisch
- [ ] Waarschuwing bij onrealistische stijgingshoek

---
Epic: E05 Meerdere verdiepingen & trappen · Maat: L · Fase 3: Uitbreiding · Ref: E05-24
BODY_EOF
run gh issue create -R "$REPO" --title "E05-24 Trappen verbinden verdiepingen" --body-file "$TMP" --label "epic:E05,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E05-24"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik het hele huis zien.

**Acceptatiecriteria**
- [ ] Schakelaar: één verdieping, alles, uit elkaar
- [ ] Verdiepingen één voor één te verbergen

---
Epic: E05 Meerdere verdiepingen & trappen · Maat: M · Fase 3: Uitbreiding · Ref: E05-25
BODY_EOF
run gh issue create -R "$REPO" --title "E05-25 Hele huis in 3D met verdiepingen gestapeld" --body-file "$TMP" --label "epic:E05,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E05-25"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik één foto met twee plattegronden in één keer inladen.

**Acceptatiecriteria**
- [ ] AI splitst per verdieping
- [ ] Trappen worden herkend en gekoppeld
- [ ] Gebruiker kan resultaat per verdieping controleren

---
Epic: E05 Meerdere verdiepingen & trappen · Maat: L · Fase 3: Uitbreiding · Ref: E05-26
BODY_EOF
run gh issue create -R "$REPO" --title "E05-26 Meerdere verdiepingen importeren uit één afbeelding" --body-file "$TMP" --label "epic:E05,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E05-26"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik zonder foto een plattegrond tekenen.

**Acceptatiecriteria**
- [ ] Muur-tool met snap op hoeken (0/45/90°) en lengte-invoer
- [ ] Kamers worden automatisch herkend uit gesloten muren
- [ ] Muur verplaatsen of verlengen met handvatten

---
Epic: E06 Plattegrond zelf tekenen en verbouwen · Maat: XL · Fase 3: Uitbreiding · Ref: E06-27
BODY_EOF
run gh issue create -R "$REPO" --title "E06-27 Muren tekenen met de muis of vinger" --body-file "$TMP" --label "epic:E06,size:XL,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E06-27"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik snel een kamer neerzetten.

**Acceptatiecriteria**
- [ ] Rechthoek-, L- en vrije polygoontool
- [ ] Vertex bewerken
- [ ] Kamertype kiezen

---
Epic: E06 Plattegrond zelf tekenen en verbouwen · Maat: M · Fase 3: Uitbreiding · Ref: E06-28
BODY_EOF
run gh issue create -R "$REPO" --title "E06-28 Kamer tekenen met rechthoeken en polygonen" --body-file "$TMP" --label "epic:E06,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E06-28"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik virtueel een muur weghalen of een doorgang maken.

**Acceptatiecriteria**
- [ ] Muur selecteren en 'slopen' of 'doorbraak' met breedte
- [ ] Scenario's naast elkaar vergelijken (huidig/verbouwd)
- [ ] Dragende muur-markering als waarschuwing

---
Epic: E06 Plattegrond zelf tekenen en verbouwen · Maat: L · Fase 4: Afwerking · Ref: E06-29
BODY_EOF
run gh issue create -R "$REPO" --title "E06-29 Muren slopen en doorbraken (verbouwscenario)" --body-file "$TMP" --label "epic:E06,size:L,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E06-29"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een foto/plattegrond onder mijn tekening leggen.

**Acceptatiecriteria**
- [ ] Uploaden, schalen met referentielijn, transparantie
- [ ] Wordt mee opgeslagen of apart gehouden (keuze)

---
Epic: E06 Plattegrond zelf tekenen en verbouwen · Maat: M · Fase 3: Uitbreiding · Ref: E06-30
BODY_EOF
run gh issue create -R "$REPO" --title "E06-30 Achtergrondafbeelding als tekenhulp" --body-file "$TMP" --label "epic:E06,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E06-30"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik plannen als tekst kunnen kopiëren en plakken.

**Acceptatiecriteria**
- [ ] Eén plan of lijst van plannen
- [ ] Validatie met duidelijke foutmeldingen (regel/veld)
- [ ] Schema is gedocumenteerd en versioned
- [ ] Roundtrip-test: export, import levert identiek plan

---
Epic: E07 Plattegrond importeren · Maat: M · Fase 2: Kern · Ref: E07-31
BODY_EOF
run gh issue create -R "$REPO" --title "E07-31 Plan-code importeren en exporteren (JSON)" --body-file "$TMP" --label "epic:E07,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E07-31"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een afbeelding uploaden en automatisch een plan krijgen.

**Acceptatiecriteria**
- [ ] Instellingen-scherm voor API-key, key staat alleen lokaal
- [ ] Upload van foto/PDF, voortgang en annuleren
- [ ] Resultaat volgt het plan-schema en wordt gevalideerd
- [ ] Duidelijke uitleg over kosten en privacy
- [ ] Fallback als key ontbreekt: uitleg + handmatige route

---
Epic: E07 Plattegrond importeren · Maat: XL · Fase 3: Uitbreiding · Ref: E07-32
BODY_EOF
run gh issue create -R "$REPO" --title "E07-32 AI-plattegrondlezer met eigen API-key" --body-file "$TMP" --label "epic:E07,size:XL,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E07-32"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik de herkende kamers kunnen corrigeren.

**Acceptatiecriteria**
- [ ] Overlay van het origineel over het resultaat
- [ ] Kamers, deuren en ramen te verslepen/hernoemen
- [ ] Schaalcontrole met één bekende maat (bv. deurbreedte)

---
Epic: E07 Plattegrond importeren · Maat: L · Fase 3: Uitbreiding · Ref: E07-33
BODY_EOF
run gh issue create -R "$REPO" --title "E07-33 Controle-stap na AI-import" --body-file "$TMP" --label "epic:E07,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E07-33"
cat > "$TMP" <<'BODY_EOF'
Als nieuwe gebruiker wil ik meteen kunnen spelen.

**Acceptatiecriteria**
- [ ] Minstens 3 voorbeelden (appartement, rijtjeshuis, twee verdiepingen)
- [ ] Kiezen bij eerste start

---
Epic: E07 Plattegrond importeren · Maat: S · Fase 3: Uitbreiding · Ref: E07-34
BODY_EOF
run gh issue create -R "$REPO" --title "E07-34 Voorbeeldplattegronden meeleveren" --body-file "$TMP" --label "epic:E07,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E07-34"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik meubels als data definiëren, zodat uitbreiden eenvoudig is.

**Acceptatiecriteria**
- [ ] Item-definitie: categorie, standaardmaat, min/max, materialen, ankers (muur/ondersteuning), bouwfunctie
- [ ] Catalogus valideert met schema bij build
- [ ] Zoeken op naam, categorie, tag en maat

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 2: Kern · Ref: E08-35
BODY_EOF
run gh issue create -R "$REPO" --title "E08-35 Catalogusarchitectuur en data-formaat" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E08-35"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik veel soorten banken en stoelen.

**Acceptatiecriteria**
- [ ] Banken 2/3/4-zits, hoek, U-vorm, chesterfield, slaapbank dicht/open
- [ ] Fauteuils, poefs, krukken, bankjes, hangstoel, chaise longue
- [ ] Alle maten aanpasbaar, kleur en stof kiesbaar

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: L · Fase 2: Kern · Ref: E08-36
BODY_EOF
run gh issue create -R "$REPO" --title "E08-36 Zitmeubels (30+ varianten)" --body-file "$TMP" --label "epic:E08,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E08-36"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik tafels voor elke ruimte.

**Acceptatiecriteria**
- [ ] Eettafels 4-10 personen, rond, ovaal, uitschuifbaar
- [ ] Salontafels, bijzettafels, bartafel
- [ ] Stoelen in 6+ stijlen, banken voor aan tafel

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 2: Kern · Ref: E08-37
BODY_EOF
run gh issue create -R "$REPO" --title "E08-37 Tafels en eetkamer (20+)" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E08-37"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik bedden en bijpassende meubels.

**Acceptatiecriteria**
- [ ] Bedden 80 tot 200 breed, boxspring, hemelbed, stapelbed, opbergbed
- [ ] Nachtkastjes, kleerkasten (schuif/draai), kaptafel, commode
- [ ] Bed met bedlinnen in kleur

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 2: Kern · Ref: E08-38
BODY_EOF
run gh issue create -R "$REPO" --title "E08-38 Slaapkamer (20+)" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E08-38"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik grote en dubbele werkplekken.

**Acceptatiecriteria**
- [ ] Bureaus tot 240 cm, hoekbureau, zit-sta, naast elkaar
- [ ] Stoelen, monitoren, laptop, printer, rekken

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 3: Uitbreiding · Ref: E08-39
BODY_EOF
run gh issue create -R "$REPO" --title "E08-39 Werkplek en studeerkamer (15+)" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-39"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik kasten en planken.

**Acceptatiecriteria**
- [ ] Boekenkasten, vitrinekast, dressoir, tv-meubel, schoenenkast, kapstok
- [ ] Modulaire kastenwand met verstelbare vakken
- [ ] Wandplanken en zwevende meubels met ophanghoogte

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: L · Fase 3: Uitbreiding · Ref: E08-40
BODY_EOF
run gh issue create -R "$REPO" --title "E08-40 Opbergen en wandmeubels (25+)" --body-file "$TMP" --label "epic:E08,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-40"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik keuken en badkamer inrichten.

**Acceptatiecriteria**
- [ ] Keukenblokken en eilanden modulair (onderkast, bovenkast, hoek)
- [ ] Wasmachine, droger, vaatwasser, koelkast, oven op juiste plek
- [ ] Badkamermeubels, wastafels, douches, bad, toilet
- [ ] Aansluitingen (water/afvoer) als markering

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: L · Fase 3: Uitbreiding · Ref: E08-41
BODY_EOF
run gh issue create -R "$REPO" --title "E08-41 Keuken, bad en witgoed (25+)" --body-file "$TMP" --label "epic:E08,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-41"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik mijn huis sfeer geven.

**Acceptatiecriteria**
- [ ] Planten in 10+ soorten, vazen, bloemen, kaarsen, boeken, schilderijen, spiegels
- [ ] Kleden, gordijnen, kussens, dekens, plaids
- [ ] Kleine items komen automatisch bovenop een oppervlak

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: L · Fase 3: Uitbreiding · Ref: E08-42
BODY_EOF
run gh issue create -R "$REPO" --title "E08-42 Decoratie, planten en textiel (50+)" --body-file "$TMP" --label "epic:E08,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-42"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik lampen die echt licht geven.

**Acceptatiecriteria**
- [ ] Plafond-, hang-, wand-, vloer-, tafel-, kroonluchter
- [ ] Kleur, helderheid en aan/uit per lamp
- [ ] Beïnvloedt avondmodus in 3D

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 3: Uitbreiding · Ref: E08-43
BODY_EOF
run gh issue create -R "$REPO" --title "E08-43 Verlichting (20+)" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-43"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik levendige details.

**Acceptatiecriteria**
- [ ] Gedekte tafel met couverts en eten, wasmand, schoenen, jassen, speelgoed
- [ ] Schakelaar om alle 'leven' in één keer uit te zetten

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: M · Fase 4: Afwerking · Ref: E08-44
BODY_EOF
run gh issue create -R "$REPO" --title "E08-44 Alledaagse scènes (gedekte tafel, wasmand, etc.)" --body-file "$TMP" --label "epic:E08,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E08-44"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een meubel op maat samenstellen.

**Acceptatiecriteria**
- [ ] Basisvormen combineren (blok, cilinder, plaat, poot)
- [ ] Opslaan als eigen item in de catalogus
- [ ] Exporteren en importeren van eigen items

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: XL · Fase 4: Afwerking · Ref: E08-45
BODY_EOF
run gh issue create -R "$REPO" --title "E08-45 Eigen meubel bouwen (parametrisch)" --body-file "$TMP" --label "epic:E08,size:XL,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E08-45"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik snel bij mijn vaste items.

**Acceptatiecriteria**
- [ ] Ster-markering, sectie bovenaan
- [ ] Wordt lokaal bewaard

---
Epic: E08 Meubelcatalogus (breed, generiek) · Maat: S · Fase 3: Uitbreiding · Ref: E08-46
BODY_EOF
run gh issue create -R "$REPO" --title "E08-46 Favorieten en recent gebruikt" --body-file "$TMP" --label "epic:E08,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E08-46"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik mijn eigen paletten bewaren.

**Acceptatiecriteria**
- [ ] Palet-snelkeuze (salie, olijf-greige, crème, messing, donker hout)
- [ ] Vrije kleur via hex en picker
- [ ] Eigen paletten opslaan, hernoemen, delen via code

---
Epic: E09 Stijl, kleur en materialen · Maat: M · Fase 2: Kern · Ref: E09-47
BODY_EOF
run gh issue create -R "$REPO" --title "E09-47 Kleurkiezer met palet en vrije kleur" --body-file "$TMP" --label "epic:E09,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E09-47"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik de vloer per kamer instellen.

**Acceptatiecriteria**
- [ ] Patronen: rechte planken, visgraat, Hongaarse punt, schaakbord, tegels
- [ ] Kleur, voegkleur, plankbreedte instelbaar
- [ ] Procedurele textures, geen zware bestanden

---
Epic: E09 Stijl, kleur en materialen · Maat: L · Fase 2: Kern · Ref: E09-48
BODY_EOF
run gh issue create -R "$REPO" --title "E09-48 Vloeren: hout, visgraat, tegels, terrazzo, tapijt" --body-file "$TMP" --label "epic:E09,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E09-48"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik wandafwerking kiezen.

**Acceptatiecriteria**
- [ ] Verf, behang (botanisch, streep, toile), kalk, baksteen
- [ ] Panelen: Frans kaderwerk, lambrisering, beadboard, shaker, neoklassiek
- [ ] Paneelhoogte en kleur apart

---
Epic: E09 Stijl, kleur en materialen · Maat: L · Fase 2: Kern · Ref: E09-49
BODY_EOF
run gh issue create -R "$REPO" --title "E09-49 Wanden: verf, behang en panelen per kamer" --body-file "$TMP" --label "epic:E09,size:L,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E09-49"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik één muur een eigen look geven.

**Acceptatiecriteria**
- [ ] Muur klikken in 2D of 3D
- [ ] Overschrijft kamerinstelling, 'terug naar kamerstijl' knop
- [ ] Beide zijden van een muur apart

---
Epic: E09 Stijl, kleur en materialen · Maat: M · Fase 2: Kern · Ref: E09-50
BODY_EOF
run gh issue create -R "$REPO" --title "E09-50 Elke muur apart aanpasbaar" --body-file "$TMP" --label "epic:E09,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E09-50"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik de details afwerken.

**Acceptatiecriteria**
- [ ] Plafondkleur, rozet, kroonlijst
- [ ] Plinthoogte en -stijl
- [ ] Deurlijsten en raamkozijnen met kleur

---
Epic: E09 Stijl, kleur en materialen · Maat: M · Fase 3: Uitbreiding · Ref: E09-51
BODY_EOF
run gh issue create -R "$REPO" --title "E09-51 Plafond, sierlijsten en plinten" --body-file "$TMP" --label "epic:E09,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E09-51"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik met één klik een complete stijl.

**Acceptatiecriteria**
- [ ] Presets o.a. Frans landelijk, neoklassiek, romantisch, Japandi, Scandinavisch, art deco
- [ ] Preview-miniatuur per preset
- [ ] Toepassen op hele huis of alleen geselecteerde kamer
- [ ] Willekeurige combinatie binnen een gekozen palet

---
Epic: E09 Stijl, kleur en materialen · Maat: L · Fase 3: Uitbreiding · Ref: E09-52
BODY_EOF
run gh issue create -R "$REPO" --title "E09-52 Stijlpresets (20+) en 'Verras me'" --body-file "$TMP" --label "epic:E09,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E09-52"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik varianten naast elkaar.

**Acceptatiecriteria**
- [ ] Opslaan als benoemde look
- [ ] Voor/na-schuifbalk in 3D

---
Epic: E09 Stijl, kleur en materialen · Maat: M · Fase 4: Afwerking · Ref: E09-53
BODY_EOF
run gh issue create -R "$REPO" --title "E09-53 Looks opslaan en vergelijken" --body-file "$TMP" --label "epic:E09,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E09-53"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik meerdere huizen/ideeën bewaren.

**Acceptatiecriteria**
- [ ] Projectoverzicht met miniatuur, hernoemen, dupliceren, verwijderen
- [ ] Opslag in IndexedDB (niet localStorage-limiet)
- [ ] Autosave met laatste-opgeslagen-indicator

---
Epic: E10 Projecten, opslag en export · Maat: M · Fase 2: Kern · Ref: E10-54
BODY_EOF
run gh issue create -R "$REPO" --title "E10-54 Meerdere projecten lokaal beheren" --body-file "$TMP" --label "epic:E10,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E10-54"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik back-ups maken en delen.

**Acceptatiecriteria**
- [ ] Download als .json (of .zip bij afbeeldingen)
- [ ] Import met validatie en migratie
- [ ] Waarschuwing bij overschrijven

---
Epic: E10 Projecten, opslag en export · Maat: M · Fase 2: Kern · Ref: E10-55
BODY_EOF
run gh issue create -R "$REPO" --title "E10-55 Export en import van projectbestand" --body-file "$TMP" --label "epic:E10,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E10-55"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik een plattegrond kunnen printen of delen.

**Acceptatiecriteria**
- [ ] PNG van 2D en 3D, hoge resolutie
- [ ] PDF met schaal (1:50, 1:100) en maatvoering
- [ ] Meubellijst in export

---
Epic: E10 Projecten, opslag en export · Maat: M · Fase 3: Uitbreiding · Ref: E10-56
BODY_EOF
run gh issue create -R "$REPO" --title "E10-56 Afbeelding- en PDF-export" --body-file "$TMP" --label "epic:E10,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E10-56"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik weten wat ik allemaal nodig heb.

**Acceptatiecriteria**
- [ ] Lijst per kamer met aantallen en maten
- [ ] Optioneel eigen prijs per item en totaal
- [ ] Export als CSV

---
Epic: E10 Projecten, opslag en export · Maat: M · Fase 4: Afwerking · Ref: E10-57
BODY_EOF
run gh issue create -R "$REPO" --title "E10-57 Meubellijst en inventaris" --body-file "$TMP" --label "epic:E10,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E10-57"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik niet per ongeluk alles kwijtraken.

**Acceptatiecriteria**
- [ ] Waarschuwing bij wissen van browserdata en link naar export
- [ ] Automatische back-up-herinnering na X wijzigingen
- [ ] Herstel van laatste werkende versie bij corrupte data

---
Epic: E10 Projecten, opslag en export · Maat: S · Fase 3: Uitbreiding · Ref: E10-58
BODY_EOF
run gh issue create -R "$REPO" --title "E10-58 Verloren data voorkomen" --body-file "$TMP" --label "epic:E10,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E10-58"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik op telefoon en tablet kunnen werken.

**Acceptatiecriteria**
- [ ] Inklapbare zijbalk, onderbalk op mobiel
- [ ] Pinch-zoom, twee-vingers pannen, grote tapdoelen (min 44px)
- [ ] Geen horizontale scroll

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: L · Fase 3: Uitbreiding · Ref: E11-59
BODY_EOF
run gh issue create -R "$REPO" --title "E11-59 Responsive layout en touch-bediening" --body-file "$TMP" --label "epic:E11,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E11-59"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik de app in mijn taal.

**Acceptatiecriteria**
- [ ] i18n-bibliotheek, alle teksten in vertaalbestanden
- [ ] Taal kiezen en onthouden, browsertaal als default
- [ ] Catalogusnamen vertaald
- [ ] Lint op ontbrekende vertalingen

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: M · Fase 3: Uitbreiding · Ref: E11-60
BODY_EOF
run gh issue create -R "$REPO" --title "E11-60 Meertalig: Nederlands en Engels" --body-file "$TMP" --label "epic:E11,size:M,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E11-60"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik mijn eigen eenheid.

**Acceptatiecriteria**
- [ ] Wisselen zonder dataverlies (intern altijd cm)
- [ ] Alle invoervelden en maatvoering volgen de keuze
- [ ] Unit tests voor conversie en afronding

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: S · Fase 3: Uitbreiding · Ref: E11-61
BODY_EOF
run gh issue create -R "$REPO" --title "E11-61 Eenheden: cm, mm, inch en voet" --body-file "$TMP" --label "epic:E11,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E11-61"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker met beperking wil ik de app kunnen gebruiken.

**Acceptatiecriteria**
- [ ] Volledig bedienbaar met toetsenbord (zijbalk, dialogen)
- [ ] ARIA-labels en focusindicatoren
- [ ] Reduced-motion respecteren
- [ ] Kleurenblind-veilige foutmarkering (niet alleen rood)

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: M · Fase 4: Afwerking · Ref: E11-62
BODY_EOF
run gh issue create -R "$REPO" --title "E11-62 Toegankelijkheid" --body-file "$TMP" --label "epic:E11,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E11-62"
cat > "$TMP" <<'BODY_EOF'
Als nieuwe gebruiker wil ik snel snappen hoe het werkt.

**Acceptatiecriteria**
- [ ] Korte rondleiding bij eerste start (overslaanbaar)
- [ ] Contextuele tips en lege-staat-uitleg
- [ ] Help-pagina met sneltoetsen

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: M · Fase 4: Afwerking · Ref: E11-63
BODY_EOF
run gh issue create -R "$REPO" --title "E11-63 Onboarding en hulp" --body-file "$TMP" --label "epic:E11,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E11-63"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik voorkeuren op één plek.

**Acceptatiecriteria**
- [ ] Taal, eenheid, thema, kwaliteit, API-key, autosave
- [ ] Reset naar standaard

---
Epic: E11 Interface, toegankelijkheid en internationalisatie · Maat: S · Fase 3: Uitbreiding · Ref: E11-64
BODY_EOF
run gh issue create -R "$REPO" --title "E11-64 Instellingen-scherm" --body-file "$TMP" --label "epic:E11,size:S,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E11-64"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik vertrouwen in de plattegrondlogica.

**Acceptatiecriteria**
- [ ] Dekking >= 85% op /core
- [ ] Fixtures met echte plannen (inclusief L-vormen en twee verdiepingen)
- [ ] Property-tests voor geometrie (willekeurige rechthoeken)

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: M · Fase 2: Kern · Ref: E12-65
BODY_EOF
run gh issue create -R "$REPO" --title "E12-65 Unit tests voor core-logica" --body-file "$TMP" --label "epic:E12,size:M,backlog" --milestone "Fase 2: Kern" >/dev/null
echo "  ok: E12-65"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik dat belangrijke flows automatisch getest worden.

**Acceptatiecriteria**
- [ ] Flows: plan importeren, meubel plaatsen, stijl wisselen, exporteren, 3D laden
- [ ] Draait in CI op Chromium en WebKit
- [ ] Screenshots als artifact bij falen

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: L · Fase 3: Uitbreiding · Ref: E12-66
BODY_EOF
run gh issue create -R "$REPO" --title "E12-66 End-to-end tests met Playwright" --body-file "$TMP" --label "epic:E12,size:L,backlog" --milestone "Fase 3: Uitbreiding" >/dev/null
echo "  ok: E12-66"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik zien als een render ongemerkt verandert.

**Acceptatiecriteria**
- [ ] Referentie-screenshots per voorbeeldplan
- [ ] Tolerantie voor GPU-verschillen
- [ ] Update-commando documenteren

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: M · Fase 4: Afwerking · Ref: E12-67
BODY_EOF
run gh issue create -R "$REPO" --title "E12-67 Visuele regressietests voor 2D en 3D" --body-file "$TMP" --label "epic:E12,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E12-67"
cat > "$TMP" <<'BODY_EOF'
Als ontwikkelaar wil ik dat de app snel blijft.

**Acceptatiecriteria**
- [ ] Bundlegrootte-budget in CI
- [ ] Lighthouse-check op de homepage
- [ ] Lazy loading van three.js en catalogus

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: M · Fase 4: Afwerking · Ref: E12-68
BODY_EOF
run gh issue create -R "$REPO" --title "E12-68 Prestatiebudget en monitoring" --body-file "$TMP" --label "epic:E12,size:M,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E12-68"
cat > "$TMP" <<'BODY_EOF'
Als gebruiker wil ik begrijpelijke fouten.

**Acceptatiecriteria**
- [ ] Error boundary met herstelknop en export-nood-optie
- [ ] Geen stille fouten bij import
- [ ] Optioneel anoniem foutrapport (uit by default)

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: S · Fase 4: Afwerking · Ref: E12-69
BODY_EOF
run gh issue create -R "$REPO" --title "E12-69 Foutafhandeling en logging" --body-file "$TMP" --label "epic:E12,size:S,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E12-69"
cat > "$TMP" <<'BODY_EOF'
Als bijdrager wil ik snel kunnen starten.

**Acceptatiecriteria**
- [ ] CONTRIBUTING, architectuurdoc, catalogus-uitbreiden-gids
- [ ] Issue- en PR-templates
- [ ] Licentie gekozen

---
Epic: E12 Kwaliteit, tests en onderhoud · Maat: S · Fase 4: Afwerking · Ref: E12-70
BODY_EOF
run gh issue create -R "$REPO" --title "E12-70 Documentatie en bijdragen" --body-file "$TMP" --label "epic:E12,size:S,backlog" --milestone "Fase 4: Afwerking" >/dev/null
echo "  ok: E12-70"

rm -f "$TMP"
echo "Klaar: 70 issues."
