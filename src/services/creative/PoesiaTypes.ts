export enum ContenidoTipo {
  POEMA = 'poema',
  FRASE = 'frase',
  PIROPO = 'piropo',
  DEDICATORIA = 'dedicatoria',
  HAIKU = 'haiku',
  SONETO = 'soneto',
  COPLA = 'copla',
  ACROSTICO = 'acrostico',
  CARTA = 'carta',
  HISTORIA = 'historia',
}

export enum EstiloPoema {
  ROMANTICO = 'romántico',
  MELANCOLICO = 'melancólico',
  APASIONADO = 'apasionado',
  TIERNO = 'tierno',
  PICARO = 'pícaro',
  EPICO = 'épico',
  MISTICO = 'místico',
  MODERNO = 'moderno',
  CLASICO = 'clásico',
  SARCASTICO = 'sarcástico',
  CHISTOSO = 'chistoso',
  OSCURO = 'oscuro',
}

export enum TemaPoema {
  AMOR = 'amor',
  DESAMOR = 'desamor',
  NATURALEZA = 'naturaleza',
  AMISTAD = 'amistad',
  VIDA = 'vida',
  MUERTE = 'muerte',
  ESPERANZA = 'esperanza',
  SOLEDAD = 'soledad',
  ALEGRIA = 'alegría',
  NOCHE = 'noche',
  MAR = 'mar',
  LUNA = 'luna',
  PATRIA = 'patria',
  NOSTALGIA = 'nostalgia',
  LIBERTAD = 'libertad',
}

export interface ContenidoEntry {
  id: string;
  tipo: ContenidoTipo;
  estilo?: string;
  tema?: string;
  dedicado?: string;
  contenido: string;
  autor: string;
  autorName: string;
  groupId: string;
  votes: number;
  voters: string[];
  createdAt: number;
}

export interface GenerarOpts {
  tipo: ContenidoTipo;
  tema?: string;
  estilo?: EstiloPoema;
  dedicado?: string;
  nombre?: string;
  contexto?: string;
  versos?: number;
}

export interface GenerarResult {
  success: boolean;
  entry?: ContenidoEntry;
  error?: string;
  cached?: boolean;
}

export interface VotoResult {
  success: boolean;
  newVotes?: number;
  error?: string;
  alreadyVoted?: boolean;
}

export interface TopEntry {
  entry: ContenidoEntry;
  rank: number;
}
