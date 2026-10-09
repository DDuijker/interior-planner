# CLAUDE.md: Maison (interieurplanner)

Lees dit eerst. Dit bestand bevat de keuzes die al gemaakt zijn. Wijk er niet zonder overleg van af.

## Wat dit is
Een gratis interieurplanner in de browser. Je laadt een plattegrond in (foto met AI, plan-code of zelf tekenen), ziet hem in 2D en 3D, richt hem in en past alles aan. Eigenaar: Djoeke. Eerste echte gebruik: het appartement van Dino (Kleiburg 39-A, Amsterdam, begane grond, 73 m²) en een huis met twee verdiepingen. Gebruikers zijn vrienden en familie, geen publiek.

Praat met Djoeke in het Nederlands, casual en direct. Geen lange uitleg, geen em-dashes. Code, commits en variabelen in het Engels. UI-teksten in NL en EN.

## Vaste keuzes
- **Stack:** Next.js (App Router) + TypeScript strict, static export, three.js voor 3D, SVG voor 2D.
- **Hosting:** GitHub Pages via GitHub Actions. Geen backend.
- **Opslag:** alleen lokaal (IndexedDB), plus export/import van een projectbestand. Geen accounts, geen cloud. Dat geldt ook voor foto's (E13).
- **Foto's:** inspiratie (bv. Pinterest) en foto's van het huidige interieur. Pinterest alleen via slepen/plakken of een opgeslagen link, de app haalt niets op bij Pinterest. Foto's gaan alleen naar de AI-dienst na toestemming per foto.
- **AI-plattegrondlezer:** de gebruiker vult zijn eigen API-sleutel in. De sleutel blijft in de browser en komt nooit in de repo, in logs of in een URL. Zonder sleutel moet de app volledig werken via plan-code en zelf tekenen.
- **Meubels:** generiek en zelf gemodelleerd. Geen IKEA of andere merkdata. Wel realistische standaardmaten.
- **Talen:** Nederlands en Engels. Eenheden: cm, mm, inch, voet. Intern altijd centimeters.
- **Tests:** unit tests voor alle pure logica in `/core`, Playwright voor de belangrijkste flows, CI op elke PR.
- **Backlog:** de GitHub Issues (E01 t/m E13). Werk per issue, niet los van de lijst.

## Concepten die je moet kennen
- **Project > Verdieping > Versie.** Een project heeft een of meer verdiepingen. Elke verdieping heeft een **Huidige situatie** (kaal: lege kamers, vloeren en wanden zoals ze zijn, alleen vaste dingen als keuken, sanitair, trap, deuren en ramen) en nul of meer **Ontwerpen**. Een nieuw ontwerp is een kopie van de huidige situatie. De huidige situatie blijft bewaard om mee te vergelijken.
- **Muren per kamer:** elke muur is los aan te passen, en elke muur heeft twee zijden (kant van de kamer en de andere kant). Afwerking: huidig, verf, behang of paneel, met kleur en hoogte. Overrides staan per muur en per zijde, boven op de stijl van de kamer, en zijn terug te zetten.
- **Muren uit kamers:** kamers zijn polygonen of rechthoeken. Muren ontstaan automatisch: een binnenmuur tussen twee kamers, een buitenmuur aan de rand. Een balkon of loggia krijgt een lage rand in plaats van een volle muur. Rasteriseer op een grid van 5 cm en voeg cellen daarna samen tot rechthoeken.
- **Plattegrond:** y wijst omlaag, x naar rechts. Meubels hebben `back` (N, E, S of W): de kant waar de rugzijde tegenaan staat. Dat bepaalt de rotatie.
- **Kleine items** (kaarsen, lampen, vazen) staan automatisch bovenop het meubel eronder. **Wandspullen** (schilderijen, spiegels, tv) hangen automatisch aan de dichtstbijzijnde muur.

## Plan-code (JSON), moet gedocumenteerd en versioned zijn
Eén plan of een lijst van plannen (een per verdieping). Alle maten in cm.

```json
{
  "name": "Huis begane grond",
  "height": 273,
  "rooms": [{"name": "Woonkamer", "type": "living", "rects": [[x, y, w, d]]}],
  "walls": [[x, y, w, d]],
  "doors": [{"x": 0, "y": 0, "w": 90, "dir": "h"}],
  "windows": [{"x": 0, "y": 0, "w": 120, "dir": "h", "glass": false}],
  "fixtures": [{"type": "kitchen|fridge|toilet|sink|shower|bath|tall|stairs", "x": 0, "y": 0, "w": 60, "h": 60}],
  "items": [{"name": "Bank 3-zits", "x": 0, "y": 0, "back": "N"}]
}
```
Kamertypes: living, kitchen, dining, bed, office, bath, toilet, hal, storage, loggia. Valideer met een schema en geef foutmeldingen met veld en regel.

## Design
Het ontwerp staat op het canvas "Interieurplanner design" (5 schermen: 2D-editor, 3D en stijl, mobiel, projecten, plattegrond inladen). Zie ook `docs/design/`. Volg het visueel, maar bouw het als echte React-componenten. De canvasbestanden zelf zijn geen bron voor de code.

**Kleuren**
- Achtergrond crème `#F5F1E8`, paneel `#FBF9F4`, lijn `#DDD6C6`
- Tekst `#2A2620`, gedempte tekst `#6A6357` (niet lichter, anders faalt het contrast)
- Salie licht `#87A08C`, salie donker (knoppen en actief) `#4D6857`, salie tint `#E3EAE2`
- Olijf-greige accent `#A9A58B`, messing `#B08D57`, donker hout `#4A3526`
- Waarschuwing `#A23B2C` op `#F0C9C1`. Gebruik altijd ook tekst of patroon, nooit alleen kleur.
- Hoofdkleur is salie, niet olijf.

**Typografie:** Cormorant Garamond voor titels, Karla voor de bediening. Geen Inter, Roboto of Arial.

**Regels:** aanraakdoelen minimaal 44 px. Alles bedienbaar met toetsenbord. Echte `<button>`, `<a>`, `<input>` met `<label>`. Icoon-knoppen krijgen een `aria-label`. Geen emoji als icoon. Werkt op telefoon, met inklapbare zijbalk of onderbalk.

## Werkwijze
1. Pak een issue, maak een branch `epic/E02-walls-from-rooms` (of vergelijkbaar), werk de acceptatiecriteria af.
2. Pure logica gaat in `/core` zonder React of three.js, met unit tests. Daar zit het risico.
3. Open een PR die het issue sluit (`Closes #nn`). CI moet groen zijn: lint, typecheck, tests.
4. Eerst E01 (setup, CI, deploy, designsysteem, datamodel) helemaal afmaken. Daarna E02 (core) en E03 (2D), dan E04 (3D), E05 (verdiepingen), E07 (importeren), E08 en E09 (catalogus en stijl).
5. Schrijf geen grote stukken tegelijk. Klein, getest, mergebaar.
6. Prestaties: lazy load three.js en de catalogus. Hergebruik meshes en materialen. Er komt een details-schakelaar voor trage telefoons.

## Niet doen
- Geen API-sleutels, wachtwoorden of persoonlijke data in de repo of in logs.
- Geen netwerkverzoeken behalve naar de AI-dienst die de gebruiker zelf instelt, en Google Fonts.
- Geen merkdata of modellen van IKEA of andere winkels.
- Geen backend, accounts of cloud-opslag toevoegen zonder dat Djoeke dat zegt.
- Geen grote refactors buiten het issue.

## Referentie: de eerste prototypes
Er bestaat een werkend prototype als een enkel HTML-bestand (`interieur-planner.html`, ongeveer 6000 regels, geen build). Het bevat al: kamerrasterisatie met muren, deuren en ramen, trappen, meubelcatalogus, 18 stijlpresets, avondmodus, per-muur-overrides en meerdere verdiepingen via plan-code. Gebruik het als **referentie voor het gedrag**, niet als code om te kopiëren. De nieuwe versie wordt modulair en getest opgebouwd.

## Definition of done
Acceptatiecriteria gehaald, tests geschreven en groen, geen console-fouten, werkt op een smal scherm, vertalingen in NL en EN, korte notitie in de PR over wat je hebt gedaan en wat je niet hebt getest.
