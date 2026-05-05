// Lógica pura de cálculo do fechamento semanal.
// Mantém-se separada da UI para facilitar testes e reuso (PDF, dashboards).

export type ClosingShowInput = {
  cache_total: number;
  comissao_vendedor: number;
  custo_equipe: number;
  van: number;
  outras_despesas: number;
  incluido: boolean;
};

export type ClosingCrewInput = {
  cache_por_show: number;
  shows_participados: number;
};

export type ClosingExpenseInput = {
  valor: number;
  incluir_no_calculo: boolean;
};

export type ClosingPartnerInput = {
  nome: string;
  funcao?: string | null;
  percentual: number;
  ativo?: boolean;
  tipo?: "socio" | "parceiro";
};

export type ClosingConfigInput = {
  artista_nome: string;
  artista_percentual: number;
  imposto_percentual: number;
  partners: ClosingPartnerInput[];
};

export type DistributionRow = {
  beneficiario: string;
  tipo: "artista" | "socio" | "parceiro" | "produtora";
  percentual: number;
  valor_bruto: number;
  imposto_valor: number;
  valor_liquido: number;
};

export type ClosingTotals = {
  totalBruto: number;
  totalComissoes: number;
  totalCustoEquipeShows: number;
  totalVan: number;
  totalOutrasShows: number;
  totalEquipe: number; // soma da seção B (referência)
  totalDespesas: number; // despesas gerais (seção C, no cálculo)
  totalCustos: number; // soma de tudo que reduz da bruto
  sobra: number;
  distribution: DistributionRow[];
  totalImpostos: number;
  totalLiquido: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeCrewTotal(c: ClosingCrewInput): number {
  return round2(Number(c.cache_por_show || 0) * Number(c.shows_participados || 0));
}

export function computeClosing(
  shows: ClosingShowInput[],
  crew: ClosingCrewInput[],
  expenses: ClosingExpenseInput[],
  config: ClosingConfigInput,
): ClosingTotals {
  const incluidos = shows.filter((s) => s.incluido);
  const totalBruto = round2(incluidos.reduce((a, s) => a + Number(s.cache_total || 0), 0));
  const totalComissoes = round2(incluidos.reduce((a, s) => a + Number(s.comissao_vendedor || 0), 0));
  const totalCustoEquipeShows = round2(incluidos.reduce((a, s) => a + Number(s.custo_equipe || 0), 0));
  const totalVan = round2(incluidos.reduce((a, s) => a + Number(s.van || 0), 0));
  const totalOutrasShows = round2(incluidos.reduce((a, s) => a + Number(s.outras_despesas || 0), 0));
  const totalEquipe = round2(crew.reduce((a, c) => a + computeCrewTotal(c), 0));
  const totalDespesas = round2(
    expenses.filter((e) => e.incluir_no_calculo).reduce((a, e) => a + Number(e.valor || 0), 0),
  );
  const totalCustos = round2(
    totalComissoes + totalCustoEquipeShows + totalVan + totalOutrasShows + totalDespesas,
  );
  const sobra = round2(totalBruto - totalCustos);

  const imposto = Number(config.imposto_percentual || 0) / 100;
  const partners = (config.partners ?? []).filter((p) => p.ativo !== false);
  const somaPartners = partners.reduce((a, p) => a + Number(p.percentual || 0), 0);
  const somaTotal = Number(config.artista_percentual || 0) + somaPartners;
  const sobraProdutora = Math.max(0, round2(100 - somaTotal));

  const rows: DistributionRow[] = [];

  const pushRow = (
    beneficiario: string,
    tipo: DistributionRow["tipo"],
    percentual: number,
  ) => {
    const valor_bruto = round2((sobra * percentual) / 100);
    const imposto_valor = round2(valor_bruto * imposto);
    const valor_liquido = round2(valor_bruto - imposto_valor);
    rows.push({ beneficiario, tipo, percentual, valor_bruto, imposto_valor, valor_liquido });
  };

  pushRow(config.artista_nome || "Artista", "artista", Number(config.artista_percentual || 0));
  for (const p of partners) {
    pushRow(p.nome, p.tipo === "parceiro" ? "parceiro" : "socio", Number(p.percentual || 0));
  }
  if (sobraProdutora > 0.001) {
    pushRow("Produtora", "produtora", sobraProdutora);
  }

  const totalImpostos = round2(rows.reduce((a, r) => a + r.imposto_valor, 0));
  const totalLiquido = round2(rows.reduce((a, r) => a + r.valor_liquido, 0));

  return {
    totalBruto,
    totalComissoes,
    totalCustoEquipeShows,
    totalVan,
    totalOutrasShows,
    totalEquipe,
    totalDespesas,
    totalCustos,
    sobra,
    distribution: rows,
    totalImpostos,
    totalLiquido,
  };
}
