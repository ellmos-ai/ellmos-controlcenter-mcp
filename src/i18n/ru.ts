import type { Translations } from "./types.js";

export const ru: Translations = {
  language: {
    name: "Русский",
    current: (langName, lang) => `Текущий язык: ${langName} (${lang})`,
    changed: (langName, lang) => `Язык установлен: ${langName} (${lang}).`,
    supported: (languages) => `Поддерживаемые языки: ${languages}`,
    note: "Для всех поддерживаемых языков есть сопровождаемые текстовые наборы; заголовки и описания пользовательских bundle показываются как заданы."
  },
  common: {
    yes: "да",
    no: "нет",
    none: "-",
    allLocalServers: "все локальные MCP-серверы",
    allProfileServers: "все серверы профиля",
    notAvailable: "-",
    noLocalServers: "Локальные MCP-серверы не найдены.",
    noProfiles: "Профили Claude не найдены.",
    noBundles: "Нет доступных bundle возможностей.",
    noToolScanServers: "MCP-серверы для сканирования инструментов не найдены.",
    noToolsReported: "Инструменты не заявлены.",
    noBundleAssignments: "Назначения bundle не рассчитаны.",
    noMatchingTools: "Нет подходящих инструментов.",
    unsupportedStartForm: "Неподдерживаемая форма запуска MCP.",
    serverConfigNotObject: "Конфигурация сервера не является объектом.",
    noSupportedStartForm: "Поддерживаемая форма запуска MCP не обнаружена.",
    status: "Статус",
    source: "Источник",
    filter: "Фильтр",
    transport: "Транспорт",
    tools: "Инструменты",
    duration: "Длительность",
    start: "Запуск",
    error: "Ошибка",
    active: "активен",
    id: "ID",
    keywords: "Ключевые слова",
    server: "Сервер",
    servers: "Серверы",
    profile: "Профиль",
    profiles: "Профили",
    output: "Вывод",
    written: "Записано",
    command: "Команда запуска",
    details: "Детали",
    findings: "Находки",
    severity: "Серьезность",
    hint: "Подсказка",
    high: "Высокая",
    warning: "Предупреждение",
    info: "Инфо"
  },
  tables: {
    server: {
      repo: "Репозиторий",
      version: "Версия",
      tools: "Инструменты",
      serverJson: "server.json",
      path: "Путь"
    },
    profile: {
      profile: "Профиль",
      extends: "Наследует",
      server: "Серверы",
      file: "Файл"
    },
    bundle: {
      bundle: "Bundle",
      server: "Серверы",
      tools: "Инструменты",
      description: "Описание"
    },
    tool: {
      tool: "Инструмент",
      title: "Заголовок",
      description: "Описание"
    },
    assignment: {
      server: "Сервер",
      tool: "Инструмент",
      matches: "Совпадения",
      description: "Описание"
    },
    skill: {
      name: "Название",
      description: "Описание",
      version: "Версия",
      deployed: "Развёрнут",
      category: "Категория",
      path: "Путь"
    },
    plugin: {
      name: "Название",
      type: "Тип",
      version: "Версия",
      marketplaceScope: "Маркет/Scope",
      skills: "Skills",
      commands: "Команды",
      mcp: "MCP",
      path: "Путь"
    }
  },
  headings: {
    statusTitle: "# Статус ellmos ControlCenter",
    localServers: (root) => `# Локальные MCP-серверы в ${root}`,
    localRepos: "## Локальные MCP-репозитории",
    claudeProfiles: (root) => root ? `# Профили Claude в ${root}` : "## Профили Claude",
    capabilityBundles: (root) => root ? `# Bundle возможностей в ${root}` : "## Bundle возможностей",
    details: "## Детали",
    bundleRecommendation: "# Рекомендация bundle",
    profileRecommendation: "# Рекомендация профиля",
    resolvedProfile: "# Разрешенный профиль",
    profileSwitchPrepared: "# Переключение профиля подготовлено",
    profileAudit: "# Аудит профиля",
    mcpServers: "## MCP-серверы",
    catalogCreated: "# Каталог создан",
    toolCatalog: "# Каталог MCP-инструментов",
    toolBundleAssignment: "# Назначение инструментов bundle",
    probeNotes: "## Заметки probe",
    language: "# Язык ControlCenter",
    deployedSkills: (count) => `## Развёрнутые Skills (${count})`,
    sourceOnlySkills: (count) => `## Только-исходные Skills (${count})`,
    claudeCodePlugins: (count) => `## Плагины Claude Code (${count})`,
    localModules: (count) => `## Локальные модули (${count})`
  },
  messages: {
    sourceLocalRepos: (root) => `Локальные MCP-репозитории в ${root}`,
    sourceProfile: (profileName, profileRoot) => `Профиль ${profileName} в ${profileRoot}`,
    recommendation: "Рекомендация",
    score: "Оценка",
    rationale: "Обоснование",
    noStrongBundleMatches: "Сильные совпадения bundle не обнаружены.",
    noStrongProfileKeywords: "Сильные ключевые слова не обнаружены. Профиль base является безопасной рекомендацией по умолчанию.",
    profileRationale: (count, keywords) => `Рекомендуется, потому что совпали ключевые слова (${count}): ${keywords}`,
    mcpRoot: "MCP root",
    profileRoot: "Корень профилей",
    localRepoCount: "Локальные MCP-репозитории",
    profileCount: "Профили Claude",
    serverProbes: "Проверки серверов",
    failedProbes: "Неудачные проверки",
    policyRules: "Правила policy",
    generatedConfig: "Сгенерированная конфигурация",
    serverCount: "Серверы",
    toolScan: "Сканирование инструментов",
    profileToolScan: "Сканирование инструментов профиля",
    toolBundleAssignment: "Назначение инструментов bundle",
    resolvedServers: "разрешенные серверы",
    skillsRoot: "Корень Skills",
    sourceSkillsRoot: "Корень исходных Skills",
    skipped: "(пропущено)",
    pluginsRoot: "Корень плагинов",
    modulesRoot: "Корень модулей",
    skillsTotal: (total, deployed, sourceOnly) => `Всего: ${total} (${deployed} развёрнуто, ${sourceOnly} только-исходные)`,
    pluginsTotal: (total, plugins, modules) => `Всего: ${total} (${plugins} плагинов, ${modules} модулей)`,
    noSkills: "Skills не найдены.",
    noPlugins: "Плагины или модули не найдены."
  },
  policy: {
    invalidServerConfig: "Конфигурация сервера не является объектом.",
    missingCommand: "У сервера нет исполняемой записи command.",
    npxRuntimeFetch: "Сервер запускается через npx. Это удобно, но менее воспроизводимо, чем закрепленный локальный путь.",
    envSecretsPresent: "Конфигурация сервера содержит переменные окружения. Значения намеренно не возвращаются.",
    sensitiveArgName: "Аргументы сервера содержат имена, похожие на чувствительные. Проверьте содержимое отдельно.",
    noFindings: "В разрешенном профиле не найдено policy-подсказок."
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "Статус ControlCenter",
      description: "Показывает обзор локального MCP-stack, локальных серверов и профилей Claude."
    },
    controlcenter_get_language: {
      title: "Показать язык ControlCenter",
      description: "Показывает текущий язык вывода ControlCenter и поддерживаемые языковые коды."
    },
    controlcenter_set_language: {
      title: "Установить язык ControlCenter",
      description: "Устанавливает язык вывода ControlCenter для текущего запущенного MCP-сервера."
    },
    controlcenter_list_local_servers: {
      title: "Список локальных MCP-серверов",
      description: "Сканирует локальный MCP root и выводит найденные MCP-репозитории с метаданными."
    },
    controlcenter_list_tools: {
      title: "Список MCP-инструментов",
      description: "Контролируемо запускает локальные или заданные профилем MCP-серверы и читает их реальный список инструментов через MCP list_tools."
    },
    controlcenter_assign_tool_bundles: {
      title: "Назначить инструменты bundle возможностей",
      description: "Назначает реальные MCP-инструменты bundle возможностей ControlCenter на основе их метаданных."
    },
    controlcenter_list_bundles: {
      title: "Список bundle возможностей",
      description: "Группирует локальные MCP-серверы в task bundle, например software, filesystem, automation и control plane."
    },
    controlcenter_suggest_bundles: {
      title: "Предложить bundle возможностей",
      description: "Предлагает подходящие bundle возможностей по описанию задачи."
    },
    controlcenter_list_profiles: {
      title: "Список профилей Claude",
      description: "Читает локальные профили Claude и показывает количество серверов, наследование и пути файлов."
    },
    controlcenter_suggest_profile: {
      title: "Предложить профиль",
      description: "Предлагает профиль Claude по описанию задачи."
    },
    controlcenter_resolve_profile: {
      title: "Разрешить профиль Claude",
      description: "Разрешает профиль Claude, включая необязательное наследование, и показывает итоговые MCP-серверы."
    },
    controlcenter_switch_profile: {
      title: "Подготовить переключение профиля",
      description: "Готовит переключение профиля, создавая или предварительно показывая разрешенный файл --mcp-config."
    },
    controlcenter_audit_profile: {
      title: "Аудит профиля Claude",
      description: "Проверяет разрешенный профиль Claude на первые policy-подсказки, такие как запуск через npx, env secrets и недопустимые конфигурации серверов."
    },
    controlcenter_build_catalog: {
      title: "Создать каталог локальных серверов",
      description: "Создает JSON-каталог локально найденных MCP-серверов."
    },
    controlcenter_list_skills: {
      title: "Список skills Claude Code",
      description: "Инвентаризирует установленные skills Claude Code из папки развернутых skills и библиотеки исходных skills."
    },
    controlcenter_list_plugins: {
      title: "Список плагинов и модулей",
      description: "Инвентаризирует установленные плагины Claude Code и локальные модули ellmos с их возможностями."
    }
  },
  inputDescriptions: {
    language: "Языковой код для вывода ControlCenter.",
    mcpRoot: "Необязательный MCP root. По умолчанию используется локальная папка ellmos MCP.",
    profileName: "Необязательное имя профиля. Если задано, сканируются разрешенные серверы этого профиля Claude.",
    requiredProfileName: "Имя профиля без .json, например software или ai-lab.",
    profileRoot: "Необязательная папка профилей. По умолчанию ~/.claude/profiles.",
    serverName: "Необязательное имя сервера, имя пакета, mcpName или имя сервера профиля для точечного сканирования.",
    simpleServerName: "Необязательное имя сервера для точечного сканирования.",
    timeoutMs: "Таймаут на сканирование MCP-инструментов в миллисекундах. По умолчанию: 5000.",
    listToolsTimeoutMs: "Таймаут на connect и list_tools-запрос в миллисекундах. По умолчанию: 5000.",
    bundleConfigPath: "Необязательный путь к конфигурации bundle возможностей.",
    task: "Описание задачи или цель сессии.",
    outputPath: "Необязательное место вывода для сгенерированной MCP-конфигурации.",
    launchTemplate: "Необязательный шаблон команды запуска. Используйте {config} как заполнитель пути к сгенерированной MCP-конфигурации.",
    write: "Если true, сгенерированная конфигурация записывается. Иначе возвращается только предпросмотр.",
    policyConfigPath: "Необязательный путь к конфигурации policy-правил.",
    catalogOutputPath: "Необязательное место вывода для JSON-каталога.",
    includeTools: "Если true, локальные MCP-серверы запускаются, а реальные результаты list_tools добавляются в каталог.",
    includeToolAssignments: "Если true, для просканированных инструментов добавляются назначения tool bundle.",
    skillsRoot: "Необязательный путь к папке развернутых skills Claude Code. По умолчанию ~/.claude/skills.",
    sourceSkillsRoot: "Необязательный путь к корню библиотеки исходных skills. По умолчанию локальная папка .AI/.SKILLS/skills.",
    pluginsRoot: "Необязательный путь к папке плагинов Claude Code. По умолчанию ~/.claude/plugins.",
    modulesRoot: "Необязательный путь к папке модулей ellmos. По умолчанию локальная папка .AI/.MODULES.",
    deployedOnly: "Если true, возвращаются только развернутые skills, библиотека исходных skills не сканируется.",
    pluginsOnly: "Если true, возвращаются только плагины Claude Code, локальные модули не сканируются.",
    modulesOnly: "Если true, возвращаются только локальные модули, плагины Claude Code не сканируются."
  },
  dashboard: {
    loading: "загрузка...",
    refresh: "Обновить",
    writeConfig: "Создать MCP-конфиг",
    language: "Язык",
    profile: "Профиль",
    audit: "Аудит",
    localServers: "Локальные серверы",
    capabilityBundles: "Bundle возможностей",
    toolCatalog: "Каталог инструментов",
    toolBundleAssignment: "Назначение инструментов bundle",
    generatedConfig: "Сгенерированная конфигурация",
    toolScopeProfile: "Профиль",
    toolScopeLocal: "Локальные репозитории",
    scan: "Сканировать",
    timeoutLabel: "Таймаут в миллисекундах",
    noToolScan: "Сканирование инструментов еще не запускалось.",
    noAction: "Действия еще не выполнялись.",
    noDescription: "Нет описания",
    active: "активен",
    enableVerb: "включить",
    disableVerb: "отключить",
    confirmServerPrefix: "Изменить сервер '",
    confirmServerMiddle: "' в профиле '",
    confirmServerSuffix: "? Перед записью будет создана резервная копия.",
    confirmWritePrefix: "Записать сгенерированный MCP-конфиг для профиля '",
    confirmWriteSuffix: "'? Существующий файл сначала будет сохранен как резервная копия.",
    scanRunning: "Сканирование выполняется...",
    noToolsReported: "Инструменты не заявлены.",
    noMatchingTools: "Нет подходящих инструментов.",
    serverOk: "серверы OK",
    high: "высокая",
    warning: "предупреждение",
    info: "инфо",
    resolvedServers: "разрешенные серверы",
    apiError: "Ошибка API"
  }
};
