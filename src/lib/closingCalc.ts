// Lógica pura de cálculo do fechamento semanal.

export type ClosingShowInput = {
  cache_total: number;
  comissao_vendedor: number;
  custo_equipe: number;
  van: number;
  despesas_show: number; // total de despesas operacionais do show (exceto van)
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

export type DescontoDe = "todos" | "socios" | "artista";

export type ClosingClipeInput = {
  quantidade: number;
  valor_por_clipe: number;
  desconto_de?: DescontoDe;
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
  despesas_semanais_valor?: number; // despesas semanais alocadas (artista ou sócios)
  valor_liquido: number;
};

export type ClosingTotals = {
  totalBruto: number;
  totalComissoes: number;
  totalCustoEquipeShows: number;
  totalVan: number;
  totalDespesasShows: number;
  totalEquipe: number;
  totalClipe: number; // total geral (todos + sócios + artista) — compat
  totalDespesasSemanaisTodos: number;
  totalDespesasSemanaisSocios: number;
  totalDespesasSemanaisArtista: number;
  totalCustos: number;
  sobra: number;
  sobraDistribuir: number;
  totalInvestimentos: number;
  distribution: DistributionRow[];
  totalImpostos: number;
  totalLiquido: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeCrewTotal(c: ClosingCrewInput): number {
  return round2(Number(c.cache_por_show || 0) * Number(c.shows_participados || 0));
}

export function computeClipeTotal(c: ClosingClipeInput): number {
  return round2(Number(c.quantidade || 0) * Number(c.valor_por_clipe || 0));
}

export function computeClosing(
  shows: ClosingShowInput[],
  crew: ClosingCrewInput[],
  investments: ClosingInvestmentInput[],
  config: ClosingConfigInput,
  clipes: ClosingClipeInput[] = [],
): ClosingTotals {
  const incluidos = shows.filter((s) => s.incluido);
  const totalBruto = round2(incluidos.reduce((a, s) => a + Number(s.cache_total || 0), 0));
  const totalComissoes = round2(incluidos.reduce((a, s) => a + Number(s.comissao_vendedor || 0), 0));
  const totalCustoEquipeShows = round2(incluidos.reduce((a, s) => a + Number(s.custo_equipe || 0), 0));
  const totalVan = round2(incluidos.reduce((a, s) => a + Number(s.van || 0), 0));
  const totalDespesasShows = round2(incluidos.reduce((a, s) => a + Number(s.despesas_show || 0), 0));
  const totalEquipe = round2(crew.reduce((a, c) => a + computeCrewTotal(c), 0));

  const sumByTipo = (tipo: DescontoDe) =>
    round2(
      clipes
        .filter((c) => (c.desconto_de ?? "todos") === tipo)
        .reduce((a, c) => a + computeClipeTotal(c), 0),
    );
  const totalDespesasSemanaisTodos = sumByTipo("todos");
  const totalDespesasSemanaisSocios = sumByTipo("socios");
  const totalDespesasSemanaisArtista = sumByTipo("artista");
  const totalClipe = round2(
    totalDespesasSemanaisTodos + totalDespesasSemanaisSocios + totalDespesasSemanaisArtista,
  );

  // Custos operacionais antes da distribuição (apenas "todos" entram aqui)
  const totalCustos = round2(
    totalComissoes + totalEquipe + totalVan + totalDespesasShows + totalDespesasSemanaisTodos,
  );

  const totalInvestimentos = round2(investments.reduce((a, i) => a + Number(i.valor_descontado || 0), 0));

  const impostoPct = Number(config.imposto_percentual || 0) / 100;
  const totalImpostos = round2(totalBruto * impostoPct);
  const sobraDistribuir = round2(totalBruto - totalCustos - totalImpostos);
  const sobra = sobraDistribuir;
  const partners = (config.partners ?? []).filter((p) => p.ativo !== false);
  const somaPartners = partners.reduce((a, p) => a + Number(p.percentual || 0), 0);
  const somaTotal = Number(config.artista_percentual || 0) + somaPartners;
  const sobraProdutora = Math.max(0, round2(100 - somaTotal));
  const somaSocios = somaPartners;

  const rows: DistributionRow[] = [];

  const pushRow = (
    beneficiario: string,
    tipo: DistributionRow["tipo"],
    percentual: number,
  ) => {
    const valor_bruto = round2((sobraDistribuir * percentual) / 100);
    let investimento_valor = 0;
    let despesas_semanais_valor = 0;
    if ((tipo === "socio" || tipo === "parceiro") && somaSocios > 0) {
      investimento_valor = round2((totalInvestimentos * percentual) / somaSocios);
      despesas_semanais_valor = round2((totalDespesasSemanaisSocios * percentual) / somaSocios);
    }
    if (tipo === "artista") {
      despesas_semanais_valor = totalDespesasSemanaisArtista;
    }
    const valor_liquido = round2(valor_bruto - investimento_valor - despesas_semanais_valor);
    rows.push({
      beneficiario, tipo, percentual,
      valor_bruto, imposto_valor: 0,
      investimento_valor,
      despesas_semanais_valor,
      valor_liquido,
    });
  };

  pushRow(config.artista_nome || "Artista", "artista", Number(config.artista_percentual || 0));
  for (const p of partners) {
    pushRow(p.nome, p.tipo === "parceiro" ? "parceiro" : "socio", Number(p.percentual || 0));
  }
  if (sobraProdutora > 0.001) {
    pushRow("Produtora", "produtora", sobraProdutora);
  }

  // Compensação de arredondamento: ajusta diferença <= R$ 0,02 no primeiro participante
  if (rows.length > 0 && Math.abs(somaTotal + sobraProdutora - 100) < 0.001) {
    const somaBruto = round2(rows.reduce((a, r) => a + r.valor_bruto, 0));
    const diff = round2(sobraDistribuir - somaBruto);
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.05) {
      rows[0].valor_bruto = round2(rows[0].valor_bruto + diff);
      rows[0].valor_liquido = round2(
        rows[0].valor_bruto - rows[0].investimento_valor - (rows[0].despesas_semanais_valor ?? 0),
      );
    }
  }

  const totalLiquido = round2(rows.reduce((a, r) => a + r.valor_liquido, 0));

  return {
    totalBruto,
    totalComissoes,
    totalCustoEquipeShows,
    totalVan,
    totalDespesasShows,
    totalEquipe,
    totalClipe,
    totalDespesasSemanaisTodos,
    totalDespesasSemanaisSocios,
    totalDespesasSemanaisArtista,
    totalCustos,
    sobra,
    sobraDistribuir,
    totalInvestimentos,
    distribution: rows,
    totalImpostos,
    totalLiquido,
  };
}
