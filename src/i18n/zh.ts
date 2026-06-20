import type { Translations } from "./types.js";

export const zh: Translations = {
  language: {
    name: "中文",
    current: (langName, lang) => `当前语言：${langName} (${lang})`,
    changed: (langName, lang) => `语言已设置为 ${langName} (${lang})。`,
    supported: (languages) => `支持的语言：${languages}`,
    note: "所有受支持语言都维护了文本集；自定义 bundle 的标题和描述按原文显示。"
  },
  common: {
    yes: "是",
    no: "否",
    none: "-",
    allLocalServers: "所有本地 MCP 服务器",
    allProfileServers: "所有配置文件服务器",
    notAvailable: "-",
    noLocalServers: "未找到本地 MCP 服务器。",
    noProfiles: "未找到 Claude 配置文件。",
    noBundles: "没有可用的能力 bundle。",
    noToolScanServers: "未找到可用于工具扫描的 MCP 服务器。",
    noToolsReported: "未报告工具。",
    noBundleAssignments: "尚未计算 bundle 分配。",
    noMatchingTools: "没有匹配的工具。",
    unsupportedStartForm: "不支持的 MCP 启动形式。",
    serverConfigNotObject: "服务器配置不是对象。",
    noSupportedStartForm: "未检测到受支持的 MCP 启动形式。",
    status: "状态",
    source: "来源",
    filter: "筛选",
    transport: "传输",
    tools: "工具",
    duration: "耗时",
    start: "启动",
    error: "错误",
    active: "已启用",
    id: "ID",
    keywords: "关键词",
    server: "服务器",
    servers: "服务器",
    profile: "配置文件",
    profiles: "配置文件",
    output: "输出",
    written: "已写入",
    command: "启动命令",
    details: "详情",
    findings: "发现项",
    severity: "严重性",
    hint: "提示",
    high: "高",
    warning: "警告",
    info: "信息"
  },
  tables: {
    server: {
      repo: "仓库",
      version: "版本",
      tools: "工具",
      serverJson: "server.json",
      path: "路径"
    },
    profile: {
      profile: "配置文件",
      extends: "继承",
      server: "服务器",
      file: "文件"
    },
    bundle: {
      bundle: "Bundle",
      server: "服务器",
      tools: "工具",
      description: "描述"
    },
    tool: {
      tool: "工具",
      title: "标题",
      description: "描述"
    },
    assignment: {
      server: "服务器",
      tool: "工具",
      matches: "匹配",
      description: "描述"
    },
    skill: {
      name: "名称",
      description: "描述",
      version: "版本",
      deployed: "已部署",
      category: "分类",
      path: "路径"
    },
    plugin: {
      name: "名称",
      type: "类型",
      version: "版本",
      marketplaceScope: "市场/范围",
      skills: "Skills",
      commands: "命令",
      mcp: "MCP",
      path: "路径"
    }
  },
  headings: {
    statusTitle: "# ellmos ControlCenter 状态",
    localServers: (root) => `# ${root} 中的本地 MCP 服务器`,
    localRepos: "## 本地 MCP 仓库",
    claudeProfiles: (root) => root ? `# ${root} 中的 Claude 配置文件` : "## Claude 配置文件",
    capabilityBundles: (root) => root ? `# ${root} 中的能力 bundle` : "## 能力 bundle",
    details: "## 详情",
    bundleRecommendation: "# Bundle 推荐",
    profileRecommendation: "# 配置文件推荐",
    resolvedProfile: "# 已解析的配置文件",
    profileSwitchPrepared: "# 配置文件切换已准备",
    profileAudit: "# 配置文件审计",
    mcpServers: "## MCP 服务器",
    catalogCreated: "# 目录已创建",
    toolCatalog: "# MCP 工具目录",
    toolBundleAssignment: "# 工具 bundle 分配",
    probeNotes: "## 探测说明",
    language: "# ControlCenter 语言",
    deployedSkills: (count) => `## 已部署 Skills (${count})`,
    sourceOnlySkills: (count) => `## 仅源码 Skills (${count})`,
    claudeCodePlugins: (count) => `## Claude Code 插件 (${count})`,
    localModules: (count) => `## 本地模块 (${count})`
  },
  messages: {
    sourceLocalRepos: (root) => `${root} 中的本地 MCP 仓库`,
    sourceProfile: (profileName, profileRoot) => `${profileRoot} 中的配置文件 ${profileName}`,
    recommendation: "推荐",
    score: "分数",
    rationale: "理由",
    noStrongBundleMatches: "未检测到强匹配的 bundle。",
    noStrongProfileKeywords: "未检测到强关键词。base 配置文件是安全的默认推荐。",
    profileRationale: (count, keywords) => `推荐原因：匹配了 ${count} 个关键词：${keywords}`,
    mcpRoot: "MCP 根目录",
    profileRoot: "配置文件根目录",
    localRepoCount: "本地 MCP 仓库",
    profileCount: "Claude 配置文件",
    serverProbes: "服务器探测",
    failedProbes: "失败探测",
    policyRules: "Policy 规则",
    generatedConfig: "生成的配置",
    serverCount: "服务器",
    toolScan: "工具扫描",
    profileToolScan: "配置文件工具扫描",
    toolBundleAssignment: "工具 bundle 分配",
    resolvedServers: "已解析服务器",
    skillsRoot: "Skills 根目录",
    sourceSkillsRoot: "源码 Skills 根目录",
    skipped: "（跳过）",
    pluginsRoot: "插件根目录",
    modulesRoot: "模块根目录",
    skillsTotal: (total, deployed, sourceOnly) => `共计: ${total}（${deployed} 已部署，${sourceOnly} 仅源码）`,
    pluginsTotal: (total, plugins, modules) => `共计: ${total}（${plugins} 插件，${modules} 模块）`,
    noSkills: "未找到 Skills。",
    noPlugins: "未找到插件或模块。"
  },
  policy: {
    invalidServerConfig: "服务器配置不是对象。",
    missingCommand: "服务器缺少可执行的 command 条目。",
    npxRuntimeFetch: "服务器通过 npx 启动。这很方便，但可复现性不如固定的本地路径。",
    envSecretsPresent: "服务器配置包含环境变量。值会被有意隐藏。",
    sensitiveArgName: "服务器参数包含看起来敏感的名称。请单独检查其内容。",
    noFindings: "已解析的配置文件中没有发现 policy 提示。"
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "ControlCenter 状态",
      description: "显示本地 MCP stack、本地服务器和 Claude 配置文件的概览。"
    },
    controlcenter_get_language: {
      title: "显示 ControlCenter 语言",
      description: "显示当前 ControlCenter 输出语言和支持的语言代码。"
    },
    controlcenter_set_language: {
      title: "设置 ControlCenter 语言",
      description: "为当前运行的 MCP 服务器实例设置 ControlCenter 输出语言。"
    },
    controlcenter_list_local_servers: {
      title: "列出本地 MCP 服务器",
      description: "扫描本地 MCP 根目录，并列出发现的 MCP 仓库及其元数据。"
    },
    controlcenter_list_tools: {
      title: "列出 MCP 工具",
      description: "以受控方式启动本地或配置文件定义的 MCP 服务器，并通过 MCP list_tools 读取真实工具列表。"
    },
    controlcenter_assign_tool_bundles: {
      title: "将工具分配给能力 bundle",
      description: "根据真实 MCP 工具的元数据，将其分配给 ControlCenter 能力 bundle。"
    },
    controlcenter_list_bundles: {
      title: "列出能力 bundle",
      description: "将本地 MCP 服务器分组为软件、filesystem、自动化和 control plane 等任务 bundle。"
    },
    controlcenter_suggest_bundles: {
      title: "推荐能力 bundle",
      description: "根据任务描述推荐匹配的能力 bundle。"
    },
    controlcenter_list_profiles: {
      title: "列出 Claude 配置文件",
      description: "读取本地 Claude 配置文件，并显示服务器数量、继承关系和文件路径。"
    },
    controlcenter_suggest_profile: {
      title: "推荐配置文件",
      description: "根据任务描述推荐 Claude 配置文件。"
    },
    controlcenter_resolve_profile: {
      title: "解析 Claude 配置文件",
      description: "解析 Claude 配置文件，包括可选继承，并显示最终 MCP 服务器。"
    },
    controlcenter_switch_profile: {
      title: "准备配置文件切换",
      description: "通过创建或预览已解析的 --mcp-config 文件来准备配置文件切换。"
    },
    controlcenter_audit_profile: {
      title: "审计 Claude 配置文件",
      description: "检查已解析的 Claude 配置文件中是否存在 npx 启动、env secrets 和无效服务器配置等初始 policy 提示。"
    },
    controlcenter_build_catalog: {
      title: "构建本地服务器目录",
      description: "为本地发现的 MCP 服务器创建 JSON 目录。"
    },
    controlcenter_list_skills: {
      title: "列出 Claude Code Skills",
      description: "从已部署 skills 文件夹和 skills 源库中列出已安装的 Claude Code skills。"
    },
    controlcenter_list_plugins: {
      title: "列出插件和模块",
      description: "列出已安装的 Claude Code 插件和本地 ellmos 模块及其功能。"
    }
  },
  inputDescriptions: {
    language: "ControlCenter 输出使用的语言代码。",
    mcpRoot: "可选 MCP 根目录。默认使用本地 ellmos MCP 文件夹。",
    profileName: "可选配置文件名。设置后会扫描该 Claude 配置文件解析出的服务器。",
    requiredProfileName: "不带 .json 的配置文件名，例如 software 或 ai-lab。",
    profileRoot: "可选配置文件夹。默认是 ~/.claude/profiles。",
    serverName: "可选服务器名、包名、mcpName 或配置文件服务器名，用于定向扫描。",
    simpleServerName: "可选服务器名，用于定向扫描。",
    timeoutMs: "每次 MCP 工具扫描的超时时间，单位毫秒。默认：5000。",
    listToolsTimeoutMs: "每次 connect 和 list_tools 请求的超时时间，单位毫秒。默认：5000。",
    bundleConfigPath: "能力 bundle 配置的可选路径。",
    task: "任务描述或会话目标。",
    outputPath: "生成 MCP 配置的可选输出位置。",
    write: "为 true 时写入生成的配置；否则只返回预览。",
    policyConfigPath: "policy 规则配置的可选路径。",
    catalogOutputPath: "JSON 目录的可选输出位置。",
    includeTools: "为 true 时启动本地 MCP 服务器，并把真实 list_tools 结果加入目录。",
    includeToolAssignments: "为 true 时为扫描到的工具加入工具 bundle 分配。",
    skillsRoot: "已部署 Claude Code skills 文件夹的可选路径。默认为 ~/.claude/skills。",
    sourceSkillsRoot: "skills 源库根目录的可选路径。默认为本地 .AI/.SKILLS/skills 文件夹。",
    pluginsRoot: "Claude Code 插件文件夹的可选路径。默认为 ~/.claude/plugins。",
    modulesRoot: "ellmos 模块文件夹的可选路径。默认为本地 .AI/.MODULES 文件夹。",
    deployedOnly: "为 true 时只返回已部署 skills，不扫描 skills 源库。",
    pluginsOnly: "为 true 时只返回 Claude Code 插件，不扫描本地模块。",
    modulesOnly: "为 true 时只返回本地模块，不扫描 Claude Code 插件。"
  },
  dashboard: {
    loading: "正在加载...",
    refresh: "刷新",
    writeConfig: "生成 MCP 配置",
    language: "语言",
    profile: "配置文件",
    audit: "审计",
    localServers: "本地服务器",
    capabilityBundles: "能力 bundle",
    toolCatalog: "工具目录",
    toolBundleAssignment: "工具 bundle 分配",
    generatedConfig: "生成的配置",
    toolScopeProfile: "配置文件",
    toolScopeLocal: "本地仓库",
    scan: "扫描",
    timeoutLabel: "超时时间，单位毫秒",
    noToolScan: "尚未运行工具扫描。",
    noAction: "尚未执行操作。",
    noDescription: "无描述",
    active: "已启用",
    enableVerb: "启用",
    disableVerb: "禁用",
    confirmServerPrefix: "更改服务器 '",
    confirmServerMiddle: "' 于配置文件 '",
    confirmServerSuffix: "? 写入前会创建备份。",
    confirmWritePrefix: "为配置文件 '",
    confirmWriteSuffix: "' 写入生成的 MCP 配置？现有文件会先备份。",
    scanRunning: "正在扫描...",
    noToolsReported: "未报告工具。",
    noMatchingTools: "没有匹配的工具。",
    serverOk: "服务器正常",
    high: "高",
    warning: "警告",
    info: "信息",
    resolvedServers: "已解析服务器",
    apiError: "API 错误"
  }
};
