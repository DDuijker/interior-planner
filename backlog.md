# Backlog: interieurplanner

Stack: Next.js + TypeScript (static export), three.js, SVG, IndexedDB. Hosting: GitHub Pages. Geen backend. AI-plattegrondlezer met eigen API-key van de gebruiker.
Taal: NL + EN. Eenheden: cm, mm, inch, voet. Tests: unit (core), Playwright (e2e), CI via GitHub Actions.

Maat: S = ~1 dag, M = 2-3 dagen, L = ~1 week, XL = 1,5-2 weken (grove schatting voor één ontwikkelaar).

## Overzicht

| Epic | Issues | Punten |
|---|---|---|
| E01 Project setup & fundament | 5 | 9 |
| E02 Plattegrond-engine (core) | 6 | 18 |
| E03 2D-editor | 5 | 11 |
| E04 3D-weergave | 6 | 24 |
| E05 Meerdere verdiepingen & trappen | 4 | 16 |
| E06 Plattegrond zelf tekenen en verbouwen | 4 | 19 |
| E07 Plattegrond importeren | 4 | 17 |
| E08 Meubelcatalogus (breed, generiek) | 12 | 47 |
| E09 Stijl, kleur en materialen | 7 | 27 |
| E10 Projecten, opslag en export | 5 | 13 |
| E11 Interface, toegankelijkheid en internationalisatie | 6 | 16 |
| E12 Kwaliteit, tests en onderhoud | 6 | 16 |
| **Totaal** | **70** | **233** |

## Fases

- **Fase 1: Fundament**: 5 issues, 9 punten
- **Fase 2: Kern**: 22 issues, 76 punten
- **Fase 3: Uitbreiding**: 32 issues, 112 punten
- **Fase 4: Afwerking**: 11 issues, 36 punten

---

## E01: Project setup & fundament

### E01-01 Repo en monorepo-structuur opzetten
*Fase 1: Fundament · maat S*

Als ontwikkelaar wil ik een nette repo met Next.js, TypeScript en strikte linting, zodat het project schaalbaar blijft.

**Acceptatiecriteria**
- [ ] Next.js (App Router) met TypeScript strict en static export
- [ ] ESLint, Prettier en commit hooks werken
- [ ] README met setup, scripts en architectuurschets
- [ ] Mappenstructuur: /core (pure logica), /ui, /three, /catalog, /i18n

### E01-02 CI: lint, typecheck en tests op elke PR
*Fase 1: Fundament · maat S*

Als ontwikkelaar wil ik dat GitHub Actions elke PR test, zodat er niets kapotgaat.

**Acceptatiecriteria**
- [ ] Workflow draait lint, typecheck en unit tests
- [ ] PR kan niet gemerged worden bij rood
- [ ] Node-versie en dependencies gecachet

### E01-03 Deploy naar GitHub Pages via Actions
*Fase 1: Fundament · maat S*

Als gebruiker wil ik de app online openen via een vaste URL.

**Acceptatiecriteria**
- [ ] Merge naar main deployt automatisch
- [ ] Base path voor Pages werkt (assets, routes)
- [ ] Preview-build als artifact bij PR

### E01-04 Designsysteem en thema (salie, crème, messing)
*Fase 1: Fundament · maat M*

Als gebruiker wil ik een rustige, consistente interface in mijn kleuren.

**Acceptatiecriteria**
- [ ] Design tokens voor kleur, spacing, radius, typografie
- [ ] Licht en donker thema
- [ ] Basiscomponenten: knop, input, tabs, kleurkiezer, modal, toast
- [ ] Contrast voldoet aan WCAG AA

### E01-05 State management en datamodel (versioned)
*Fase 1: Fundament · maat M*

Als ontwikkelaar wil ik één getypeerd datamodel met versienummer, zodat oude opslag later gemigreerd kan worden.

**Acceptatiecriteria**
- [ ] Types voor Project, Floor, Room, Wall, Opening, Fixture, Item, Style
- [ ] Schema-versie in elk project
- [ ] Migratiefuncties met tests
- [ ] Undo/redo-ready (immutable updates of patches)

## E02: Plattegrond-engine (core)

### E02-06 Kamers rasteriseren en muren genereren
*Fase 2: Kern · maat L*

Als gebruiker wil ik dat muren automatisch uit mijn kamers ontstaan.

**Acceptatiecriteria**
- [ ] Binnenmuren tussen kamers, buitenmuren aan de rand
- [ ] Loggia/balkon krijgt lage rand
- [ ] Dikte instelbaar (binnen/buiten)
- [ ] Unit tests met minstens 10 testplannen, incl. L-vormen

### E02-07 Deuren en ramen op muren plaatsen
*Fase 2: Kern · maat M*

Als gebruiker wil ik deuren, ramen en glazen puien op een muur zetten en verschuiven.

**Acceptatiecriteria**
- [ ] Snappen aan muur, breedte en hoogte instelbaar
- [ ] Draairichting en scharnierkant van deuren
- [ ] Raamdorpel- en latei-hoogte instelbaar
- [ ] Opening verdwijnt netjes uit de muur in 2D en 3D

### E02-08 Vaste elementen (keuken, sanitair, trap, schouw)
*Fase 2: Kern · maat M*

Als gebruiker wil ik vaste elementen plaatsen die niet per ongeluk verschuiven.

**Acceptatiecriteria**
- [ ] Types: keuken, koelkast, toilet, wastafel, douche, bad, kolom, trap, schoorsteen
- [ ] Vergrendeld door default, wel te ontgrendelen
- [ ] Maten instelbaar

### E02-09 Collision- en afstandscontrole
*Fase 2: Kern · maat M*

Als gebruiker wil ik gewaarschuwd worden als iets niet past of de doorloop te smal is.

**Acceptatiecriteria**
- [ ] Overlap met muur of ander meubel is rood
- [ ] Doorloopbreedte-waarschuwing (instelbaar, standaard 80 cm)
- [ ] Deur-draaicirkel mag niet geblokkeerd worden
- [ ] Unit tests voor randgevallen (rotatie, ronde meubels)

### E02-10 Undo/redo en geschiedenis
*Fase 2: Kern · maat M*

Als gebruiker wil ik stappen ongedaan maken.

**Acceptatiecriteria**
- [ ] Ctrl/Cmd+Z en Shift+Z, knoppen op touch
- [ ] Minstens 100 stappen
- [ ] Slepen telt als één stap

### E02-11 Meetfuncties en maatvoering
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik afstanden meten en zien.

**Acceptatiecriteria**
- [ ] Meetlint-tool tussen twee punten
- [ ] Automatische maatlijnen bij selectie
- [ ] cm/inch-schakelaar werkt overal

## E03: 2D-editor

### E03-12 SVG-canvas met zoomen, pannen en raster
*Fase 2: Kern · maat M*

Als gebruiker wil ik soepel door mijn plattegrond navigeren.

**Acceptatiecriteria**
- [ ] Scrollwiel/pinch-zoom, slepen met spatie of twee vingers
- [ ] Raster en snap-to-grid instelbaar
- [ ] Minimap bij grote plannen
- [ ] 60 fps bij 150 items

### E03-13 Selecteren, verslepen, draaien en schalen
*Fase 2: Kern · maat L*

Als gebruiker wil ik meubels direct manipuleren.

**Acceptatiecriteria**
- [ ] Handvatten voor draaien (15°-stappen, vrij met Alt) en formaat
- [ ] Meervoudige selectie met rechthoek of Shift
- [ ] Pijltjestoetsen verplaatsen 1 cm of 10 cm met Shift
- [ ] Dupliceren, verwijderen, groeperen

### E03-14 Lagen en zichtbaarheid
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik categorieën verbergen of vergrendelen.

**Acceptatiecriteria**
- [ ] Lagen: meubels, decoratie, verlichting, maatvoering, elektra
- [ ] Oog- en slotje per laag
- [ ] Staat wordt bewaard in project

### E03-15 Kamerlabels, oppervlakte en legenda
*Fase 2: Kern · maat S*

Als gebruiker wil ik naam en m² per kamer zien.

**Acceptatiecriteria**
- [ ] Naam en oppervlakte (m² of sqft) automatisch
- [ ] Labels verplaatsbaar en te verbergen

### E03-16 Contextmenu en sneltoetsen
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik snel kunnen werken.

**Acceptatiecriteria**
- [ ] Rechtermuisknop-menu op elk object
- [ ] Sneltoetsoverzicht met ?
- [ ] Alle sneltoetsen configureerbaar-ready

## E04: 3D-weergave

### E04-17 Basisscène: muren, vloeren, plafond, verlichting
*Fase 2: Kern · maat L*

Als gebruiker wil ik mijn plan in 3D zien.

**Acceptatiecriteria**
- [ ] Muren op plafondhoogte per verdieping
- [ ] Openingen in muren voor deuren en ramen
- [ ] OrbitControls met sane limieten
- [ ] Resize en devicePixelRatio correct

### E04-18 Camerastandpunten en dollhouse-modus
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik snel tussen standpunten schakelen.

**Acceptatiecriteria**
- [ ] Bovenaanzicht, per kamer, vogelvlucht
- [ ] Dollhouse: muren aan de camerakant transparant
- [ ] Soepele camera-overgangen

### E04-19 Rondleiding in eerste persoon
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik door mijn huis lopen.

**Acceptatiecriteria**
- [ ] WASD/pijltjes en muis, op touch virtuele joystick
- [ ] Oogniveau instelbaar (standaard 160 cm)
- [ ] Botsing met muren, trap werkt tussen verdiepingen
- [ ] Knop om terug te gaan naar overzicht

### E04-20 Prestatie-instellingen en details-schakelaar
*Fase 3: Uitbreiding · maat M*

Als gebruiker op een oude telefoon wil ik kunnen kiezen voor lichte weergave.

**Acceptatiecriteria**
- [ ] Presets laag/midden/hoog (schaduw, textures, details)
- [ ] Automatische detectie bij trage framerate
- [ ] Meshes en textures worden hergebruikt (instancing/caching)
- [ ] Geen geheugenlek bij wisselen van plan

### E04-21 Dag/avond-verlichting met echte lampen
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik zien hoe mijn huis 's avonds voelt.

**Acceptatiecriteria**
- [ ] Zonstand en daglicht via ramen (richting instelbaar)
- [ ] Avondmodus met lampen als lichtbronnen
- [ ] Maximaal aantal lichten met slimme prioritering
- [ ] Schaduwen aan/uit

### E04-22 Selecteren en bewerken vanuit 3D
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik in 3D op een object klikken en het aanpassen.

**Acceptatiecriteria**
- [ ] Raycast-selectie met highlight
- [ ] Zijpaneel toont dezelfde opties als 2D
- [ ] Verslepen over de vloer in 3D

## E05: Meerdere verdiepingen & trappen

### E05-23 Verdiepingen toevoegen, ordenen en hernoemen
*Fase 2: Kern · maat M*

Als gebruiker wil ik een huis met meerdere verdiepingen in één project.

**Acceptatiecriteria**
- [ ] Tabs of lijst met verdiepingen, volgorde aanpasbaar
- [ ] Eigen plafondhoogte per verdieping
- [ ] Ghost-weergave van de verdieping eronder in 2D

### E05-24 Trappen verbinden verdiepingen
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik dat een trap op beide verdiepingen klopt.

**Acceptatiecriteria**
- [ ] Rechte, haakse en wenteltrap
- [ ] Gat in vloer/plafond op de bovenverdieping automatisch
- [ ] Waarschuwing bij onrealistische stijgingshoek

### E05-25 Hele huis in 3D met verdiepingen gestapeld
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik het hele huis zien.

**Acceptatiecriteria**
- [ ] Schakelaar: één verdieping, alles, uit elkaar
- [ ] Verdiepingen één voor één te verbergen

### E05-26 Meerdere verdiepingen importeren uit één afbeelding
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik één foto met twee plattegronden in één keer inladen.

**Acceptatiecriteria**
- [ ] AI splitst per verdieping
- [ ] Trappen worden herkend en gekoppeld
- [ ] Gebruiker kan resultaat per verdieping controleren

## E06: Plattegrond zelf tekenen en verbouwen

### E06-27 Muren tekenen met de muis of vinger
*Fase 3: Uitbreiding · maat XL*

Als gebruiker wil ik zonder foto een plattegrond tekenen.

**Acceptatiecriteria**
- [ ] Muur-tool met snap op hoeken (0/45/90°) en lengte-invoer
- [ ] Kamers worden automatisch herkend uit gesloten muren
- [ ] Muur verplaatsen of verlengen met handvatten

### E06-28 Kamer tekenen met rechthoeken en polygonen
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik snel een kamer neerzetten.

**Acceptatiecriteria**
- [ ] Rechthoek-, L- en vrije polygoontool
- [ ] Vertex bewerken
- [ ] Kamertype kiezen

### E06-29 Muren slopen en doorbraken (verbouwscenario)
*Fase 4: Afwerking · maat L*

Als gebruiker wil ik virtueel een muur weghalen of een doorgang maken.

**Acceptatiecriteria**
- [ ] Muur selecteren en 'slopen' of 'doorbraak' met breedte
- [ ] Scenario's naast elkaar vergelijken (huidig/verbouwd)
- [ ] Dragende muur-markering als waarschuwing

### E06-30 Achtergrondafbeelding als tekenhulp
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik een foto/plattegrond onder mijn tekening leggen.

**Acceptatiecriteria**
- [ ] Uploaden, schalen met referentielijn, transparantie
- [ ] Wordt mee opgeslagen of apart gehouden (keuze)

## E07: Plattegrond importeren

### E07-31 Plan-code importeren en exporteren (JSON)
*Fase 2: Kern · maat M*

Als gebruiker wil ik plannen als tekst kunnen kopiëren en plakken.

**Acceptatiecriteria**
- [ ] Eén plan of lijst van plannen
- [ ] Validatie met duidelijke foutmeldingen (regel/veld)
- [ ] Schema is gedocumenteerd en versioned
- [ ] Roundtrip-test: export, import levert identiek plan

### E07-32 AI-plattegrondlezer met eigen API-key
*Fase 3: Uitbreiding · maat XL*

Als gebruiker wil ik een afbeelding uploaden en automatisch een plan krijgen.

**Acceptatiecriteria**
- [ ] Instellingen-scherm voor API-key, key staat alleen lokaal
- [ ] Upload van foto/PDF, voortgang en annuleren
- [ ] Resultaat volgt het plan-schema en wordt gevalideerd
- [ ] Duidelijke uitleg over kosten en privacy
- [ ] Fallback als key ontbreekt: uitleg + handmatige route

### E07-33 Controle-stap na AI-import
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik de herkende kamers kunnen corrigeren.

**Acceptatiecriteria**
- [ ] Overlay van het origineel over het resultaat
- [ ] Kamers, deuren en ramen te verslepen/hernoemen
- [ ] Schaalcontrole met één bekende maat (bv. deurbreedte)

### E07-34 Voorbeeldplattegronden meeleveren
*Fase 3: Uitbreiding · maat S*

Als nieuwe gebruiker wil ik meteen kunnen spelen.

**Acceptatiecriteria**
- [ ] Minstens 3 voorbeelden (appartement, rijtjeshuis, twee verdiepingen)
- [ ] Kiezen bij eerste start

## E08: Meubelcatalogus (breed, generiek)

### E08-35 Catalogusarchitectuur en data-formaat
*Fase 2: Kern · maat M*

Als ontwikkelaar wil ik meubels als data definiëren, zodat uitbreiden eenvoudig is.

**Acceptatiecriteria**
- [ ] Item-definitie: categorie, standaardmaat, min/max, materialen, ankers (muur/ondersteuning), bouwfunctie
- [ ] Catalogus valideert met schema bij build
- [ ] Zoeken op naam, categorie, tag en maat

### E08-36 Zitmeubels (30+ varianten)
*Fase 2: Kern · maat L*

Als gebruiker wil ik veel soorten banken en stoelen.

**Acceptatiecriteria**
- [ ] Banken 2/3/4-zits, hoek, U-vorm, chesterfield, slaapbank dicht/open
- [ ] Fauteuils, poefs, krukken, bankjes, hangstoel, chaise longue
- [ ] Alle maten aanpasbaar, kleur en stof kiesbaar

### E08-37 Tafels en eetkamer (20+)
*Fase 2: Kern · maat M*

Als gebruiker wil ik tafels voor elke ruimte.

**Acceptatiecriteria**
- [ ] Eettafels 4-10 personen, rond, ovaal, uitschuifbaar
- [ ] Salontafels, bijzettafels, bartafel
- [ ] Stoelen in 6+ stijlen, banken voor aan tafel

### E08-38 Slaapkamer (20+)
*Fase 2: Kern · maat M*

Als gebruiker wil ik bedden en bijpassende meubels.

**Acceptatiecriteria**
- [ ] Bedden 80 tot 200 breed, boxspring, hemelbed, stapelbed, opbergbed
- [ ] Nachtkastjes, kleerkasten (schuif/draai), kaptafel, commode
- [ ] Bed met bedlinnen in kleur

### E08-39 Werkplek en studeerkamer (15+)
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik grote en dubbele werkplekken.

**Acceptatiecriteria**
- [ ] Bureaus tot 240 cm, hoekbureau, zit-sta, naast elkaar
- [ ] Stoelen, monitoren, laptop, printer, rekken

### E08-40 Opbergen en wandmeubels (25+)
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik kasten en planken.

**Acceptatiecriteria**
- [ ] Boekenkasten, vitrinekast, dressoir, tv-meubel, schoenenkast, kapstok
- [ ] Modulaire kastenwand met verstelbare vakken
- [ ] Wandplanken en zwevende meubels met ophanghoogte

### E08-41 Keuken, bad en witgoed (25+)
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik keuken en badkamer inrichten.

**Acceptatiecriteria**
- [ ] Keukenblokken en eilanden modulair (onderkast, bovenkast, hoek)
- [ ] Wasmachine, droger, vaatwasser, koelkast, oven op juiste plek
- [ ] Badkamermeubels, wastafels, douches, bad, toilet
- [ ] Aansluitingen (water/afvoer) als markering

### E08-42 Decoratie, planten en textiel (50+)
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik mijn huis sfeer geven.

**Acceptatiecriteria**
- [ ] Planten in 10+ soorten, vazen, bloemen, kaarsen, boeken, schilderijen, spiegels
- [ ] Kleden, gordijnen, kussens, dekens, plaids
- [ ] Kleine items komen automatisch bovenop een oppervlak

### E08-43 Verlichting (20+)
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik lampen die echt licht geven.

**Acceptatiecriteria**
- [ ] Plafond-, hang-, wand-, vloer-, tafel-, kroonluchter
- [ ] Kleur, helderheid en aan/uit per lamp
- [ ] Beïnvloedt avondmodus in 3D

### E08-44 Alledaagse scènes (gedekte tafel, wasmand, etc.)
*Fase 4: Afwerking · maat M*

Als gebruiker wil ik levendige details.

**Acceptatiecriteria**
- [ ] Gedekte tafel met couverts en eten, wasmand, schoenen, jassen, speelgoed
- [ ] Schakelaar om alle 'leven' in één keer uit te zetten

### E08-45 Eigen meubel bouwen (parametrisch)
*Fase 4: Afwerking · maat XL*

Als gebruiker wil ik een meubel op maat samenstellen.

**Acceptatiecriteria**
- [ ] Basisvormen combineren (blok, cilinder, plaat, poot)
- [ ] Opslaan als eigen item in de catalogus
- [ ] Exporteren en importeren van eigen items

### E08-46 Favorieten en recent gebruikt
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik snel bij mijn vaste items.

**Acceptatiecriteria**
- [ ] Ster-markering, sectie bovenaan
- [ ] Wordt lokaal bewaard

## E09: Stijl, kleur en materialen

### E09-47 Kleurkiezer met palet en vrije kleur
*Fase 2: Kern · maat M*

Als gebruiker wil ik mijn eigen paletten bewaren.

**Acceptatiecriteria**
- [ ] Palet-snelkeuze (salie, olijf-greige, crème, messing, donker hout)
- [ ] Vrije kleur via hex en picker
- [ ] Eigen paletten opslaan, hernoemen, delen via code

### E09-48 Vloeren: hout, visgraat, tegels, terrazzo, tapijt
*Fase 2: Kern · maat L*

Als gebruiker wil ik de vloer per kamer instellen.

**Acceptatiecriteria**
- [ ] Patronen: rechte planken, visgraat, Hongaarse punt, schaakbord, tegels
- [ ] Kleur, voegkleur, plankbreedte instelbaar
- [ ] Procedurele textures, geen zware bestanden

### E09-49 Wanden: verf, behang en panelen per kamer
*Fase 2: Kern · maat L*

Als gebruiker wil ik wandafwerking kiezen.

**Acceptatiecriteria**
- [ ] Verf, behang (botanisch, streep, toile), kalk, baksteen
- [ ] Panelen: Frans kaderwerk, lambrisering, beadboard, shaker, neoklassiek
- [ ] Paneelhoogte en kleur apart

### E09-50 Elke muur apart aanpasbaar
*Fase 2: Kern · maat M*

Als gebruiker wil ik één muur een eigen look geven.

**Acceptatiecriteria**
- [ ] Muur klikken in 2D of 3D
- [ ] Overschrijft kamerinstelling, 'terug naar kamerstijl' knop
- [ ] Beide zijden van een muur apart

### E09-51 Plafond, sierlijsten en plinten
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik de details afwerken.

**Acceptatiecriteria**
- [ ] Plafondkleur, rozet, kroonlijst
- [ ] Plinthoogte en -stijl
- [ ] Deurlijsten en raamkozijnen met kleur

### E09-52 Stijlpresets (20+) en 'Verras me'
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik met één klik een complete stijl.

**Acceptatiecriteria**
- [ ] Presets o.a. Frans landelijk, neoklassiek, romantisch, Japandi, Scandinavisch, art deco
- [ ] Preview-miniatuur per preset
- [ ] Toepassen op hele huis of alleen geselecteerde kamer
- [ ] Willekeurige combinatie binnen een gekozen palet

### E09-53 Looks opslaan en vergelijken
*Fase 4: Afwerking · maat M*

Als gebruiker wil ik varianten naast elkaar.

**Acceptatiecriteria**
- [ ] Opslaan als benoemde look
- [ ] Voor/na-schuifbalk in 3D

## E10: Projecten, opslag en export

### E10-54 Meerdere projecten lokaal beheren
*Fase 2: Kern · maat M*

Als gebruiker wil ik meerdere huizen/ideeën bewaren.

**Acceptatiecriteria**
- [ ] Projectoverzicht met miniatuur, hernoemen, dupliceren, verwijderen
- [ ] Opslag in IndexedDB (niet localStorage-limiet)
- [ ] Autosave met laatste-opgeslagen-indicator

### E10-55 Export en import van projectbestand
*Fase 2: Kern · maat M*

Als gebruiker wil ik back-ups maken en delen.

**Acceptatiecriteria**
- [ ] Download als .json (of .zip bij afbeeldingen)
- [ ] Import met validatie en migratie
- [ ] Waarschuwing bij overschrijven

### E10-56 Afbeelding- en PDF-export
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik een plattegrond kunnen printen of delen.

**Acceptatiecriteria**
- [ ] PNG van 2D en 3D, hoge resolutie
- [ ] PDF met schaal (1:50, 1:100) en maatvoering
- [ ] Meubellijst in export

### E10-57 Meubellijst en inventaris
*Fase 4: Afwerking · maat M*

Als gebruiker wil ik weten wat ik allemaal nodig heb.

**Acceptatiecriteria**
- [ ] Lijst per kamer met aantallen en maten
- [ ] Optioneel eigen prijs per item en totaal
- [ ] Export als CSV

### E10-58 Verloren data voorkomen
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik niet per ongeluk alles kwijtraken.

**Acceptatiecriteria**
- [ ] Waarschuwing bij wissen van browserdata en link naar export
- [ ] Automatische back-up-herinnering na X wijzigingen
- [ ] Herstel van laatste werkende versie bij corrupte data

## E11: Interface, toegankelijkheid en internationalisatie

### E11-59 Responsive layout en touch-bediening
*Fase 3: Uitbreiding · maat L*

Als gebruiker wil ik op telefoon en tablet kunnen werken.

**Acceptatiecriteria**
- [ ] Inklapbare zijbalk, onderbalk op mobiel
- [ ] Pinch-zoom, twee-vingers pannen, grote tapdoelen (min 44px)
- [ ] Geen horizontale scroll

### E11-60 Meertalig: Nederlands en Engels
*Fase 3: Uitbreiding · maat M*

Als gebruiker wil ik de app in mijn taal.

**Acceptatiecriteria**
- [ ] i18n-bibliotheek, alle teksten in vertaalbestanden
- [ ] Taal kiezen en onthouden, browsertaal als default
- [ ] Catalogusnamen vertaald
- [ ] Lint op ontbrekende vertalingen

### E11-61 Eenheden: cm, mm, inch en voet
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik mijn eigen eenheid.

**Acceptatiecriteria**
- [ ] Wisselen zonder dataverlies (intern altijd cm)
- [ ] Alle invoervelden en maatvoering volgen de keuze
- [ ] Unit tests voor conversie en afronding

### E11-62 Toegankelijkheid
*Fase 4: Afwerking · maat M*

Als gebruiker met beperking wil ik de app kunnen gebruiken.

**Acceptatiecriteria**
- [ ] Volledig bedienbaar met toetsenbord (zijbalk, dialogen)
- [ ] ARIA-labels en focusindicatoren
- [ ] Reduced-motion respecteren
- [ ] Kleurenblind-veilige foutmarkering (niet alleen rood)

### E11-63 Onboarding en hulp
*Fase 4: Afwerking · maat M*

Als nieuwe gebruiker wil ik snel snappen hoe het werkt.

**Acceptatiecriteria**
- [ ] Korte rondleiding bij eerste start (overslaanbaar)
- [ ] Contextuele tips en lege-staat-uitleg
- [ ] Help-pagina met sneltoetsen

### E11-64 Instellingen-scherm
*Fase 3: Uitbreiding · maat S*

Als gebruiker wil ik voorkeuren op één plek.

**Acceptatiecriteria**
- [ ] Taal, eenheid, thema, kwaliteit, API-key, autosave
- [ ] Reset naar standaard

## E12: Kwaliteit, tests en onderhoud

### E12-65 Unit tests voor core-logica
*Fase 2: Kern · maat M*

Als ontwikkelaar wil ik vertrouwen in de plattegrondlogica.

**Acceptatiecriteria**
- [ ] Dekking >= 85% op /core
- [ ] Fixtures met echte plannen (inclusief L-vormen en twee verdiepingen)
- [ ] Property-tests voor geometrie (willekeurige rechthoeken)

### E12-66 End-to-end tests met Playwright
*Fase 3: Uitbreiding · maat L*

Als ontwikkelaar wil ik dat belangrijke flows automatisch getest worden.

**Acceptatiecriteria**
- [ ] Flows: plan importeren, meubel plaatsen, stijl wisselen, exporteren, 3D laden
- [ ] Draait in CI op Chromium en WebKit
- [ ] Screenshots als artifact bij falen

### E12-67 Visuele regressietests voor 2D en 3D
*Fase 4: Afwerking · maat M*

Als ontwikkelaar wil ik zien als een render ongemerkt verandert.

**Acceptatiecriteria**
- [ ] Referentie-screenshots per voorbeeldplan
- [ ] Tolerantie voor GPU-verschillen
- [ ] Update-commando documenteren

### E12-68 Prestatiebudget en monitoring
*Fase 4: Afwerking · maat M*

Als ontwikkelaar wil ik dat de app snel blijft.

**Acceptatiecriteria**
- [ ] Bundlegrootte-budget in CI
- [ ] Lighthouse-check op de homepage
- [ ] Lazy loading van three.js en catalogus

### E12-69 Foutafhandeling en logging
*Fase 4: Afwerking · maat S*

Als gebruiker wil ik begrijpelijke fouten.

**Acceptatiecriteria**
- [ ] Error boundary met herstelknop en export-nood-optie
- [ ] Geen stille fouten bij import
- [ ] Optioneel anoniem foutrapport (uit by default)

### E12-70 Documentatie en bijdragen
*Fase 4: Afwerking · maat S*

Als bijdrager wil ik snel kunnen starten.

**Acceptatiecriteria**
- [ ] CONTRIBUTING, architectuurdoc, catalogus-uitbreiden-gids
- [ ] Issue- en PR-templates
- [ ] Licentie gekozen
