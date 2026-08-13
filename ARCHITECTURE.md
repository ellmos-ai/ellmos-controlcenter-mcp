# Architektur

## Überblick

Der Server ist absichtlich klein gestartet und in wenige Kernmodule geteilt:

- `actualSelfReceipt.ts`
  - prüft die eigene MCP-Oberfläche fest verdrahtet und rein lesend per `list_tools`
  - erzeugt nur ein redigiertes, kurzlebiges Ed25519-signiertes Actual-Self-Receipt
  - liest Scope, Registry-Bindung und Schlüsselreferenz aus einer expliziten hostlokalen Konfiguration
  - provisioniert keinen Trust, autorisiert keine Ausführung und aktiviert kein Routing
- `catalog.ts`
  - scannt den lokalen MCP-Root
  - liest `package.json` und optional `server.json`
  - erzeugt strukturierte Server-Zusammenfassungen
- `mcpCatalog.ts`
  - liest den handgepflegten MCP-Katalog `mcps.catalog.v1.json` (Schema `ellmos.mcps.v1`) aus dem MCP-Root oder aus `ELLMOS_MCP_CATALOG`
  - verknüpft Katalogeinträge mit dem Verzeichnis-Scan zuerst über die Katalog-`id`, danach über den npm-Paketnamen
  - meldet beide Richtungen: gescannte Server ohne Katalogeintrag und Katalogeinträge ohne Verzeichnis
  - ergänzt Art (`mcp_kind`), eigenen Zustand, Zustandshoheit je Namensraum, Umhüllung und Komposition
  - wirft nie: fehlender, unlesbarer oder schemafremder Katalog wird über einen Status gemeldet, ein unlesbarer Root als unlesbar statt als leeres Ergebnis
- `profiles.ts`
  - liest Claude-Profile aus `~/.claude/profiles`
  - extrahiert Servernamen und Profilbeziehungen
  - berechnet eine einfache Profilempfehlung per Heuristik
  - löst Profile inklusive einfacher und mehrfacher `extends`-Vererbung auf
  - entfernt geerbte Server über `remove`, `disabled` oder `disabledServers`
  - meldet fehlende, ungültige oder zyklische Profile mit expliziten Fehlern
  - schreibt generierte `--mcp-config`-Dateien
- `bundles.ts`
  - definiert Capability-Bundles
  - lädt Bundle-Definitionen aus `data/capability-bundles.json` oder `ELLMOS_BUNDLE_CONFIG`
  - validiert Bundle-Konfigurationen und meldet doppelte IDs oder Schemafehler explizit
  - gruppiert lokale Server nach Beschreibung, Name und Keywords
  - empfiehlt Bundles anhand von Aufgaben-Keywords
  - ordnet echte Tool-Metadaten den Capability-Bundles zu
- `toolCatalog.ts`
  - modelliert Toolscan-Ziele aus lokalen Repos und aufgelösten Claude-Profilen
  - startet lokale und profildefinierte Stdio-MCP-Server kontrolliert über die SDK-Client-Transport-Schicht
  - unterstützt Nicht-Node-Kommandos sowie URL-basierte Streamable-HTTP- und SSE-Konfigurationen
  - ruft echte MCP-`list_tools`-Antworten ab
  - normalisiert Toolnamen, Titel, Beschreibungen, Input-Schemas und Annotationen
  - begrenzt Probe-Laufzeiten per Timeout und beendet gestartete Prozesse wieder
- `capabilityFinder.ts`
  - konsumiert ausschließlich explizite, hash-konsistente `system-explorer.resolution.v1`-Dateien
  - übernimmt nur stabile, typkonsistente Komponentenreferenzen mit behaupteter nativer Registry-Bindung
  - kennzeichnet Herkunft und Identität bis zu einem extern vertrauenswürdigen System-Explorer-Receipt ausdrücklich als unverifiziert
  - liefert einen lexikalischen, beratenden Kandidatenstrom ohne Auswahl- oder Ausführungsautorität
  - dedupliziert identische Komponentenreferenzen über Bundlegrenzen und trennt deklarierte Sollangaben strikt von installiert, konfiguriert, laufend, gesund und beobachtet
  - führt keinen parallelen Komponentenindex und keine semantische Bewertung
- `policy.ts`
  - auditiert aufgelöste Profile
  - meldet erste Risiken wie `npx`-Starts, Env-Secrets und ungültige Server-Konfigurationen
  - gibt keine Secret-Werte aus
- `contextPack.ts`
  - baut gestufte `short`-, `execution`- und `full`-Kontextpakete ausschließlich aus registrierten Stack-Manifesten
  - akzeptiert keine frei vom Aufrufer wählbare Root und startet keine Komponenten
  - begrenzt und escaped Manifestwerte; nur eine feste, primitive Policy-Teilmenge ist im `full`-Paket sichtbar
- `i18n/`
  - hält zentrale Textsets für MCP-Ausgaben und Dashboard bereit
  - unterstützt `de`, `en`, `es`, `zh`, `ja` und `ru`
  - pflegt vollständige Textsets für Deutsch, Englisch, Spanisch, Chinesisch, Japanisch und Russisch
  - liest die initiale Sprache aus `CONTROLCENTER_LANGUAGE`, `ELLMOS_CONTROLCENTER_LANGUAGE` oder `LANG`
- `dashboard.ts`
  - stellt eine lokale Browser-GUI bereit
  - nutzt dieselbe Catalog-, Profile-, Bundle- und Policy-Logik
  - schreibt Profile nur nach explizitem Server-Toggle
  - scannt Tools auf Knopfdruck und zeigt Tool-Bundle-Zuordnungen an
  - bietet Sprachwechsel über UI und `/api/language`

`index.ts` bildet darauf die MCP-Tools ab, registriert die Sprach-Tools und kümmert sich um lokalisierte Formatierung und Ausgaben.

## Geplante Zielarchitektur

### Phase 1: Sichtbarkeit

- Server-Katalog
- Profilübersicht
- Profilempfehlung

### Phase 2: Steuerung

- Profilwechsel
- Profil-Templates
- Tool-Bundles

### Phase 3: Governance

- Policy-Layer
- Rechte und Freigaben
- Audit und Trace

### Phase 4: Orchestrierung

- Langläufer
- Checkpoints
- Human Approval
- Resume / Retry
