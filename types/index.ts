export type AgentStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AuditJob {
  id: string
  url: string
  status: 'queued' | 'running' | 'done' | 'failed'
  seo_status: AgentStatus
  content_status: AgentStatus
  monetisation_status: AgentStatus
  cro_status: AgentStatus
  topic: string | null
  overall_score: number | null
  created_at: string
}

export interface PageAudit {
  url: string
  title: string | null
  titleLength: number
  metaDescription: string | null
  metaDescriptionLength: number
  h1Count: number
  h2Count: number
  wordCount: number
  imagesWithoutAlt: number
  internalLinks: number
  externalLinks: number
  hasCanonical: boolean
  loadTimeMs: number
  score: number
  issues: string[]
}

export interface KeywordGap {
  keyword: string
  intent: 'informational' | 'commercial' | 'transactional'
  competitor: string
  gapScore: number
}

export interface MonetisationOpportunity {
  category: string
  commissionRate: string
  programmes: string[]
  matchingPages: string[]
  priority: 'high' | 'medium' | 'low'
}

export interface CROFinding {
  factor: string
  result: 'pass' | 'warning' | 'fail'
  recommendation: string
}

export interface GeneratedContent {
  id: string
  audit_id: string | null
  type: 'comparison' | 'brief' | 'headline'
  title: string
  content: string
  created_at: string
}

export interface HeadlineVariant {
  variant: string
  angle: string
  reasoning: string
  estimatedCTRScore: number
}

export interface Report {
  id: string
  target_url: string
  competitor_urls: string[]
  status: 'queued' | 'running' | 'done' | 'failed'
  seo_status: AgentStatus
  presence_status: AgentStatus
  monetisation_status: AgentStatus
  cro_status: AgentStatus
  topic: string | null
  opportunity_score: number | null
  created_at: string
  tracked: boolean
}

export interface PresenceResult {
  id: string
  report_id: string
  keyword: string
  intent: 'informational' | 'commercial' | 'transactional'
  target_present: boolean
  competitor1_present: boolean
  competitor2_present: boolean
  target_domain: string | null
  competitor1_domain: string | null
  competitor2_domain: string | null
  top_result_domain: string | null
  revenue_potential: 'high' | 'medium' | 'low'
}

export interface TavilyResult {
  url: string
  title: string
  content: string
  score: number
}

export interface TavilySearchResponse {
  results: TavilyResult[]
}
