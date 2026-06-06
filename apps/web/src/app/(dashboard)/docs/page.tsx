'use client'

import Link from 'next/link'
import {
  BellRing,
  CheckCircle2,
  Code2,
  FileCode2,
  KeyRound,
  LifeBuoy,
  PackageCheck,
  RadioTower,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader, Panel } from '@/components/panel'
import { useI18n, type Locale } from '@/lib/i18n'
import { sdkDocsSections, sdkSetupGuide } from '@/lib/sdk-docs'

const sectionIcons = {
  'quick-start': RadioTower,
  'install-sdk': PackageCheck,
  'init-dsn': KeyRound,
  'capture-context': ShieldCheck,
  'upload-sourcemap': FileCode2,
  'alert-webhook': BellRing,
  'verify-ingestion': CheckCircle2,
  troubleshooting: LifeBuoy,
} as const

const docsCopy: Record<
  Locale,
  {
    eyebrow: string
    title: string
    description: string
    backToSettings: string
    checklistTitle: string
    checklistDescription: string
    sections: Record<string, { title: string; description: string; bullets: string[]; code?: string; note?: string }>
  }
> = {
  en: {
    eyebrow: 'SDK docs',
    title: 'Install Error Tracker in production apps',
    description:
      'Use this guide when wiring DSN, release, sourcemaps, alerts, breadcrumbs, replay, and verification into a project.',
    backToSettings: 'Back to settings',
    checklistTitle: 'Setup path',
    checklistDescription: 'These steps match the project setup checklist in Settings.',
    sections: {
      'quick-start': {
        title: 'Quick start',
        description: 'Create a project, copy the DSN, install the SDK, and send one test event before adding release automation.',
        bullets: [
          'Use one project per frontend app or service boundary.',
          'Keep DSN tokens in environment variables for CI and deployed environments.',
          'Set environment and release on every deploy so issues can be filtered by rollout.',
        ],
        code: `bun add @error-tracker/sdk

ERROR_TRACKER_DSN=https://api.example.com/ingest/project/token
APP_RELEASE=web@2.8.1`,
      },
      'install-sdk': {
        title: 'Install SDK',
        description: 'Install the package in the application that owns the browser or Node runtime errors you want to capture.',
        bullets: [
          'For frontend apps, initialize once in the app entry file before rendering.',
          'For server runtimes, initialize before route handlers or jobs start processing work.',
          'Avoid initializing twice in hot module boundaries.',
        ],
        code: `bun add @error-tracker/sdk
# or
npm install @error-tracker/sdk`,
      },
      'init-dsn': {
        title: 'Initialize DSN',
        description: 'The DSN identifies the project and token that should receive events.',
        bullets: [
          'Read DSN, release, and environment from runtime configuration.',
          'Enable replay and performance only where user consent and policy allow it.',
          'Rotate the token from Settings if a DSN is exposed.',
        ],
        code: `import { init } from '@error-tracker/sdk'

init({
  dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_RELEASE,
  integrations: {
    console: true,
    performance: true,
    replay: true,
  },
})`,
      },
      'capture-context': {
        title: 'Capture context',
        description: 'Breadcrumbs, tags, user identity, and release metadata make grouped issues actionable.',
        bullets: [
          'Attach stable user identifiers, not raw sensitive profile data.',
          'Tag tenant, route, feature flag, and deployment channel where available.',
          'Use breadcrumbs for navigation, important UI actions, and failed requests.',
        ],
        code: `ErrorTracker.setUser({ id: user.id, email: user.email })
ErrorTracker.setTag('tenant', tenant.slug)
ErrorTracker.addBreadcrumb({
  category: 'navigation',
  message: 'Opened checkout',
})`,
      },
      'upload-sourcemap': {
        title: 'Upload sourcemaps',
        description: 'Upload sourcemaps after each production build so minified stack traces resolve to source code.',
        bullets: [
          'Use the same release value in SDK initialization and sourcemap upload.',
          'Upload after assets are built and before the deploy is marked complete.',
          'If CI access is unavailable, open Settings and upload the matching sourcemap files from the selected project.',
          'Do not publish sourcemaps publicly unless your security policy allows it.',
        ],
        code: `bunx error-tracker sourcemaps upload \\
  --api-url https://tracker.example.com \\
  --project-id $ERROR_TRACKER_PROJECT_ID \\
  --token $ERROR_TRACKER_TOKEN \\
  --release $APP_RELEASE \\
  --dist apps/web/.next/static`,
      },
      'alert-webhook': {
        title: 'Configure alert webhook',
        description: 'Connect alert delivery after the SDK sends events and issue grouping is verified.',
        bullets: [
          'Start with fatal and error thresholds before routing noisy warning-level issues.',
          'Use separate projects or webhook rules for production and staging.',
          'Test the webhook with a controlled exception before relying on it for incidents.',
        ],
        code: `POST https://chat.example.com/error-tracker
Content-Type: application/json

{
  "issue": "{{issue.title}}",
  "level": "{{issue.level}}",
  "url": "{{issue.url}}"
}`,
      },
      'verify-ingestion': {
        title: 'Verify ingestion',
        description: 'Send one intentional test exception and confirm the issue, stack trace, breadcrumbs, and environment show up.',
        bullets: [
          'Trigger the test in a non-customer path or staging environment first.',
          'Confirm the issue appears in the Issues page and links to a sample event.',
          'Check Web Vitals and replay only after enabling those integrations.',
        ],
        code: `setTimeout(() => {
  throw new Error('error-tracker verification event')
}, 1000)`,
      },
      troubleshooting: {
        title: 'Troubleshooting',
        description: 'Use these checks when events do not appear or stack traces are hard to read.',
        bullets: [
          'If no events appear, confirm the DSN project id and token match the selected project.',
          'If stack traces stay minified, confirm release values match between SDK and sourcemap upload.',
          'If replay is missing, confirm replay capture is enabled and blocked selectors are not too broad.',
          'If alerts are noisy, raise thresholds and route only unresolved fatal or error issues.',
        ],
        note: 'Keep the first verification event until the whole pipeline is visible in the dashboard.',
      },
    },
  },
  zh: {
    eyebrow: 'SDK 文档',
    title: '在生产应用中接入 Error Tracker',
    description: '用这份文档完成 DSN、版本、sourcemap、告警、路径轨迹、回放和验证事件的接入。',
    backToSettings: '返回设置',
    checklistTitle: '接入路径',
    checklistDescription: '这里的步骤和 Settings 里的项目接入清单保持一致。',
    sections: {
      'quick-start': {
        title: '快速开始',
        description: '先创建项目、复制 DSN、安装 SDK，并发送一条测试事件，再接入版本和 sourcemap 自动化。',
        bullets: [
          '建议每个前端应用或服务边界使用独立项目。',
          '在 CI 和部署环境中用环境变量保存 DSN token。',
          '每次发布都设置 environment 和 release，方便按发布批次排查问题。',
        ],
        code: `bun add @error-tracker/sdk

ERROR_TRACKER_DSN=https://api.example.com/ingest/project/token
APP_RELEASE=web@2.8.1`,
      },
      'install-sdk': {
        title: '安装 SDK',
        description: '在需要捕获浏览器或 Node 运行时错误的应用中安装 SDK。',
        bullets: [
          '前端应用建议在入口文件中渲染前初始化一次。',
          '服务端运行时建议在路由处理器或任务开始处理前初始化。',
          '避免在热更新边界或重复入口里初始化多次。',
        ],
        code: `bun add @error-tracker/sdk
# 或
npm install @error-tracker/sdk`,
      },
      'init-dsn': {
        title: '初始化 DSN',
        description: 'DSN 用来标识接收事件的项目和 token。',
        bullets: [
          '从运行时配置中读取 DSN、release 和 environment。',
          '只有在用户授权和合规策略允许时启用 replay 与 performance。',
          '如果 DSN 泄露，可以在 Settings 里轮换 token。',
        ],
        code: `import { init } from '@error-tracker/sdk'

init({
  dsn: process.env.NEXT_PUBLIC_ERROR_TRACKER_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_RELEASE,
  integrations: {
    console: true,
    performance: true,
    replay: true,
  },
})`,
      },
      'capture-context': {
        title: '采集上下文',
        description: '路径轨迹、标签、用户标识和版本信息会让问题分组真正可排查。',
        bullets: [
          '上报稳定用户标识，避免直接上传敏感画像数据。',
          '尽量补充 tenant、route、feature flag 和部署通道等标签。',
          '用 breadcrumbs 记录导航、关键点击和失败请求。',
        ],
        code: `ErrorTracker.setUser({ id: user.id, email: user.email })
ErrorTracker.setTag('tenant', tenant.slug)
ErrorTracker.addBreadcrumb({
  category: 'navigation',
  message: 'Opened checkout',
})`,
      },
      'upload-sourcemap': {
        title: '上传 sourcemap',
        description: '每次生产构建后上传 sourcemap，让压缩后的调用栈能还原到源码位置。',
        bullets: [
          'SDK 初始化和 sourcemap 上传必须使用同一个 release 值。',
          '建议在构建完成后、发布完成标记前上传。',
          '如果暂时无法接入 CI 上传，可以在 Settings 选中项目后手动补传对应 sourcemap。',
          '除非安全策略允许，不要公开发布 sourcemap 文件。',
        ],
        code: `bunx error-tracker sourcemaps upload \\
  --api-url https://tracker.example.com \\
  --project-id $ERROR_TRACKER_PROJECT_ID \\
  --token $ERROR_TRACKER_TOKEN \\
  --release $APP_RELEASE \\
  --dist apps/web/.next/static`,
      },
      'alert-webhook': {
        title: '配置告警 webhook',
        description: '在 SDK 事件和问题分组验证通过后，再接入告警投递。',
        bullets: [
          '先从 fatal 和 error 阈值开始，避免 warning 级别问题制造噪声。',
          '生产和测试环境建议使用独立项目或独立 webhook 规则。',
          '正式依赖告警前，用受控异常测试一次完整链路。',
        ],
        code: `POST https://chat.example.com/error-tracker
Content-Type: application/json

{
  "issue": "{{issue.title}}",
  "level": "{{issue.level}}",
  "url": "{{issue.url}}"
}`,
      },
      'verify-ingestion': {
        title: '验证上报',
        description: '发送一条可控测试异常，确认问题、调用栈、路径轨迹和环境信息都进入控制台。',
        bullets: [
          '先在 staging 或非用户路径中触发测试异常。',
          '确认 Issues 页面出现问题组，并能进入事件样本。',
          '只有启用对应集成后，再检查 Web Vitals 和回放数据。',
        ],
        code: `setTimeout(() => {
  throw new Error('error-tracker verification event')
}, 1000)`,
      },
      troubleshooting: {
        title: '常见问题',
        description: '事件没有出现、调用栈不可读或告警过多时，先检查这些项。',
        bullets: [
          '如果没有事件，确认 DSN 中的 project id 和 token 属于当前项目。',
          '如果调用栈仍然是压缩代码，确认 SDK 和 sourcemap 上传的 release 完全一致。',
          '如果没有回放，确认 replay 已启用，且 blocked selectors 没有过宽。',
          '如果告警噪声过多，提高阈值，只投递 unresolved 的 fatal 或 error 问题。',
        ],
        note: '建议保留第一条验证事件，直到整条接入链路都能在控制台中看到。',
      },
    },
  },
}

export default function DocsPage() {
  const { locale, t } = useI18n()
  const copy = docsCopy[locale]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link
            href="/settings"
            className="app-button inline-flex min-h-[44px] items-center justify-center gap-2 border border-slate-700 px-3 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-slate-50"
          >
            {copy.backToSettings}
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel title={copy.checklistTitle} description={copy.checklistDescription} bodyClassName="p-3">
            <nav className="space-y-1" aria-label={copy.checklistTitle}>
              {sdkSetupGuide.map((step, index) => (
                <a
                  key={step.href}
                  href={step.href}
                  className="app-button flex min-h-[44px] items-center justify-between gap-3 px-3 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                >
                  <span className="min-w-0 truncate">{t(step.labelKey)}</span>
                  <span className="font-mono text-xs text-slate-500">{index + 1}</span>
                </a>
              ))}
            </nav>
          </Panel>
        </aside>

        <div className="space-y-4">
          {sdkDocsSections.map((section) => {
            const Icon = sectionIcons[section.id as keyof typeof sectionIcons] ?? Code2
            const content = copy.sections[section.id]

            return (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <Panel
                  title={content.title}
                  description={content.description}
                  bodyClassName="space-y-4 p-5"
                  action={
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-indigo-300">
                      <Icon className="h-4 w-4" />
                    </div>
                  }
                >
                  <ul className="grid gap-2">
                    {content.bullets.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {content.code && (
                    <pre className="app-code overflow-x-auto p-4 text-xs text-slate-300">{content.code}</pre>
                  )}
                  {content.note && (
                    <div className="rounded-md border border-info/25 bg-cyan-500/10 p-3 text-sm leading-6 text-slate-300">
                      {content.note}
                    </div>
                  )}
                </Panel>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
