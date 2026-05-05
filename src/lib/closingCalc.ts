// Lógica pura de cálculo do fechamento semanal.

export type ClosingShowInput = {
  cache_total: number;
  comissao_vendedor: number;
  custo_equipe: number;
  despesas_show: number; // total de despesas operacionais do show
  incluido: boolean;
};

export type ClosingCrewInput = {
  cache_por_show: number;
  shows_participados: number;
};

export type ClosingPartnerInput = {
  nome: string;
  funcao?: string | null;
  percentual: number;
  ativo?: boolean;
  tipo?: "socio" | "parceiro";
};

export type ClosingInvestmentInput = {
  valor_descontado: number;
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
  valor_bruto: number;        // % * sobra
  imposto_valor: number;      // % * total bruto cachês * imposto%
  investimento_valor: number; // só para sócios/parceiros
  valor_liquido: number;
};

export type ClosingTotals = {
  totalBruto: number;
  totalComissoes: number;
  totalCustoEquipeShows: number;
  totalDespesasShows: number;
  totalEquipe: number;
  totalCustos: number;
  sobra: number;
  totalInvestimentos: number;
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
  investments: ClosingInvestmentInput[],
  config: ClosingConfigInput,
): ClosingTotals {
  const incluidos = shows.filter((s) => s.incluido);
  const totalBruto = round2(incluidos.reduce((a, s) => a + Number(s.cache_total || 0), 0));
  const totalComissoes = round2(incluidos.reduce((a, s) => a + Number(s.comissao_vendedor || 0), 0));
  const totalCustoEquipeShows = round2(incluidos.reduce((a, s) => a + Number(s.custo_equipe || 0), 0));
  const totalDespesasShows = round2(incluidos.reduce((a, s) => a + Number(s.despesas_show || 0), 0));
  const totalEquipe = round2(crew.reduce((a, c) => a + computeCrewTotal(c), 0));
  const totalCustos = round2(totalComissoes + totalCustoEquipeShows + totalDespesasShows);
  const sobra = round2(totalBruto - totalCustos);

  const totalInvestimentos = round2(investments.reduce((a, i) => a + Number(i.valor_descontado || 0), 0));

  const impostoPct = Number(config.imposto_percentual || 0) / 100;
  const partners = (config.partners ?? []).filter((p) => p.ativo !== false);
  const somaPartners = partners.reduce((a, p) => a + Number(p.percentual || 0), 0);
  const somaTotal = Number(config.artista_percentual || 0) + somaPartners;
  const sobraProdutora = Math.max(0, round2(100 - somaTotal));

  // Soma dos % dos sócios (para rateio dos investimentos)
  const somaSocios = somaPartners; // somente sócios/parceiros, não inclui artista nem produtora

  const rows: DistributionRow[] = [];

  const pushRow = (
    beneficiario: string,
    tipo: DistributionRow["tipo"],
    percentual: number,
  ) => {
    const valor_bruto = round2((sobra * percentual) / 100);
    const imposto_valor = round2((totalBruto * percentual) / 100 * impostoPct);
    let investimento_valor = 0;
    if ((tipo === "socio" || tipo === "parceiro") && somaSocios > 0) {
      investimento_valor = round2((totalInvestimentos * percentual) / somaSocios);
    }
    const valor_liquido = round2(valor_bruto - imposto_valor - investimento_valor);
    rows.push({ beneficiario, tipo, percentual, valor_bruto, imposto_valor, investimento_valor, valor_liquido });
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
    totalDespesasShows,
    totalEquipe,
    totalCustos,
    sobra,
    totalInvestimentos,
    distribution: rows,
    totalImpostos,
    totalLiquido,
  };
}
