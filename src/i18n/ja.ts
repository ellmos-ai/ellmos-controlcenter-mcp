import type { Translations } from "./types.js";

export const ja: Translations = {
  language: {
    name: "日本語",
    current: (langName, lang) => `現在の言語: ${langName} (${lang})`,
    changed: (langName, lang) => `言語を ${langName} (${lang}) に設定しました。`,
    supported: (languages) => `対応言語: ${languages}`,
    note: "対応しているすべての言語に保守されたテキストセットがあります。カスタム bundle のタイトルと説明は記述どおりに表示されます。"
  },
  common: {
    yes: "はい",
    no: "いいえ",
    none: "-",
    allLocalServers: "すべてのローカル MCP サーバー",
    allProfileServers: "すべてのプロファイルサーバー",
    notAvailable: "-",
    noLocalServers: "ローカル MCP サーバーが見つかりません。",
    noProfiles: "Claude プロファイルが見つかりません。",
    noBundles: "利用できる capability bundle がありません。",
    noToolScanServers: "ツールスキャン対象の MCP サーバーが見つかりません。",
    noToolsReported: "ツールは報告されていません。",
    noBundleAssignments: "Bundle 割り当てはまだ計算されていません。",
    noMatchingTools: "一致するツールがありません。",
    unsupportedStartForm: "対応していない MCP 起動形式です。",
    serverConfigNotObject: "サーバー設定がオブジェクトではありません。",
    noSupportedStartForm: "対応している MCP 起動形式が検出されませんでした。",
    status: "状態",
    source: "ソース",
    filter: "フィルター",
    transport: "トランスポート",
    tools: "ツール",
    duration: "所要時間",
    start: "起動",
    error: "エラー",
    active: "有効",
    id: "ID",
    keywords: "キーワード",
    server: "サーバー",
    servers: "サーバー",
    profile: "プロファイル",
    profiles: "プロファイル",
    output: "出力",
    written: "書き込み済み",
    command: "起動コマンド",
    details: "詳細",
    findings: "検出項目",
    severity: "重大度",
    hint: "ヒント",
    high: "高",
    warning: "警告",
    info: "情報"
  },
  tables: {
    server: {
      repo: "リポジトリ",
      version: "バージョン",
      tools: "ツール",
      serverJson: "server.json",
      path: "パス"
    },
    profile: {
      profile: "プロファイル",
      extends: "継承",
      server: "サーバー",
      file: "ファイル"
    },
    bundle: {
      bundle: "Bundle",
      server: "サーバー",
      tools: "ツール",
      description: "説明"
    },
    tool: {
      tool: "ツール",
      title: "タイトル",
      description: "説明"
    },
    assignment: {
      server: "サーバー",
      tool: "ツール",
      matches: "一致",
      description: "説明"
    },
    skill: {
      name: "名前",
      description: "説明",
      version: "バージョン",
      deployed: "デプロイ済み",
      category: "カテゴリ",
      path: "パス"
    },
    plugin: {
      name: "名前",
      type: "種別",
      version: "バージョン",
      marketplaceScope: "マーケット/スコープ",
      skills: "Skills",
      commands: "コマンド",
      mcp: "MCP",
      path: "パス"
    }
  },
  headings: {
    statusTitle: "# ellmos ControlCenter 状態",
    localServers: (root) => `# ${root} のローカル MCP サーバー`,
    localRepos: "## ローカル MCP リポジトリ",
    claudeProfiles: (root) => root ? `# ${root} の Claude プロファイル` : "## Claude プロファイル",
    capabilityBundles: (root) => root ? `# ${root} の Capability Bundle` : "## Capability Bundle",
    details: "## 詳細",
    bundleRecommendation: "# Bundle 推奨",
    profileRecommendation: "# プロファイル推奨",
    resolvedProfile: "# 解決済みプロファイル",
    profileSwitchPrepared: "# プロファイル切り替え準備完了",
    profileAudit: "# プロファイル監査",
    mcpServers: "## MCP サーバー",
    catalogCreated: "# カタログ作成済み",
    toolCatalog: "# MCP ツールカタログ",
    toolBundleAssignment: "# ツール bundle 割り当て",
    probeNotes: "## プローブメモ",
    language: "# ControlCenter 言語",
    deployedSkills: (count) => `## デプロイ済み Skills (${count})`,
    sourceOnlySkills: (count) => `## ソースのみ Skills (${count})`,
    claudeCodePlugins: (count) => `## Claude Code プラグイン (${count})`,
    localModules: (count) => `## ローカルモジュール (${count})`
  },
  messages: {
    sourceLocalRepos: (root) => `${root} のローカル MCP リポジトリ`,
    sourceProfile: (profileName, profileRoot) => `${profileRoot} のプロファイル ${profileName}`,
    recommendation: "推奨",
    score: "スコア",
    rationale: "理由",
    noStrongBundleMatches: "強い bundle 一致は検出されませんでした。",
    noStrongProfileKeywords: "強いキーワードは検出されませんでした。base プロファイルが安全な既定の推奨です。",
    profileRationale: (count, keywords) => `${count} 個のキーワードが一致したため推奨: ${keywords}`,
    mcpRoot: "MCP ルート",
    profileRoot: "プロファイルルート",
    localRepoCount: "ローカル MCP リポジトリ",
    profileCount: "Claude プロファイル",
    serverProbes: "サーバープローブ",
    failedProbes: "失敗したプローブ",
    policyRules: "Policy ルール",
    generatedConfig: "生成された設定",
    serverCount: "サーバー",
    toolScan: "ツールスキャン",
    profileToolScan: "プロファイルツールスキャン",
    toolBundleAssignment: "ツール bundle 割り当て",
    resolvedServers: "解決済みサーバー",
    skillsRoot: "Skills ルート",
    sourceSkillsRoot: "ソース Skills ルート",
    skipped: "（スキップ）",
    pluginsRoot: "プラグインルート",
    modulesRoot: "モジュールルート",
    skillsTotal: (total, deployed, sourceOnly) => `合計: ${total}（${deployed} デプロイ済み, ${sourceOnly} ソースのみ）`,
    pluginsTotal: (total, plugins, modules) => `合計: ${total}（${plugins} プラグイン, ${modules} モジュール）`,
    noSkills: "Skills が見つかりません。",
    noPlugins: "プラグインまたはモジュールが見つかりません。"
  },
  policy: {
    invalidServerConfig: "サーバー設定がオブジェクトではありません。",
    missingCommand: "サーバーに実行可能な command エントリがありません。",
    npxRuntimeFetch: "サーバーは npx 経由で起動します。便利ですが、固定されたローカルパスより再現性は低くなります。",
    envSecretsPresent: "サーバー設定に環境変数が含まれています。値は意図的に返されません。",
    sensitiveArgName: "サーバー引数に機密性がありそうな名前が含まれています。内容は別途確認してください。",
    noFindings: "解決済みプロファイルに policy ヒントは見つかりませんでした。"
  },
  toolDescriptions: {
    controlcenter_status: {
      title: "ControlCenter 状態",
      description: "ローカル MCP stack、ローカルサーバー、Claude プロファイルの概要を表示します。"
    },
    controlcenter_get_language: {
      title: "ControlCenter 言語を表示",
      description: "現在の ControlCenter 出力言語と対応している言語コードを表示します。"
    },
    controlcenter_set_language: {
      title: "ControlCenter 言語を設定",
      description: "この実行中 MCP サーバーインスタンスの ControlCenter 出力言語を設定します。"
    },
    controlcenter_list_local_servers: {
      title: "ローカル MCP サーバーを一覧表示",
      description: "ローカル MCP ルートをスキャンし、検出した MCP リポジトリをメタデータ付きで一覧表示します。"
    },
    controlcenter_list_tools: {
      title: "MCP ツールを一覧表示",
      description: "ローカルまたはプロファイル定義の MCP サーバーを制御下で起動し、MCP list_tools で実際のツール一覧を読み取ります。"
    },
    controlcenter_assign_tool_bundles: {
      title: "ツールを capability bundle に割り当て",
      description: "実際の MCP ツールを、そのメタデータに基づいて ControlCenter capability bundle に割り当てます。"
    },
    controlcenter_list_bundles: {
      title: "Capability bundle を一覧表示",
      description: "ローカル MCP サーバーを software、filesystem、automation、control plane などのタスク bundle に分類します。"
    },
    controlcenter_suggest_bundles: {
      title: "Capability bundle を提案",
      description: "タスク説明に一致する capability bundle を提案します。"
    },
    controlcenter_list_profiles: {
      title: "Claude プロファイルを一覧表示",
      description: "ローカル Claude プロファイルを読み取り、サーバー数、継承、ファイルパスを表示します。"
    },
    controlcenter_suggest_profile: {
      title: "プロファイルを提案",
      description: "タスク説明から Claude プロファイルを提案します。"
    },
    controlcenter_resolve_profile: {
      title: "Claude プロファイルを解決",
      description: "任意の継承を含めて Claude プロファイルを解決し、結果の MCP サーバーを表示します。"
    },
    controlcenter_switch_profile: {
      title: "プロファイル切り替えを準備",
      description: "解決済みの --mcp-config ファイルを作成またはプレビューして、プロファイル切り替えを準備します。"
    },
    controlcenter_audit_profile: {
      title: "Claude プロファイルを監査",
      description: "解決済み Claude プロファイルについて、npx 起動、env secrets、無効なサーバー設定などの初期 policy ヒントを確認します。"
    },
    controlcenter_build_catalog: {
      title: "ローカルサーバーカタログを作成",
      description: "ローカルで検出された MCP サーバーの JSON カタログを作成します。"
    },
    controlcenter_find_skill: {
      title: "一致するスキルを検索",
      description: "自由文テキストのタスクまたは意図にどのスキルが該当するかを認識します。スキャン済みスキルカタログを名前・エイリアス・タグ・カテゴリ・説明への字句的一致でランク付けし、一致した語とともに最良の候補を返します。"
    },
    controlcenter_list_skills: {
      title: "Claude Code Skills を一覧表示",
      description: "デプロイ済み skills フォルダーと skills ソースライブラリから、インストール済みの Claude Code skills を一覧表示します。"
    },
    controlcenter_list_plugins: {
      title: "プラグインとモジュールを一覧表示",
      description: "インストール済みの Claude Code プラグインとローカル ellmos モジュールをその機能と共に一覧表示します。"
    }
  },
  inputDescriptions: {
    language: "ControlCenter 出力の言語コード。",
    mcpRoot: "任意の MCP ルート。既定ではローカル ellmos MCP フォルダーを使用します。",
    profileName: "任意のプロファイル名。設定すると、その Claude プロファイルから解決されたサーバーをスキャンします。",
    requiredProfileName: ".json を除いたプロファイル名。例: software または ai-lab。",
    profileRoot: "任意のプロファイルフォルダー。既定は ~/.claude/profiles です。",
    serverName: "対象スキャン用の任意のサーバー名、パッケージ名、mcpName、またはプロファイルサーバー名。",
    simpleServerName: "対象スキャン用の任意のサーバー名。",
    timeoutMs: "MCP ツールスキャンごとのタイムアウト、ミリ秒。既定: 5000。",
    listToolsTimeoutMs: "接続および list_tools リクエストごとのタイムアウト、ミリ秒。既定: 5000。",
    bundleConfigPath: "Capability bundle 設定への任意のパス。",
    task: "タスク説明またはセッション目標。",
    outputPath: "生成される MCP 設定の任意の出力先。",
    launchTemplate: "任意の起動コマンドテンプレート。生成された MCP 設定パスのプレースホルダーとして {config} を使います。",
    write: "true の場合は生成された設定を書き込みます。それ以外はプレビューのみ返します。",
    policyConfigPath: "Policy ルール設定への任意のパス。",
    catalogOutputPath: "JSON カタログの任意の出力先。",
    includeTools: "true の場合、ローカル MCP サーバーを起動し、実際の list_tools 結果をカタログに追加します。",
    includeToolAssignments: "true の場合、スキャンされたツールの tool bundle 割り当てを追加します。",
    skillsRoot: "デプロイ済み Claude Code skills フォルダーへの任意のパス。既定は ~/.claude/skills です。",
    sourceSkillsRoot: "skills ソースライブラリルートへの任意のパス。既定はローカルの .AI/.SKILLS/skills フォルダーです。",
    skillIntent: "スキルカタログと照合する自由文テキストのタスクまたは意図。",
    skillFinderLimit: "返すランク付けされたスキル候補の最大数。既定値: 5。",
    pluginsRoot: "Claude Code プラグインフォルダーへの任意のパス。既定は ~/.claude/plugins です。",
    modulesRoot: "ellmos モジュールフォルダーへの任意のパス。既定はローカルの .AI/.MODULES フォルダーです。",
    deployedOnly: "true の場合、デプロイ済み skills のみを返し、skills ソースライブラリをスキャンしません。",
    pluginsOnly: "true の場合、Claude Code プラグインのみを返し、ローカルモジュールをスキャンしません。",
    modulesOnly: "true の場合、ローカルモジュールのみを返し、Claude Code プラグインをスキャンしません。"
  },
  dashboard: {
    loading: "読み込み中...",
    refresh: "更新",
    writeConfig: "MCP 設定を生成",
    language: "言語",
    profile: "プロファイル",
    audit: "監査",
    localServers: "ローカルサーバー",
    capabilityBundles: "Capability Bundle",
    toolCatalog: "ツールカタログ",
    toolBundleAssignment: "ツール bundle 割り当て",
    generatedConfig: "生成された設定",
    toolScopeProfile: "プロファイル",
    toolScopeLocal: "ローカルリポジトリ",
    scan: "スキャン",
    timeoutLabel: "タイムアウト、ミリ秒",
    noToolScan: "ツールスキャンはまだ実行されていません。",
    noAction: "アクションはまだ実行されていません。",
    noDescription: "説明なし",
    active: "有効",
    enableVerb: "有効化",
    disableVerb: "無効化",
    confirmServerPrefix: "サーバー '",
    confirmServerMiddle: "' をプロファイル '",
    confirmServerSuffix: "? 書き込み前にバックアップを作成します。",
    confirmWritePrefix: "プロファイル '",
    confirmWriteSuffix: "' の生成済み MCP 設定を書き込みますか? 既存ファイルは先にバックアップされます。",
    scanRunning: "スキャン中...",
    noToolsReported: "ツールは報告されていません。",
    noMatchingTools: "一致するツールがありません。",
    serverOk: "サーバー OK",
    high: "高",
    warning: "警告",
    info: "情報",
    resolvedServers: "解決済みサーバー",
    apiError: "API エラー"
  }
};
