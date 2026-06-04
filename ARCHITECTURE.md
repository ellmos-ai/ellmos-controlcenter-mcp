# Architektur

## Überblick

Der Server ist absichtlich klein gestartet und in wenige Kernmodule geteilt:

- `catalog.ts`
  - scannt den lokalen MCP-Root
  - liest `package.json` und optional `server.json`
  - erzeugt strukturierte Server-Zusammenfassungen
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
- `policy.ts`
  - auditiert aufgelöste Profile
  - meldet erste Risiken wie `npx`-Starts, Env-Secrets und ungültige Server-Konfigurationen
  - gibt keine Secret-Werte aus
- `dashboard.ts`
  - stellt eine lokale Browser-GUI bereit
  - nutzt dieselbe Catalog-, Profile-, Bundle- und Policy-Logik
  - schreibt Profile nur nach explizitem Server-Toggle

`index.ts` bildet darauf die MCP-Tools ab und kümmert sich um Formatierung und Ausgaben.

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
