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

## Virtueller Gateway (Phase 4): bewusst zurückgestellt [U 2026-07-23]

**Vom Nutzer ratifiziert (2026-07-23, auf direkte Rückfrage):** Der virtuelle MCP-Gateway
(ROADMAP Phase 4) und die darunterliegende adapter-gated Execution + Audit (Plan P3) bleiben
offen. Sie sind eine große, freigabepflichtige Ausbaustufe und werden **nicht autonom**
gebaut — ein erster P3-Schritt (`controlcenter_plan_capability` als Dry-Run) oder der volle
Gateway brauchen jeweils eine dedizierte, freigegebene Session. Der Nutzer hat „Befund + Doku
ist korrekter Abschluss" gewählt; die Duplikat-Vermeidung + Doku-Reconciliation ist der
akzeptierte Abschluss dieses Ausbau-Auftrags für controlcenter.

