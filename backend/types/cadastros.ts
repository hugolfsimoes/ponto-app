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
  cargoFuncao?: string
  defaultSchedule?: EmployeeDefaultSchedule
  createdAt: string
  updatedAt: string
}

export interface EmployeeDefaultSchedule {
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
}

export interface Section {
  id: string
  organizationId: string
  nome: string
  createdAt: string
  updatedAt: string
}

export interface LocalData {
  version: 1
  organizations: Organization[]
  sections: Section[]
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
  cargoFuncao?: string
  defaultSchedule?: Partial<EmployeeDefaultSchedule>
}

export interface UpdateEmployeeInput {
  id: string
  nome: string
  setor: string
  cargoFuncao?: string
  defaultSchedule?: Partial<EmployeeDefaultSchedule>
}

export interface CreateSectionInput {
  organizationId: string
  nome: string
}

export interface UpdateSectionInput {
  id: string
  nome: string
}

export interface OperationResult {
  success: boolean
  error?: string
}
