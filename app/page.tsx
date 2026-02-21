'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import {
  FiTerminal,
  FiCopy,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiPlay,
  FiClock,
  FiAlertTriangle,
  FiAlertCircle,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiTrendingDown,
  FiShield,
  FiShieldOff,
  FiFilter,
  FiLoader,
} from 'react-icons/fi'
import { VscBug } from 'react-icons/vsc'
import { HiOutlineDocumentReport } from 'react-icons/hi'

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_ID = '69995b5033bee1a8dbeac2c3'
const HISTORY_KEY = 'testpilot_history'

// ─── Dracula Theme ───────────────────────────────────────────────────────────

const THEME_VARS = {
  '--background': '231 18% 14%',
  '--foreground': '60 30% 96%',
  '--card': '232 16% 18%',
  '--card-foreground': '60 30% 96%',
  '--primary': '265 89% 72%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '232 16% 24%',
  '--accent': '135 94% 60%',
  '--destructive': '0 100% 62%',
  '--muted': '232 16% 28%',
  '--muted-foreground': '228 10% 62%',
  '--border': '232 16% 28%',
  '--input': '232 16% 32%',
  '--ring': '265 89% 72%',
} as Record<string, string>

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

interface Bug {
  title: string
  severity: string
  description: string
  root_cause: string
  suggested_fix: string
}

interface BugReport {
  bugs: Bug[]
  total_bugs: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  summary: string
}

interface TestSummary {
  total_tests: number
  passed: number
  failed: number
  pass_rate: string
}

interface SeverityBreakdown {
  severity: string
  count: number
  details: string
}

interface RecommendedAction {
  action: string
  priority: string
  reason: string
}

interface CIVerdict {
  status: string
  reasoning: string
}

interface TestReport {
  test_summary: TestSummary
  severity_breakdown: SeverityBreakdown[]
  coverage_observations: string
  recommended_actions: RecommendedAction[]
  ci_verdict: CIVerdict
}

interface NotificationResult {
  email_sent: boolean
  recipients: string[]
  subject: string
  reason: string
}

interface AnalysisResult {
  bug_report: BugReport
  test_report: TestReport
  notification?: NotificationResult
}

interface HistoryEntry {
  id: string
  date: string
  inputSummary: string
  fullInput: string
  result: AnalysisResult
}

// ─── Agent Info ──────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string
  name: string
  role: string
}

const AGENTS: AgentInfo[] = [
  { id: '69995b5033bee1a8dbeac2c3', name: 'Test Analysis Coordinator', role: 'Manager - orchestrates all sub-agents' },
  { id: '69995b26a63b170a3b816fab', name: 'Bug Detection Agent', role: 'Identifies bugs and severity levels' },
  { id: '69995b27938bc0103dbe0c07', name: 'Report Generator Agent', role: 'Generates test summaries and CI verdicts' },
]

// ─── Sample Data ─────────────────────────────────────────────────────────────

const SAMPLE_INPUT = `FAIL tests/auth/login.test.ts
  ● Login Flow › should handle expired JWT tokens gracefully
    TypeError: Cannot read properties of undefined (reading 'exp')
      at validateToken (src/auth/jwt.ts:42:18)
      at processLogin (src/auth/login.ts:67:12)

FAIL tests/api/users.test.ts
  ● GET /api/users › should return 403 for unauthorized requests
    Expected: 403
    Received: 200
    at Object.<anonymous> (tests/api/users.test.ts:23:5)

  ● POST /api/users › should validate email format
    Expected: 400
    Received: 201
    at Object.<anonymous> (tests/api/users.test.ts:45:5)

PASS tests/api/health.test.ts (3 tests)
PASS tests/utils/format.test.ts (8 tests)
PASS tests/components/Button.test.tsx (5 tests)

Test Suites: 2 failed, 3 passed, 5 total
Tests:       3 failed, 16 passed, 19 total`

const SAMPLE_RESULT: AnalysisResult = {
  bug_report: {
    bugs: [
      {
        title: 'JWT Token Validation Crash on Undefined Payload',
        severity: 'critical',
        description: 'The validateToken function in jwt.ts crashes when the token payload is undefined, causing a TypeError when accessing the exp property.',
        root_cause: 'Missing null check on decoded JWT payload before accessing the exp field at line 42 of jwt.ts.',
        suggested_fix: 'Add a guard clause: if (!payload || !payload.exp) return { valid: false, error: "Invalid token payload" }; before accessing payload.exp.',
      },
      {
        title: 'Missing Authorization Check on GET /api/users',
        severity: 'high',
        description: 'The GET /api/users endpoint returns 200 instead of 403 for unauthorized requests, indicating the auth middleware is bypassed.',
        root_cause: 'The auth middleware is not applied to the GET route handler, or the middleware is configured to skip GET requests.',
        suggested_fix: 'Ensure the auth middleware is applied to all route handlers in the users API route. Check middleware configuration for method filtering.',
      },
      {
        title: 'Email Validation Not Enforced on User Creation',
        severity: 'medium',
        description: 'POST /api/users accepts invalid email formats and returns 201 instead of 400.',
        root_cause: 'The email validation schema is either missing or not enforced in the request body validation middleware.',
        suggested_fix: 'Add zod or joi email validation to the user creation schema and ensure it runs before the handler.',
      },
    ],
    total_bugs: 3,
    critical_count: 1,
    high_count: 1,
    medium_count: 1,
    low_count: 0,
    summary: 'Found 3 bugs across 2 failing test suites. 1 critical crash in JWT handling, 1 high-severity auth bypass, and 1 medium input validation gap.',
  },
  test_report: {
    test_summary: {
      total_tests: 19,
      passed: 16,
      failed: 3,
      pass_rate: '84.2%',
    },
    severity_breakdown: [
      { severity: 'critical', count: 1, details: 'JWT token validation crash causing runtime TypeError' },
      { severity: 'high', count: 1, details: 'Authorization bypass on user listing endpoint' },
      { severity: 'medium', count: 1, details: 'Missing email validation on user creation' },
    ],
    coverage_observations: 'Auth and API test suites show failures while utility and component tests pass cleanly. The failing tests are concentrated in security-critical paths (authentication and authorization), which warrants immediate attention before deployment.',
    recommended_actions: [
      { action: 'Fix JWT null check in src/auth/jwt.ts', priority: 'critical', reason: 'Runtime crash affects all authenticated users' },
      { action: 'Apply auth middleware to GET /api/users', priority: 'high', reason: 'Security vulnerability - data exposure risk' },
      { action: 'Add email validation to user creation', priority: 'medium', reason: 'Data integrity issue, allows malformed emails' },
      { action: 'Add integration tests for auth flow', priority: 'low', reason: 'Improve coverage of authentication edge cases' },
    ],
    ci_verdict: {
      status: 'deploy_blocked',
      reasoning: 'Deployment blocked due to 1 critical crash bug in JWT validation and 1 high-severity authorization bypass. These affect security-critical paths and must be resolved before merging.',
    },
  },
}

// ─── Response Parser ─────────────────────────────────────────────────────────

function parseAgentResponse(result: any): AnalysisResult | null {
  try {
    let data = result?.response?.result
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        return null
      }
    }
    if (data?.result && typeof data.result === 'object') {
      data = data.result
    }
    if (typeof data?.bug_report === 'string') {
      try { data.bug_report = JSON.parse(data.bug_report) } catch { /* keep as-is */ }
    }
    if (typeof data?.test_report === 'string') {
      try { data.test_report = JSON.parse(data.test_report) } catch { /* keep as-is */ }
    }
    if (!data?.bug_report && !data?.test_report) {
      return null
    }
    return data as AnalysisResult
  } catch {
    return null
  }
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">{part}</strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

// ─── Severity Helpers ────────────────────────────────────────────────────────

function getSeverityClasses(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-[#ff5555]/20 text-[#ff5555] border border-[#ff5555]/30'
  if (s === 'high') return 'bg-[#ffb86c]/20 text-[#ffb86c] border border-[#ffb86c]/30'
  if (s === 'medium') return 'bg-[#f1fa8c]/20 text-[#f1fa8c] border border-[#f1fa8c]/30'
  if (s === 'low') return 'bg-[#8be9fd]/20 text-[#8be9fd] border border-[#8be9fd]/30'
  return 'bg-[#9499b5]/20 text-[#9499b5] border border-[#9499b5]/30'
}

function getSeverityDotColor(severity: string): string {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical') return 'bg-[#ff5555]'
  if (s === 'high') return 'bg-[#ffb86c]'
  if (s === 'medium') return 'bg-[#f1fa8c]'
  if (s === 'low') return 'bg-[#8be9fd]'
  return 'bg-[#9499b5]'
}

function getVerdictStyle(status: string): { bg: string; text: string; border: string } {
  const s = (status ?? '').toLowerCase().replace(/\s/g, '_')
  if (s === 'safe_to_deploy') return { bg: 'bg-[#50fa7b]/15', text: 'text-[#50fa7b]', border: 'border-[#50fa7b]/40' }
  if (s === 'needs_attention') return { bg: 'bg-[#ffb86c]/15', text: 'text-[#ffb86c]', border: 'border-[#ffb86c]/40' }
  if (s === 'deploy_blocked') return { bg: 'bg-[#ff5555]/15', text: 'text-[#ff5555]', border: 'border-[#ff5555]/40' }
  return { bg: 'bg-[#9499b5]/15', text: 'text-[#9499b5]', border: 'border-[#9499b5]/40' }
}

function getVerdictIcon(status: string) {
  const s = (status ?? '').toLowerCase().replace(/\s/g, '_')
  if (s === 'safe_to_deploy') return <FiShield className="w-5 h-5" />
  if (s === 'deploy_blocked') return <FiShieldOff className="w-5 h-5" />
  return <FiAlertTriangle className="w-5 h-5" />
}

function getPriorityClasses(priority: string): string {
  const p = (priority ?? '').toLowerCase()
  if (p === 'critical') return 'bg-[#ff5555]/20 text-[#ff5555]'
  if (p === 'high') return 'bg-[#ffb86c]/20 text-[#ffb86c]'
  if (p === 'medium') return 'bg-[#f1fa8c]/20 text-[#f1fa8c]'
  if (p === 'low') return 'bg-[#8be9fd]/20 text-[#8be9fd]'
  return 'bg-[#9499b5]/20 text-[#9499b5]'
}

// ─── Report Markdown Generator ───────────────────────────────────────────────

function generateReportMarkdown(result: AnalysisResult): string {
  const lines: string[] = []
  lines.push('# TestPilot AI Analysis Report')
  lines.push('')

  const br = result?.bug_report
  if (br) {
    lines.push('## Bug Report')
    lines.push(`Total Bugs: ${br.total_bugs ?? 0} | Critical: ${br.critical_count ?? 0} | High: ${br.high_count ?? 0} | Medium: ${br.medium_count ?? 0} | Low: ${br.low_count ?? 0}`)
    lines.push('')
    if (br.summary) {
      lines.push(`**Summary:** ${br.summary}`)
      lines.push('')
    }
    if (Array.isArray(br.bugs)) {
      br.bugs.forEach((bug, i) => {
        lines.push(`### ${i + 1}. [${(bug.severity ?? 'unknown').toUpperCase()}] ${bug.title ?? 'Untitled'}`)
        if (bug.description) lines.push(`**Description:** ${bug.description}`)
        if (bug.root_cause) lines.push(`**Root Cause:** ${bug.root_cause}`)
        if (bug.suggested_fix) lines.push(`**Suggested Fix:** ${bug.suggested_fix}`)
        lines.push('')
      })
    }
  }

  const tr = result?.test_report
  if (tr) {
    lines.push('## Test Summary')
    const ts = tr.test_summary
    if (ts) {
      lines.push(`- Total Tests: ${ts.total_tests ?? 0}`)
      lines.push(`- Passed: ${ts.passed ?? 0}`)
      lines.push(`- Failed: ${ts.failed ?? 0}`)
      lines.push(`- Pass Rate: ${ts.pass_rate ?? 'N/A'}`)
      lines.push('')
    }
    if (tr.coverage_observations) {
      lines.push(`**Coverage Observations:** ${tr.coverage_observations}`)
      lines.push('')
    }
    const ci = tr.ci_verdict
    if (ci) {
      lines.push('## CI Verdict')
      lines.push(`**Status:** ${(ci.status ?? 'unknown').replace(/_/g, ' ').toUpperCase()}`)
      if (ci.reasoning) lines.push(`**Reasoning:** ${ci.reasoning}`)
      lines.push('')
    }
    if (Array.isArray(tr.recommended_actions) && tr.recommended_actions.length > 0) {
      lines.push('## Recommended Actions')
      tr.recommended_actions.forEach((a, i) => {
        lines.push(`${i + 1}. [${(a.priority ?? '').toUpperCase()}] ${a.action ?? ''}`)
        if (a.reason) lines.push(`   Reason: ${a.reason}`)
      })
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ─── ErrorBoundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e1f29', color: '#f8f8f2' }}>
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4" style={{ color: '#9499b5' }}>{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#bd93f9', color: '#fff' }}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${getSeverityClasses(severity)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${getSeverityDotColor(severity)}`} />
      {(severity ?? 'unknown').toUpperCase()}
    </span>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: '#282a36', borderColor: '#3d4057' }}>
      <div className="text-xs font-medium mb-1" style={{ color: '#9499b5' }}>{label}</div>
      <div className="text-xl font-bold" style={{ color: accent ?? '#f8f8f2' }}>{value}</div>
    </div>
  )
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen,
  badge,
  children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: '#282a36', borderColor: '#3d4057' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        {open ? <FiChevronDown className="w-4 h-4 shrink-0" style={{ color: '#9499b5' }} /> : <FiChevronRight className="w-4 h-4 shrink-0" style={{ color: '#9499b5' }} />}
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#f8f8f2' }}>
          {icon} {title}
        </span>
        {badge && <div className="ml-auto">{badge}</div>}
      </button>
      {open && <div className="px-4 pb-4 border-t" style={{ borderColor: '#3d4057' }}>{children}</div>}
    </div>
  )
}

function BugCard({ bug }: { bug: Bug }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border p-3 transition-all hover:shadow-lg" style={{ background: '#1e1f29', borderColor: '#3d4057' }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">
            {expanded ? <FiChevronDown className="w-3.5 h-3.5" style={{ color: '#9499b5' }} /> : <FiChevronRight className="w-3.5 h-3.5" style={{ color: '#9499b5' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={bug?.severity ?? 'unknown'} />
              <span className="text-sm font-medium truncate" style={{ color: '#f8f8f2' }}>{bug?.title ?? 'Untitled Bug'}</span>
            </div>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="mt-3 ml-6 space-y-2.5 text-sm" style={{ color: '#f8f8f2' }}>
          {bug?.description && (
            <div>
              <div className="text-xs font-semibold mb-0.5" style={{ color: '#bd93f9' }}>Description</div>
              <p className="text-sm" style={{ color: '#9499b5' }}>{bug.description}</p>
            </div>
          )}
          {bug?.root_cause && (
            <div>
              <div className="text-xs font-semibold mb-0.5" style={{ color: '#ffb86c' }}>Root Cause</div>
              <p className="text-sm" style={{ color: '#9499b5' }}>{bug.root_cause}</p>
            </div>
          )}
          {bug?.suggested_fix && (
            <div>
              <div className="text-xs font-semibold mb-0.5" style={{ color: '#50fa7b' }}>Suggested Fix</div>
              <p className="text-sm font-mono" style={{ color: '#9499b5' }}>{bug.suggested_fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border p-4 space-y-3 animate-pulse" style={{ background: '#282a36', borderColor: '#3d4057' }}>
      <div className="h-4 rounded w-1/3" style={{ background: '#3d4057' }} />
      <div className="h-3 rounded w-full" style={{ background: '#3d4057' }} />
      <div className="h-3 rounded w-2/3" style={{ background: '#3d4057' }} />
    </div>
  )
}

// ─── Dashboard View ──────────────────────────────────────────────────────────

function DashboardView({
  analysisResult,
  setAnalysisResult,
  history,
  setHistory,
  activeAgentId,
  setActiveAgentId,
  showSample,
}: {
  analysisResult: AnalysisResult | null
  setAnalysisResult: (r: AnalysisResult | null) => void
  history: HistoryEntry[]
  setHistory: (h: HistoryEntry[]) => void
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
  showSample: boolean
}) {
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [severityFilters, setSeverityFilters] = useState<Record<string, boolean>>({ critical: true, high: true, medium: true, low: true })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Populate sample data
  useEffect(() => {
    if (showSample) {
      setInputText(SAMPLE_INPUT)
      setAnalysisResult(SAMPLE_RESULT)
    } else {
      setInputText('')
      setAnalysisResult(null)
    }
  }, [showSample, setAnalysisResult])

  const runAnalysis = useCallback(async () => {
    if (!inputText.trim() || loading) return
    setLoading(true)
    setErrorMsg('')
    setAnalysisResult(null)
    setActiveAgentId(AGENT_ID)

    try {
      const message = `Analyze the following test input:\n\n${inputText}`

      const result = await callAIAgent(message, AGENT_ID)
      setActiveAgentId(null)

      if (result.success) {
        const parsed = parseAgentResponse(result)
        if (parsed) {
          setAnalysisResult(parsed)
          // Save to history
          const entry: HistoryEntry = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            date: new Date().toISOString(),
            inputSummary: inputText.slice(0, 120),
            fullInput: inputText,
            result: parsed,
          }
          const newHistory = [entry, ...history].slice(0, 50)
          setHistory(newHistory)
          try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)) } catch { /* quota */ }
        } else {
          setErrorMsg('Could not parse agent response. The agent may have returned an unexpected format.')
        }
      } else {
        setErrorMsg(result.error ?? 'Analysis failed. Please try again.')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setActiveAgentId(null)
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [inputText, loading, history, setAnalysisResult, setHistory, setActiveAgentId])

  const handleCopyReport = useCallback(async () => {
    if (!analysisResult) return
    const md = generateReportMarkdown(analysisResult)
    const ok = await copyToClipboard(md)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [analysisResult])

  const displayResult = analysisResult
  const bugs = Array.isArray(displayResult?.bug_report?.bugs) ? displayResult.bug_report.bugs : []
  const filteredBugs = bugs.filter((b) => severityFilters[(b?.severity ?? '').toLowerCase()] !== false)

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 p-4 overflow-hidden">
      {/* ─── Left Column: Input Panel ─── */}
      <div className="w-full lg:w-[40%] flex flex-col gap-3 min-h-0">
        <div className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: '#282a36', borderColor: '#3d4057' }}>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#f8f8f2' }}>
            <FiTerminal className="w-4 h-4" style={{ color: '#bd93f9' }} />
            Test Input
          </h2>

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste test logs, error output, or describe code changes..."
            rows={10}
            className="w-full px-3 py-2.5 rounded-lg border text-sm font-mono outline-none resize-y transition-colors focus:border-[#bd93f9] placeholder:text-[#9499b5]/60"
            style={{ background: '#1e1f29', borderColor: '#3d4057', color: '#f8f8f2', minHeight: '160px' }}
          />

          <button
            onClick={runAnalysis}
            disabled={!inputText.trim() || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#bd93f9]/20"
            style={{ background: loading ? '#363949' : '#bd93f9', color: '#fff' }}
          >
            {loading ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <FiPlay className="w-4 h-4" /> Run Analysis
              </>
            )}
          </button>

          {errorMsg && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border text-sm" style={{ background: 'rgba(255,85,85,0.1)', borderColor: 'rgba(255,85,85,0.3)', color: '#ff5555' }}>
              <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                <button onClick={runAnalysis} className="text-xs underline mt-1 hover:opacity-80">Retry</button>
              </div>
            </div>
          )}
        </div>

        {/* Agent Info */}
        <div className="rounded-xl border p-3" style={{ background: '#282a36', borderColor: '#3d4057' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#9499b5' }}>Agent Pipeline</div>
          <div className="space-y-1.5">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2 text-xs">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: activeAgentId === agent.id ? '#50fa7b' : activeAgentId ? '#ffb86c' : '#9499b5',
                    boxShadow: activeAgentId === agent.id ? '0 0 6px #50fa7b' : 'none',
                  }}
                />
                <span className="font-medium truncate" style={{ color: activeAgentId === agent.id ? '#50fa7b' : '#f8f8f2' }}>
                  {agent.name}
                </span>
                <span className="ml-auto truncate" style={{ color: '#9499b5' }}>{agent.role.split(' - ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Column: Results ─── */}
      <div className="w-full lg:w-[60%] flex flex-col gap-3 min-h-0 overflow-y-auto">
        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && !displayResult && !errorMsg && (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border p-8" style={{ background: '#282a36', borderColor: '#3d4057' }}>
            <FiTerminal className="w-12 h-12 mb-3" style={{ color: '#3d4057' }} />
            <h3 className="text-base font-semibold mb-1" style={{ color: '#f8f8f2' }}>Paste your test output to get started</h3>
            <p className="text-sm text-center max-w-sm" style={{ color: '#9499b5' }}>
              Paste test logs, CI output, or error traces. TestPilot AI will detect bugs and generate structured reports with CI readiness verdicts.
            </p>
          </div>
        )}

        {!loading && displayResult && (
          <>
            {/* CI Verdict */}
            {displayResult?.test_report?.ci_verdict && (
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${getVerdictStyle(displayResult.test_report.ci_verdict.status ?? '').bg} ${getVerdictStyle(displayResult.test_report.ci_verdict.status ?? '').border}`}
                style={{ borderWidth: '1px' }}
              >
                <div className={getVerdictStyle(displayResult.test_report.ci_verdict.status ?? '').text}>
                  {getVerdictIcon(displayResult.test_report.ci_verdict.status ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${getVerdictStyle(displayResult.test_report.ci_verdict.status ?? '').text}`}>
                    CI Verdict: {(displayResult.test_report.ci_verdict.status ?? 'unknown').replace(/_/g, ' ').toUpperCase()}
                  </div>
                  {displayResult.test_report.ci_verdict.reasoning && (
                    <p className="text-xs mt-1" style={{ color: '#9499b5' }}>{displayResult.test_report.ci_verdict.reasoning}</p>
                  )}
                </div>
              </div>
            )}

            {/* Test Summary Stats */}
            {displayResult?.test_report?.test_summary && (
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="Total Tests" value={displayResult.test_report.test_summary.total_tests ?? 0} />
                <StatCard label="Passed" value={displayResult.test_report.test_summary.passed ?? 0} accent="#50fa7b" />
                <StatCard label="Failed" value={displayResult.test_report.test_summary.failed ?? 0} accent="#ff5555" />
                <StatCard label="Pass Rate" value={displayResult.test_report.test_summary.pass_rate ?? 'N/A'} accent="#bd93f9" />
              </div>
            )}

            {/* Bug Report Section */}
            <CollapsibleSection
              title="Bug Report"
              icon={<VscBug className="w-4 h-4" style={{ color: '#ff5555' }} />}
              defaultOpen={true}
              badge={
                <div className="flex items-center gap-1.5">
                  {(displayResult?.bug_report?.critical_count ?? 0) > 0 && <SeverityBadge severity="critical" />}
                  {(displayResult?.bug_report?.high_count ?? 0) > 0 && <SeverityBadge severity="high" />}
                  {(displayResult?.bug_report?.medium_count ?? 0) > 0 && <SeverityBadge severity="medium" />}
                  {(displayResult?.bug_report?.low_count ?? 0) > 0 && <SeverityBadge severity="low" />}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: '#363949', color: '#f8f8f2' }}>
                    {displayResult?.bug_report?.total_bugs ?? 0} bugs
                  </span>
                </div>
              }
            >
              {displayResult?.bug_report?.summary && (
                <div className="mt-3 mb-3 text-sm" style={{ color: '#9499b5' }}>
                  {renderMarkdown(displayResult.bug_report.summary)}
                </div>
              )}

              {/* Severity Filters */}
              <div className="flex items-center gap-1.5 mb-3 mt-2">
                <span className="text-xs mr-1" style={{ color: '#9499b5' }}><FiFilter className="inline w-3 h-3" /></span>
                {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilters((prev) => ({ ...prev, [sev]: !prev[sev] }))}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${severityFilters[sev] ? getSeverityClasses(sev) : 'opacity-30'}`}
                    style={!severityFilters[sev] ? { background: '#3d4057', color: '#9499b5' } : undefined}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredBugs.length > 0 ? (
                  filteredBugs.map((bug, i) => <BugCard key={i} bug={bug} />)
                ) : (
                  <p className="text-sm py-2" style={{ color: '#9499b5' }}>
                    {bugs.length === 0 ? 'No bugs detected.' : 'No bugs match the selected severity filters.'}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            {/* Test Report Section */}
            <CollapsibleSection
              title="Test Report"
              icon={<HiOutlineDocumentReport className="w-4 h-4" style={{ color: '#8be9fd' }} />}
              defaultOpen={true}
            >
              {/* Severity Breakdown Table */}
              {Array.isArray(displayResult?.test_report?.severity_breakdown) && displayResult.test_report.severity_breakdown.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-2" style={{ color: '#9499b5' }}>Severity Breakdown</div>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: '#3d4057' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#1e1f29' }}>
                          <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: '#9499b5' }}>Severity</th>
                          <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: '#9499b5' }}>Count</th>
                          <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: '#9499b5' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayResult.test_report.severity_breakdown.map((sb, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: '#3d4057' }}>
                            <td className="px-3 py-2"><SeverityBadge severity={sb?.severity ?? ''} /></td>
                            <td className="px-3 py-2 text-sm font-medium" style={{ color: '#f8f8f2' }}>{sb?.count ?? 0}</td>
                            <td className="px-3 py-2 text-xs" style={{ color: '#9499b5' }}>{sb?.details ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Coverage Observations */}
              {displayResult?.test_report?.coverage_observations && (
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-1" style={{ color: '#9499b5' }}>Coverage Observations</div>
                  <div className="rounded-lg border p-3 text-sm" style={{ background: '#1e1f29', borderColor: '#3d4057', color: '#f8f8f2' }}>
                    {renderMarkdown(displayResult.test_report.coverage_observations)}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {Array.isArray(displayResult?.test_report?.recommended_actions) && displayResult.test_report.recommended_actions.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-2" style={{ color: '#9499b5' }}>Recommended Actions</div>
                  <div className="space-y-1.5">
                    {displayResult.test_report.recommended_actions.map((action, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border" style={{ background: '#1e1f29', borderColor: '#3d4057' }}>
                        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${getPriorityClasses(action?.priority ?? '')}`}>
                          {(action?.priority ?? 'N/A').toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: '#f8f8f2' }}>{action?.action ?? ''}</div>
                          {action?.reason && <p className="text-xs mt-0.5" style={{ color: '#9499b5' }}>{action.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleSection>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-white/5"
                style={{ borderColor: '#3d4057', color: '#f8f8f2' }}
              >
                {copied ? <FiCheck className="w-4 h-4" style={{ color: '#50fa7b' }} /> : <FiCopy className="w-4 h-4" style={{ color: '#9499b5' }} />}
                {copied ? 'Copied!' : 'Copy Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── History View ────────────────────────────────────────────────────────────

function HistoryView({
  history,
  setHistory,
}: {
  history: HistoryEntry[]
  setHistory: (h: HistoryEntry[]) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [verdictFilter, setVerdictFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredHistory = history.filter((entry) => {
    const matchesSearch = searchTerm === '' || (entry.inputSummary ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const verdict = entry?.result?.test_report?.ci_verdict?.status ?? ''
    const matchesVerdict = verdictFilter === 'all' || verdict.toLowerCase().replace(/\s/g, '_') === verdictFilter
    return matchesSearch && matchesVerdict
  })

  const deleteEntry = useCallback((id: string) => {
    const updated = history.filter((e) => e.id !== id)
    setHistory(updated)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)) } catch { /* quota */ }
    if (expandedId === id) setExpandedId(null)
  }, [history, setHistory, expandedId])

  const clearAll = useCallback(() => {
    setHistory([])
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify([])) } catch { /* quota */ }
    setExpandedId(null)
  }, [setHistory])

  const handleCopy = useCallback(async (entry: HistoryEntry) => {
    const md = generateReportMarkdown(entry.result)
    const ok = await copyToClipboard(md)
    if (ok) {
      setCopiedId(entry.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const getTrendIndicator = useCallback((index: number) => {
    if (index >= filteredHistory.length - 1) return null
    const current = filteredHistory[index]?.result?.bug_report?.total_bugs ?? 0
    const previous = filteredHistory[index + 1]?.result?.bug_report?.total_bugs ?? 0
    if (current < previous) return <FiTrendingDown className="w-3 h-3" style={{ color: '#50fa7b' }} />
    if (current > previous) return <FiTrendingUp className="w-3 h-3" style={{ color: '#ff5555' }} />
    return null
  }, [filteredHistory])

  return (
    <div className="flex flex-col gap-3 p-4 flex-1 min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9499b5' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-[#bd93f9]"
            style={{ background: '#282a36', borderColor: '#3d4057', color: '#f8f8f2' }}
          />
        </div>
        <div className="flex items-center gap-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'safe_to_deploy', label: 'Safe' },
            { value: 'needs_attention', label: 'Attention' },
            { value: 'deploy_blocked', label: 'Blocked' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVerdictFilter(opt.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: verdictFilter === opt.value ? '#bd93f9' : '#363949',
                color: verdictFilter === opt.value ? '#fff' : '#9499b5',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#ff5555]/20"
            style={{ color: '#ff5555' }}
          >
            <FiTrash2 className="w-3 h-3" /> Clear All
          </button>
        )}
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FiClock className="w-10 h-10 mb-3" style={{ color: '#3d4057' }} />
            <h3 className="text-sm font-semibold mb-1" style={{ color: '#f8f8f2' }}>
              {history.length === 0 ? 'No analysis history yet' : 'No results match your filters'}
            </h3>
            <p className="text-xs" style={{ color: '#9499b5' }}>
              {history.length === 0 ? 'Run an analysis from the Dashboard to see it here.' : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          filteredHistory.map((entry, idx) => {
            const isExpanded = expandedId === entry.id
            const verdict = entry?.result?.test_report?.ci_verdict?.status ?? ''
            const vs = getVerdictStyle(verdict)
            const bugCount = entry?.result?.bug_report?.total_bugs ?? 0
            const dateFmt = (() => {
              try { return new Date(entry.date).toLocaleString() } catch { return entry.date }
            })()

            return (
              <div key={entry.id} className="rounded-xl border overflow-hidden" style={{ background: '#282a36', borderColor: '#3d4057' }}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                >
                  {isExpanded ? <FiChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: '#9499b5' }} /> : <FiChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: '#9499b5' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: '#9499b5' }}>{dateFmt}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${vs.bg} ${vs.text} ${vs.border}`}>
                        {(verdict || 'unknown').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: bugCount > 0 ? '#ff5555' : '#50fa7b' }}>
                        <VscBug className="w-3 h-3" /> {bugCount}
                      </span>
                      {getTrendIndicator(idx)}
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: '#f8f8f2' }}>{entry.inputSummary ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Severity chips */}
                    {(entry?.result?.bug_report?.critical_count ?? 0) > 0 && <SeverityBadge severity="critical" />}
                    {(entry?.result?.bug_report?.high_count ?? 0) > 0 && <SeverityBadge severity="high" />}
                    {(entry?.result?.bug_report?.medium_count ?? 0) > 0 && <SeverityBadge severity="medium" />}
                    {(entry?.result?.bug_report?.low_count ?? 0) > 0 && <SeverityBadge severity="low" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: '#3d4057' }}>
                    {/* Full Input */}
                    <div>
                      <div className="text-xs font-semibold mb-1" style={{ color: '#9499b5' }}>Input</div>
                      <pre className="text-xs font-mono rounded-lg border p-2 overflow-x-auto max-h-32 overflow-y-auto" style={{ background: '#1e1f29', borderColor: '#3d4057', color: '#f8f8f2' }}>
                        {entry.fullInput}
                      </pre>
                    </div>

                    {/* Summary */}
                    {entry?.result?.bug_report?.summary && (
                      <div>
                        <div className="text-xs font-semibold mb-1" style={{ color: '#9499b5' }}>Bug Summary</div>
                        <div className="text-sm" style={{ color: '#f8f8f2' }}>{renderMarkdown(entry.result.bug_report.summary)}</div>
                      </div>
                    )}

                    {/* Test Stats */}
                    {entry?.result?.test_report?.test_summary && (
                      <div className="grid grid-cols-4 gap-2">
                        <StatCard label="Total" value={entry.result.test_report.test_summary.total_tests ?? 0} />
                        <StatCard label="Passed" value={entry.result.test_report.test_summary.passed ?? 0} accent="#50fa7b" />
                        <StatCard label="Failed" value={entry.result.test_report.test_summary.failed ?? 0} accent="#ff5555" />
                        <StatCard label="Pass Rate" value={entry.result.test_report.test_summary.pass_rate ?? 'N/A'} accent="#bd93f9" />
                      </div>
                    )}

                    {/* Bugs List */}
                    {Array.isArray(entry?.result?.bug_report?.bugs) && entry.result.bug_report.bugs.length > 0 && (
                      <div className="space-y-1.5">
                        {entry.result.bug_report.bugs.map((bug, bi) => <BugCard key={bi} bug={bug} />)}
                      </div>
                    )}

                    {/* CI Verdict */}
                    {entry?.result?.test_report?.ci_verdict?.reasoning && (
                      <div className="text-xs" style={{ color: '#9499b5' }}>
                        <span className="font-semibold">CI Reasoning: </span>{entry.result.test_report.ci_verdict.reasoning}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(entry) }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
                        style={{ borderColor: '#3d4057', color: '#f8f8f2' }}
                      >
                        {copiedId === entry.id ? <FiCheck className="w-3 h-3" style={{ color: '#50fa7b' }} /> : <FiCopy className="w-3 h-3" />}
                        {copiedId === entry.id ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id) }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-[#ff5555]/20"
                        style={{ color: '#ff5555' }}
                      >
                        <FiTrash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function Page() {
  const [activeView, setActiveView] = useState<'dashboard' | 'history'>('dashboard')
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [showSample, setShowSample] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load history from localStorage
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setHistory(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  if (!mounted) {
    return (
      <div style={THEME_VARS as React.CSSProperties} className="min-h-screen font-sans" >
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e1f29' }}>
          <FiLoader className="w-6 h-6 animate-spin" style={{ color: '#bd93f9' }} />
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div style={THEME_VARS as React.CSSProperties} className="min-h-screen font-sans flex flex-col">
        <div className="min-h-screen flex flex-col" style={{ background: '#1e1f29', color: '#f8f8f2' }}>
          {/* ─── Top Navigation Bar ─── */}
          <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b" style={{ background: '#282a36', borderColor: '#3d4057' }}>
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#bd93f9' }}>
                  <FiTerminal className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-bold tracking-tight" style={{ color: '#f8f8f2' }}>
                  TestPilot<span style={{ color: '#bd93f9' }}> AI</span>
                </span>
              </div>

              {/* Nav Links */}
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: activeView === 'dashboard' ? '#bd93f9' : 'transparent',
                    color: activeView === 'dashboard' ? '#fff' : '#9499b5',
                  }}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveView('history')}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{
                    background: activeView === 'history' ? '#bd93f9' : 'transparent',
                    color: activeView === 'history' ? '#fff' : '#9499b5',
                  }}
                >
                  History
                  {history.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: activeView === 'history' ? 'rgba(255,255,255,0.2)' : '#363949', color: activeView === 'history' ? '#fff' : '#9499b5' }}>
                      {history.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Sample Data Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: '#9499b5' }}>Sample Data</span>
              <button
                onClick={() => setShowSample(!showSample)}
                className="relative w-9 h-5 rounded-full transition-colors"
                style={{ background: showSample ? '#bd93f9' : '#3d4057' }}
                role="switch"
                aria-checked={showSample}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: '#f8f8f2',
                    left: showSample ? '18px' : '2px',
                  }}
                />
              </button>
            </div>
          </header>

          {/* ─── Main Content ─── */}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeView === 'dashboard' ? (
              <DashboardView
                analysisResult={analysisResult}
                setAnalysisResult={setAnalysisResult}
                history={history}
                setHistory={setHistory}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
                showSample={showSample}
              />
            ) : (
              <HistoryView history={history} setHistory={setHistory} />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
