import type { Translations } from "./types.js";

export const es: Translations = {
  language: {
    name: "Español",
    current: (langName, lang) => `Idioma actual: ${langName} (${lang})`,
    changed: (langName, lang) => `Idioma configurado en ${langName} (${lang}).`,
    supported: (languages) => `Idiomas admitidos: ${languages}`,
    note: "Todos los idiomas admitidos tienen conjuntos de texto mantenidos; los títulos y descripciones de bundles personalizados se muestran como fueron escritos."
  },
  common: {
    yes: "sí",
    no: "no",
    none: "-",
    allLocalServers: "todos los servidores MCP locales",
    allProfileServers: "todos los servidores del perfil",
    notAvailable: "-",
    noLocalServers: "No se encontraron servidores MCP locales.",
    noProfiles: "No se encontraron perfiles de Claude.",
    noBundles: "No hay bundles de capacidades disponibles.",
    noToolScanServers: "No se encontraron servidores MCP para el escaneo de herramientas.",
    noToolsReported: "No se informaron herramientas.",
    noBundleAssignments: "No se calcularon asignaciones de bundles.",
    noMatchingTools: "No hay herramientas coincidentes.",
    unsupportedStartForm: "Forma de inicio MCP no admitida.",
    serverConfigNotObject: "La configuración del servidor no es un objeto.",
    noSupportedStartForm: "No se detectó una forma de inicio MCP admitida.",
    status: "Estado",
    source: "Fuente",
    filter: "Filtro",
    transport: "Transporte",
    tools: "Herramientas",
    duration: "Duración",
    start: "Inicio",
    error: "Error",
    active: "activo",
    id: "ID",
    keywords: "Palabras clave",
    server: "Servidor",
    servers: "Servidores",
    profile: "Perfil",
    profiles: "Perfiles",
    output: "Salida",
    written: "Escrito",
    command: "Comando de inicio",
    details: "Detalles",
    findings: "Hallazgos",
    severity: "Severidad",
    hint: "Nota",
    high: "Alta",
    warning: "Advertencia",
    info: "Info"
  },
  tables: {
    server: {
      repo: "Repo",
      version: "Versión",
      tools: "Herramientas",
      serverJson: "server.json",
      path: "Ruta"
    },
    profile: {
      profile: "Perfil",
      extends: "Extiende",
      server: "Servidores",
      file: "Archivo"
    },
    bundle: {
      bundle: "Bundle",
      server: "Servidores",
      tools: "Herramientas",
      description: "Descripción"
    },
    tool: {
      tool: "Herramienta",
      title: "Título",
      description: "Descripción"
    },
    assignment: {
      server: "Servidor",
      tool: "Herramienta",
      matches: "Coincidencias",
      description: "Descripción"
    },
    skill: {
      name: "Nombre",
      description: "Descripción",
      version: "Versión",
      deployed: "Desplegado",
      category: "Categoría",
      path: "Ruta"
    },
    plugin: {
      name: "Nombre",
      type: "Tipo",
      version: "Versión",
      marketplaceScope: "Marketplace/Scope",
      skills: "Skills",
      commands: "Comandos",
      mcp: "MCP",
      path: "Ruta"
    }
  },
  headings: {
    statusTitle: "# Estado de ellmos ControlCenter",
    localServers: (root) => `# Servidores MCP locales en ${root}`,
    localRepos: "## Repositorios MCP locales",
    claudeProfiles: (root) => root ? `# Perfiles de Claude en ${root}` : "## Perfiles de Claude",
    capabilityBundles: (root) => root ? `# Bundles de capacidades en ${root}` : "## Bundles de capacidades",
    details: "## Detalles",
    bundleRecommendation: "# Recomendación de bundles",
    profileRecommendation: "# Recomendación de perfil",
    resolvedProfile: "# Perfil resuelto",
    profileSwitchPrepared: "# Cambio de perfil preparado",
    profileAudit: "# Auditoría de perfil",
    mcpServers: "## Servidores MCP",
    catalogCreated: "# Catálogo creado",
    toolCatalog: "# Catálogo de herramientas MCP",
    toolBundleAssignment: "# Asignación de herramientas a bundles",
    probeNotes: "## Notas de sondeo",
    language: "# Idioma de ControlCenter",
    deployedSkills: (count) => `## Skills desplegados (${count})`,
    sourceOnlySkills: (count) => `## Skills solo-fuente (${count})`,
    claudeCodePlugins: (count) => `## Plugins de Claude Code (${count})`,
    localModules: (count) => `## Módulos locales (${count})`
  },
  messages: {
    sourceLocalRepos: (root) => `Repositorios MCP locales en ${root}`,
    sourceProfile: (profileName, profileRoot) => `Perfil ${profileName} en ${profileRoot}`,
    recommendation: "Recomendación",
    score: "Puntuación",
    rationale: "Motivo",
    noStrongBundleMatches: "No se detectaron coincidencias fuertes de bundles.",
    noStrongProfileKeywords: "No se detectaron palabras clave fuertes. El perfil base es la recomendación segura por defecto.",
    profileRationale: (count, keywords) => `Recomendado porque coincidieron ${count} palabras clave: ${keywords}`,
    mcpRoot: "MCP root",
    profileRoot: "Raíz de perfiles",
    localRepoCount: "Repositorios MCP locales",
    profileCount: "Perfiles de Claude",
    serverProbes: "Sondeos de servidor",
    failedProbes: "Sondeos fallidos",
    policyRules: "Reglas de policy",
    generatedConfig: "Configuración generada",
    serverCount: "Servidores",
    toolScan: "Escaneo de herramientas",
    profileToolScan: "Escaneo de herramientas del perfil",
    toolBundleAssignment: "Asignación de herramientas a bundles",
    resolvedServers: "servidores resueltos",
    skillsRoot: "Raíz de skills",
    sourceSkillsRoot: "Raíz de skills fuente",
    skipped: "(omitido)",
    pluginsRoot: "Raíz de plugins",
    modulesRoot: "Raíz de módulos",
    skillsTotal: (total, deployed, sourceOnly) => `Total: ${total} (${deployed} desplegados, ${sourceOnly} solo-fuente)`,
    pluginsTotal: (total, plugins, modules) => `Total: ${total} (${plugins} plugins, ${modules} módulos)`,
    noSkills: "No se encontraron skills.",
    noPlugins: "No se encontraron plugins ni módulos."
  },
  policy: {
    invalidServerConfig: "La configuración del servidor no es un objeto.",
    missingCommand: "El servidor no tiene una entrada de comando ejecutable.",
    npxRuntimeFetch: "El servidor se inicia mediante npx. Es cómodo, pero menos reproducible que una ruta local fijada.",
    envSecretsPresent: "La configuración del servidor contiene variables de entorno. Los valores no se devuelven intencionalmente.",
    sensitiveArgName: "Los argumentos del servidor contienen nombres que parecen sensibles. Revisa el contenido por separado.",
    noFindings: "No se encontraron indicios de policy en el perfil resuelto."
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "Estado de ControlCenter",
      description: "Muestra una vista general del stack MCP local, los servidores locales y los perfiles de Claude."
    },
    controlcenter_get_language: {
      title: "Mostrar idioma de ControlCenter",
      description: "Muestra el idioma actual de salida de ControlCenter y los códigos de idioma admitidos."
    },
    controlcenter_set_language: {
      title: "Configurar idioma de ControlCenter",
      description: "Configura el idioma de salida de ControlCenter para esta instancia MCP en ejecución."
    },
    controlcenter_list_local_servers: {
      title: "Listar servidores MCP locales",
      description: "Escanea el MCP root local y lista los repositorios MCP encontrados con metadatos."
    },
    controlcenter_list_tools: {
      title: "Listar herramientas MCP",
      description: "Inicia servidores MCP locales o definidos por perfil de forma controlada y lee su lista real de herramientas mediante MCP list_tools."
    },
    controlcenter_assign_tool_bundles: {
      title: "Asignar herramientas a bundles de capacidades",
      description: "Asigna herramientas MCP reales a los bundles de capacidades de ControlCenter usando sus metadatos."
    },
    controlcenter_list_bundles: {
      title: "Listar bundles de capacidades",
      description: "Agrupa servidores MCP locales en bundles de tareas como software, filesystem, automatización y control plane."
    },
    controlcenter_suggest_bundles: {
      title: "Sugerir bundles de capacidades",
      description: "Sugiere bundles de capacidades que coinciden con una descripción de tarea."
    },
    controlcenter_list_profiles: {
      title: "Listar perfiles de Claude",
      description: "Lee perfiles locales de Claude y muestra recuentos de servidores, herencia y rutas de archivo."
    },
    controlcenter_suggest_profile: {
      title: "Sugerir perfil",
      description: "Sugiere un perfil de Claude a partir de una descripción de tarea."
    },
    controlcenter_resolve_profile: {
      title: "Resolver perfil de Claude",
      description: "Resuelve un perfil de Claude, incluida la herencia opcional, y muestra los servidores MCP resultantes."
    },
    controlcenter_switch_profile: {
      title: "Preparar cambio de perfil",
      description: "Prepara un cambio de perfil creando o previsualizando un archivo --mcp-config resuelto."
    },
    controlcenter_audit_profile: {
      title: "Auditar perfil de Claude",
      description: "Comprueba un perfil de Claude resuelto en busca de indicios iniciales de policy como inicios con npx, env secrets y configuraciones inválidas."
    },
    controlcenter_build_catalog: {
      title: "Crear catálogo de servidores locales",
      description: "Crea un catálogo JSON de los servidores MCP descubiertos localmente."
    },
    controlcenter_list_skills: {
      title: "Listar skills de Claude Code",
      description: "Inventaría los skills de Claude Code instalados desde la carpeta de skills desplegados y la biblioteca de skills fuente."
    },
    controlcenter_list_plugins: {
      title: "Listar plugins y módulos",
      description: "Inventaría los plugins de Claude Code instalados y los módulos ellmos locales con sus capacidades."
    }
  },
  inputDescriptions: {
    language: "Código de idioma para la salida de ControlCenter.",
    mcpRoot: "MCP root opcional. Por defecto usa la carpeta MCP local de ellmos.",
    profileName: "Nombre de perfil opcional. Si se define, se escanean los servidores resueltos de ese perfil de Claude.",
    requiredProfileName: "Nombre de perfil sin .json, por ejemplo software o ai-lab.",
    profileRoot: "Carpeta de perfiles opcional. Por defecto es ~/.claude/profiles.",
    serverName: "Nombre opcional de servidor, paquete, mcpName o servidor de perfil para un escaneo específico.",
    simpleServerName: "Nombre opcional de servidor para un escaneo específico.",
    timeoutMs: "Timeout por escaneo de herramientas MCP en milisegundos. Por defecto: 5000.",
    listToolsTimeoutMs: "Timeout por solicitud de conexión y list_tools en milisegundos. Por defecto: 5000.",
    bundleConfigPath: "Ruta opcional a una configuración de bundles de capacidades.",
    task: "Descripción de la tarea u objetivo de la sesión.",
    outputPath: "Ubicación de salida opcional para la configuración MCP generada.",
    launchTemplate: "Plantilla opcional del comando de inicio. Usa {config} como marcador para la ruta de la configuración MCP generada.",
    write: "Si es true, se escribe la configuración generada. Si no, solo se devuelve una vista previa.",
    policyConfigPath: "Ruta opcional a una configuración de reglas de policy.",
    catalogOutputPath: "Ubicación de salida opcional para el catálogo JSON.",
    includeTools: "Si es true, se inician servidores MCP locales y se añaden resultados reales de list_tools al catálogo.",
    includeToolAssignments: "Si es true, se añaden asignaciones de herramientas a bundles para las herramientas escaneadas.",
    skillsRoot: "Ruta opcional a la carpeta de skills desplegados de Claude Code. Por defecto es ~/.claude/skills.",
    sourceSkillsRoot: "Ruta opcional al root de la biblioteca de skills fuente. Por defecto es la carpeta .AI/.SKILLS/skills local.",
    pluginsRoot: "Ruta opcional a la carpeta de plugins de Claude Code. Por defecto es ~/.claude/plugins.",
    modulesRoot: "Ruta opcional a la carpeta de módulos ellmos. Por defecto es la carpeta .AI/.MODULES local.",
    deployedOnly: "Si es true, solo se devuelven los skills desplegados y no se escanea la biblioteca de skills fuente.",
    pluginsOnly: "Si es true, solo se devuelven los plugins de Claude Code y no se escanean los módulos locales.",
    modulesOnly: "Si es true, solo se devuelven los módulos locales y no se escanean los plugins de Claude Code."
  },
  dashboard: {
    loading: "cargando...",
    refresh: "Actualizar",
    writeConfig: "Generar configuración MCP",
    language: "Idioma",
    profile: "Perfil",
    audit: "Auditoría",
    localServers: "Servidores locales",
    capabilityBundles: "Bundles de capacidades",
    toolCatalog: "Catálogo de herramientas",
    toolBundleAssignment: "Asignación de herramientas a bundles",
    generatedConfig: "Configuración generada",
    toolScopeProfile: "Perfil",
    toolScopeLocal: "Repos locales",
    scan: "Escanear",
    timeoutLabel: "Timeout en milisegundos",
    noToolScan: "Aún no se ejecutó ningún escaneo de herramientas.",
    noAction: "Aún no se ejecutó ninguna acción.",
    noDescription: "Sin descripción",
    active: "activo",
    enableVerb: "activar",
    disableVerb: "desactivar",
    confirmServerPrefix: "Cambiar servidor '",
    confirmServerMiddle: "' en el perfil '",
    confirmServerSuffix: "? Se crea una copia de seguridad antes de escribir.",
    confirmWritePrefix: "¿Escribir configuración MCP generada para el perfil '",
    confirmWriteSuffix: "'? Un archivo existente se respalda primero.",
    scanRunning: "Escaneo en curso...",
    noToolsReported: "No se informaron herramientas.",
    noMatchingTools: "No hay herramientas coincidentes.",
    serverOk: "servidores OK",
    high: "alta",
    warning: "advertencia",
    info: "info",
    resolvedServers: "servidores resueltos",
    apiError: "Error de API"
  }
};
