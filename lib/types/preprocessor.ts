export interface ContactInfo {
  name: string | null
  email: string | null
  company: string | null
  title: string | null
  phone: string | null
  website: string | null
}

export type LogisticsFlow = 'transloading' | 'drayage' | 'warehousing' | 'last-mile'

export type MessageIntent =
  | 'transloading'
  | 'drayage'
  | 'warehousing'
  | 'last-mile'
  | 'general-inquiry'
  | 'complaint'
  | 'other'

export interface ClassifiedIntent {
  flows: LogisticsFlow[]
  primaryFlow?: LogisticsFlow
  overall: 'quote' | 'general' | 'complaint' | 'other'
}

export interface PreprocessResult {
  contactInfo: ContactInfo
  intent: MessageIntent
  classifiedIntent: ClassifiedIntent
  confidence: number
  isForwarded: boolean
  originalMessage: string
}
