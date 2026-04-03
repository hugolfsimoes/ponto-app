import { DiaSemana } from "@backend/utils/dateUtils";

export interface PontoHeader {
  empresa: string;
  nome: string;
  secao: string;
  mes: number;
  ano: number;
}

export interface TimeEntry {
  hora: number;
  minuto: number;
}

export interface PontoRecord {
  dia: number;
  diaSemana: DiaSemana;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  folga: boolean;
  minutesTrabalhados?: number;
}

export interface WeekGroup {
  /** Dia do mês (1–31) em que a semana começa. */
  inicio: number;
  /** Dia do mês (1–31) em que a semana fecha (sábado ou último dia do mês). */
  fim: number;
  records: PontoRecord[];
  /** Total de minutos trabalhados na semana. Pré-condição: records com minutesTrabalhados calculado. */
  totalMinutos: number;
  totalFormatado: string;
}

export interface PontoData {
  header: PontoHeader;
  records: PontoRecord[];
  weeks: WeekGroup[];
  totalMensalMinutos: number;
  totalMensalFormatado: string;
}

export interface ValidationError {
  dia: number;
  campo: string;
  mensagem: string;
}

export interface ProcessResult {
  success: boolean;
  data?: PontoData;
  errors?: ValidationError[];
}
