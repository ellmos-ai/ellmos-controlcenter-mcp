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
      kind: "Tipo",
      persistentState: "Estado propio",
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
    localModules: (count) => `## Módulos locales (${count})`,
    catalogOnlyServers: (count) => `## Solo en el catálogo, sin directorio (${count})`,
    mcpStateOwner: "Propiedad del estado"
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
    noPlugins: "No se encontraron plugins ni módulos.",
    mcpCatalogOk: (catalogPath, count, updated) => `Catálogo MCP: ${count} entradas de ${catalogPath}${updated ? ` (actualizado ${updated})` : ""}`,
    mcpCatalogMissing: (catalogPath) => `Catálogo MCP no encontrado (${catalogPath}): el tipo y la propiedad del estado quedan vacíos.`,
    mcpCatalogUnreadable: (catalogPath) => `Catálogo MCP ilegible (${catalogPath}): el tipo y la propiedad del estado quedan vacíos.`,
    mcpCatalogSchemaMismatch: (catalogPath, schema) => `El catálogo MCP usa un esquema ajeno (${catalogPath}, encontrado: ${schema}, esperado: ellmos.mcps.v1): el tipo y la propiedad del estado quedan vacíos.`,
    mcpRootUnreadable: (root) => `Raíz MCP ilegible: ${root}`,
    mcpServerUnknown: (serverId, root) => `El servidor MCP '${serverId}' no se conoce ni en ${root} ni en el catálogo.`,
    mcpServerCatalogOnly: (root) => `Solo consta en el catálogo, sin directorio en ${root}.`,
    mcpServerNotInCatalog: (serverId) => `Sin entrada de catálogo para '${serverId}': tipo, propiedad del estado y composición desconocidos.`,
    mcpWraps: "Envuelve",
    mcpWrapsTarget: "Objetivo envuelto",
    mcpTargetKind: "Tipo de destino",
    mcpComposition: "Composición"
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
    controlcenter_actual_self_receipt: {
      title: "Emitir recibo de ejecución firmado de ControlCenter",
      description: "Ejecuta una prueba nativa y de solo lectura list_tools de este servidor ControlCenter y emite un recibo actual-self Ed25519 de corta duración. Requiere configuración local explícita y falla de forma segura."
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
    controlcenter_describe_mcp: {
      title: "Describir servidor MCP",
      description: "Describe un servidor MCP local desde mcps.catalog.v1.json: tipo, espacio de nombres, propiedad del estado, envoltura y composición."
    },
    controlcenter_list_tools: {
      title: "Listar herramientas MCP",
      description: "Inicia servidores MCP locales o definidos por perfil de forma controlada y lee su lista real de herramientas mediante MCP list_tools."
    },
    controlcenter_find_capability: {
      title: "Buscar candidatos vinculados a una resolución",
      description: "Clasifica declaraciones de enlaces nativos desde una resolución de System Explorer coherente con su hash. La procedencia no está verificada; los resultados son consultivos y nunca autorizan ejecución."
    },
    controlcenter_tool_overview: {
      title: "Mostrar resumen vinculado a una resolución",
      description: "Muestra declaraciones de enlaces nativos y separa los estados declarado, instalado, configurado, en ejecución, saludable y observado."
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
    controlcenter_find_skill: {
      title: "Encontrar skills coincidentes",
      description: "Reconoce qué skills aplican a una tarea o intención. IMPORTANTE: consulta con palabras clave/términos técnicos, no con frases completas — la coincidencia es puramente léxica, las frases completas todavía no se interpretan semánticamente y atraen falsos positivos a través de palabras vacías. Clasifica el catálogo de skills escaneado por coincidencia léxica sobre nombre, alias, etiquetas, categoría y descripción, y devuelve los mejores candidatos con los términos coincidentes. Las puntuaciones solo son comparables dentro de una misma consulta, no entre consultas."
    },
    controlcenter_list_skills: {
      title: "Listar skills de Claude Code",
      description: "Inventaría los skills de Claude Code instalados desde la carpeta de skills desplegados y la biblioteca de skills fuente."
    },
    controlcenter_list_stacks: {
      title: "Listar stacks registrados",
      description: "Lee el catálogo neutral de stacks y sus manifiestos ellmos.stack.v2 sin ejecutar componentes."
    },
    controlcenter_describe_stack: {
      title: "Describir stack registrado",
      description: "Muestra componentes tipados, roles requeridos, políticas y avisos de validación de un stack."
    },
    controlcenter_context_pack: {
      title: "Crear paquete de contexto del stack",
      description: "Crea un paquete de contexto compacto y de solo lectura desde un manifiesto de stack registrado. No ejecuta componentes ni lee secretos o estado en vivo."
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
    capabilityQuery: "Palabras clave o capacidades para la clasificación léxica determinista.",
    capabilityLimit: "Número máximo de candidatos. Predeterminado: 10; máximo: 100.",
    resolutionPath: "Ruta a un JSON system-explorer.resolution.v1 coherente con su hash; la verificación de fuente sigue siendo una declaración no confiable sin un recibo externo.",
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
    skillIntent: "Palabras clave/términos técnicos de la tarea para comparar con el catálogo de skills (p. ej. \"depurar bug fallo de test\" en lugar de \"mi programa se bloquea al guardar\"). Las frases completas aún no se evalúan semánticamente; las palabras vacías provocan entonces falsos positivos.",
    skillFinderLimit: "Número máximo de candidatos de skills clasificados a devolver. Predeterminado: 5.",
    stacksRoot: "Ruta opcional al directorio que contiene stacks.catalog.json. Por defecto es la carpeta local .AI/.STACKS.",
    serverId: "Nombre del directorio, ID del catálogo o nombre del paquete npm del servidor MCP.",
    stackId: "ID estable del stack en stacks.catalog.json.",
    contextPackLevel: "Nivel de detalle del paquete de contexto: short, execution o full.",
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
