export function getTenantProjectContext() {
  const tenantId = process.env.TENANT_ID
  const projectId = process.env.PROJECT_ID

  if (!tenantId || !projectId) {
    throw new Error('TENANT_ID and PROJECT_ID must be set in environment variables. Run pnpm db:seed first.')
  }

  return { tenantId, projectId }
}
