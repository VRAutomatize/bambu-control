# Motor de Custos

Camada de domínio **pura e testável** (`packages/domain/src/cost-engine`). Sem
I/O. O dashboard e as telas de detalhe usam as MESMAS funções — nenhum KPI
duplica fórmulas no front-end.

## Precisão monetária

Todo cálculo usa `Dec` (`money.ts`), um decimal de ponto fixo baseado em
`BigInt` (escala interna 6 casas). **Nunca** usamos ponto flutuante para dinheiro.
A conversão para `number` ocorre só na borda, arredondando (metade para cima) —
valores monetários em 4 casas (`numeric(14,4)` no banco).

## Fórmulas

```
preço_por_grama   = preço_por_kg / 1000
custo_material    = Σ (peso_material_g × preço_por_grama_snapshot)

duração_h         = duração_s / 3600
energia_kwh       = (potência_w / 1000) × duração_h
custo_energia     = energia_kwh × preço_kwh

base_deprec       = preço_compra − valor_residual
custo_depreciação = (base_deprec / vida_útil_horas) × duração_h   (0 se vida ≤ 0)
custo_manutenção  = manutenção_por_hora × duração_h
custo_overhead    = overhead_por_hora × duração_h
```

### Modos do perfil de máquina

- `calculated`: soma energia + depreciação + manutenção + overhead.
- `direct_hourly_rate`: `custo_máquina = custo_hora_direto × duração_h`.
  **Não** soma energia/depreciação/manutenção novamente (modelado em
  `machine_overhead_cost` no breakdown).

### Reserva de falha (MVP)

```
subtotal_produção = tudo exceto a própria reserva
reserva_falha     = subtotal_produção × (percentual_falha / 100)
```

Impressões falhadas não têm o custo alterado; aparecem separadamente e o custo
pode ser tratado como desperdício no pedido.

### Total, lucro e margem

```
custo_total = material + energia + depreciação + manutenção + overhead
            + mão_de_obra + embalagem + reserva_falha + outros

lucro_bruto = receita − custo_total
margem_%    = receita = 0 ? null : (lucro_bruto / receita) × 100
```

Margem com receita zero é **`null`** (nunca infinito).

## Materiais sem peso por item

Ordem de resolução (nunca inventar distribuição):
1. mapear pelo AMS; 2. distribuição percentual manual; 3. rolo único;
4. marcar o cálculo como **estimado** (`estimated = true`).

## Versionamento

`CALCULATION_VERSION` é gravado em cada `print_cost_snapshots`. Mudanças de
fórmula incrementam a versão e **não** reescrevem snapshots antigos. Alterar o
preço atual de um filamento ou o custo da máquina não altera o histórico.

## Testes

`packages/domain/src/cost-engine/cost-engine.test.ts` cobre material (único e
múltiplo), energia, depreciação (inclui vida útil zero), manutenção/overhead,
modo direto vs calculado, reserva de falha, correção manual, estimado, lucro,
margem com receita zero, ausência de float e versionamento.
