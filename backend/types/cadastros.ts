export interface Organization {
  id: string
  nome: string
  logoPath: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  organizationId: string
  nome: string
  setor: string
  createdAt: string
  updatedAt: string
}

export interface LocalData {
  version: 1
  organizations: Organization[]
  employees: Employee[]
}

export interface CreateOrganizationInput {
  nome: string
  logoSourcePath: string
}

export interface UpdateOrganizationInput {
  id: string
  nome: string
  logoSourcePath?: string
}

export interface CreateEmployeeInput {
  organizationId: string
  nome: string
  setor: string
}

export interface UpdateEmployeeInput {
  id: string
  nome: string
  setor: string
}

export interface OperationResult {
  success: boolean
  error?: string
}
