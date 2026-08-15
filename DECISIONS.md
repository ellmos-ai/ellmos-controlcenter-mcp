# Entscheidungen

## Name

**Gewählt:** `ellmos-controlcenter-mcp`

Begründung:

- klingt nach Steuerzentrale statt Werkzeugablage
- bleibt offen für spätere Profile-, Policy-, Gateway- und Registry-Funktionen
- ist klarer und professioneller als ein Sammelbegriff wie `toolcollectorhub`

## Scope des MVP

Der MVP startet bewusst **nicht** mit:

- OAuth
- Gateway-Regeln
- Profilwechsel in Live-Configs
- Tool-Ausführung auf fremden Servern

Stattdessen beginnt der Server mit:

- lokaler Sichtbarkeit
- Katalogbau
- Profilanalyse
- Empfehlung

So entsteht zuerst ein belastbarer Kern, statt viele große Rollen nur anzudeuten.

## Stack-Manifest: kein `controlcenter.stack.json` (v1) [U 2026-07-23]

**Vom Nutzer ratifiziert (2026-07-23):** Das im `STACK-CAPABILITY-PLAN.md` (2026-07-05)
als Alternative genannte `controlcenter.stack.json` (Schema `ellmos.controlcenter.stack.v1`)
wird **nicht** angelegt. Umgesetzt ist die dritte Plan-Variante — der externe
`stacks.catalog.json` (`ellmos.stacks.catalog.v1`) + je Stack `ellmos.stack.v2`.
`agent-ops-stack` existiert dort bereits und wird fehlerfrei erkannt; ein v1-Selbstmanifest
wäre ein Duplikat. Begründung + Verifikation: `STACK-CAPABILITY-PLAN.md` „Status update
(2026-07-23)".

## Virtueller Gateway (Phase 4): bewusst zurückgestellt [U 2026-07-23] — AUFGEHOBEN [U 2026-08-16]

~~**Vom Nutzer ratifiziert (2026-07-23, auf direkte Rückfrage):** Der virtuelle MCP-Gateway
(ROADMAP Phase 4) und die darunterliegende adapter-gated Execution + Audit (Plan P3) bleiben
offen. Sie sind eine große, freigabepflichtige Ausbaustufe und werden **nicht autonom**
gebaut — ein erster P3-Schritt (`controlcenter_plan_capability` als Dry-Run) oder der volle
Gateway brauchen jeweils eine dedizierte, freigegebene Session.~~

**Aufgehoben am 2026-08-16.** Der Nutzer hat die damals verlangte „dedizierte, freigegebene
Session" ausdrücklich erteilt. Die Zurückstellung ist damit erledigt, nicht mehr gültig.

## Gateway: Tools am ControlCenter statt eigener Serverprozess [C 2026-08-16]

Gebaut wurden zwei Tools **am bestehenden ControlCenter-Server** — `controlcenter_list_available_tools`
und `controlcenter_invoke` — nicht der in `ROADMAP.md` Phase 4 skizzierte separate Serverprozess
`ellmos-controlcenter-gateway`.

Begründung: Das Ziel des Nutzers ist, das Default-Profil auf wenige Server zu verkleinern
(FileCommander + ControlCenter + open-compute) und die übrigen Server bei Bedarf zu erreichen.
ControlCenter ist in diesem Profil ohnehin geladen. Ein zusätzlicher Gateway-Serverprozess wäre
ein weiterer Eintrag im Profil und ein weiterer Kindprozess — also genau das, was verkleinert
werden soll. Die ROADMAP-Formulierung („Claude lädt nur den virtuellen …-gateway") bleibt als
mögliche spätere Variante bestehen; die Abweichung ist bewusst und hier dokumentiert.

## Gateway: Verbindung pro Aufruf, kein Session-Pool [C 2026-08-16]

`controlcenter_invoke` öffnet die Verbindung zum Zielserver für den Aufruf und schließt sie im
`finally` wieder — es wird **keine** Verbindung zwischen Aufrufen gehalten.

Begründung: Ein Pool hält Stdio-Kindprozesse am Leben. Die systemweite Regel dieses Hosts lautet,
dass jedes System seine Kindprozesse selbst abräumt (Anlass: 504 verwaiste Language-Server mit
~16 GB); ein zentraler Reaper wurde ausdrücklich abgelehnt. Unter Windows beendet
`StdioClientTransport.close()` zudem Enkelprozesse (`npx` → `node`) nicht zuverlässig. Der Preis
sind ~200–500 ms Startzeit je Aufruf auf kalten Stdio-Servern — für Server, die gerade *deshalb*
nicht dauerhaft geladen sind, ist das der richtige Tausch. Gemessen: keine zusätzlichen
Node-Prozesse nach einem vollständigen Testlauf.

## Gateway-Policy: Gate an der Erreichbarkeit, nicht am einzelnen Tool [C 2026-08-16]

Der Standardmodus ist `open`: jedes Tool eines auffindbaren Servers ist aufrufbar. Die eigentliche
Grenze ist die **Menge der erreichbaren Server** — nur was der konfigurierte MCP-Root oder das
benannte Profil ohnehin deklariert, ist adressierbar. `data/gateway-policy.json` kann darüber
hinaus Tools sperren (`deny`) oder auf `allowlist` umstellen.

Fail-closed liegt hier beim **Laden der Konfiguration**, nicht beim Default: Eine defekte oder
schema-fremde Policy-Datei lehnt *jeden* Aufruf ab und fällt niemals auf „alles erlaubt" zurück.
Ein Default-Deny wäre die falsche Stelle gewesen — es hätte den Gateway unbenutzbar gemacht und
den Nutzer dazu gebracht, die Server wieder ins Profil aufzunehmen.

## Gateway: `controlcenter_plan_capability` bewusst übersprungen [C 2026-08-16]

`STACK-CAPABILITY-PLAN.md` P3 nennt `controlcenter_plan_capability` (Dry-Run) als ersten Schritt vor
`controlcenter_execute_capability`. Dieser Schritt wurde bewusst **nicht** gebaut, nicht übersehen:
Der Freigabeauftrag zielte auf den Gateway-Durchgriff, und ein Dry-Run-Planer für MCP-Toolaufrufe
hätte wenig Aussagekraft — der Plan wäre identisch mit den Argumenten des Aufrufs. Für die
Modul-, Stack- und Ordner-Adapter, wo ein Plan echte Nebenwirkungen beschreibt, bleibt er offen.

## Gateway: nur der MCP-Adapter, nicht die übrigen Adapterklassen [C 2026-08-16]

`controlcenter_invoke` implementiert ausschließlich den **MCP-Adapter** aus P3. Die dort ebenfalls
genannten Modul-, Stack- und Ordner-Adapter (CLI-Einstiegspunkte, Install/Status/Start/Stop,
Statusdateien lokaler Stack-Instanzen) sind **nicht** enthalten und bleiben offen.

