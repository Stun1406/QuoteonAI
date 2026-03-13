export interface TenantRow {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProjectRow {
  id: string
  tenant_id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanyRow {
  id: string
  tenant_id: string
  business_name: string
  email_domain: string | null
  website: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ContactRow {
  id: string
  tenant_id: string
  company_id: string | null
  name: string | null
  email: string | null
  title: string | null
  phone: string | null
  last_interaction_at: string | null
  created_at: string
  updated_at: string
}

export interface MessageThreadRow {
  id: string
  tenant_id: string
  project_id: string
  thread_id: string
  contact_id: string | null
  company_id: string | null
  intent: string
  processor_type: string
  is_forwarded: boolean
  confidence_score: number | null
  processing_time_ms: number | null
  tokens_inbound: number
  tokens_processing: number
  tokens_outbound: number
  tokens_total: number
  status: string
  quote_value: number | null
  won_value: number | null
  loss_reason: string | null
  closed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MessageArtifactRow {
  id: string
  tenant_id: string
  project_id: string
  thread_id: string
  artifact_type: string
  artifact_data: Record<string, unknown>
  sequence_order: number
  created_at: string
}

export interface LlmCallRow {
  id: string
  tenant_id: string
  project_id: string
  thread_id: string
  call_type: string
  call_stage: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  response_time_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface EmailThreadRow {
  id: string
  subject: string
  subject_norm: string
  participant_from: string
  participant_to: string
  status: string
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface EmailMessageRow {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound'
  canonical_id: string | null
  message_id: string | null
  in_reply_to: string | null
  references_header: string | null
  from_email: string
  to_email: string
  subject: string
  body_text: string
  body_html: string | null
  trust_level: string | null
  spf: string | null
  dkim: string | null
  is_read: boolean
  received_at: string
  created_at: string
}

export interface EmailFailureRow {
  id: string
  created_at: string
  stage: string
  status_code: number
  message: string
  details: string | null
  context: Record<string, unknown>
}
