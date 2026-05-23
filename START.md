# Start

## Zweck

`ellmos-controlcenter-mcp` soll der zentrale Einstiegspunkt für den lokalen MCP-Bestand werden:

- Welche MCP-Server liegen lokal vor?
- Welche Claude-Profile gibt es?
- Welches Profil passt zu einer Aufgabe?
- Wie kann daraus später ein echter Control-Plane- oder Gateway-Server werden?

## Lokaler Schnelltest

```bash
cd C:\Users\User\OneDrive\.TOPICS\.AI\.MCP\ellmos-controlcenter-mcp
npm install
npm run test
npm run build
```

## Nächster Ausbauschritt

Nach dem MVP sollten diese Schichten ergänzt werden:

1. Profilwechsel und Profilschreiben
2. Tool-Gruppen und Capability-Bundles
3. Policy-Regeln und Allow-/Deny-Logik
4. Job-State für längere Abläufe
5. Optional: Registry- und Gateway-Modus

## Profilwechsel vorbereiten

Der MVP kann Profile auflösen und eine startbare MCP-Config schreiben:

```bash
claude --mcp-config C:\Users\User\.claude\profiles\_generated\software.mcp.json
```

Der Wechsel wird dadurch explizit und nachvollziehbar. Eine laufende Claude-Session wird nicht automatisch beendet.
