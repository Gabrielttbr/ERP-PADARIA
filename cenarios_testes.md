# Cenários de Testes — ERP Padaria

Cenários BDD em **Gherkin (pt-BR)** para validar as operações principais: PDV/venda, caixa,
dashboard (financeiro + operacional), relatórios (por produto, por categoria, por dia),
curva ABC e estoque/cadastro.

Os valores esperados foram **calculados a partir das fórmulas reais do backend**
(`venda_service.py`, `caixa_service.py`, `dashboard_service.py`, `relatorio_dinamico_service.py`),
então dá para executar à mão no sistema ou automatizar com `pytest-bdd` depois.

> Convenções
> - `@manual` = executar pela interface · `@api` = dá para automatizar via endpoint
> - `@bug-suspeito` = cenário que, pela leitura do código, **deve falhar hoje** (ver seção final)
> - Valores em R$, arredondamento comercial (ROUND_HALF_UP) com 2 casas; quantidades por kg com 3 casas.

---

## 0. Massa de dados (usar em todos os cenários)

Base limpa, fuso `America/Sao_Paulo`, um único dia de teste (**D**).

### Categorias

| Categoria   | Produtos              |
|-------------|-----------------------|
| Pães        | Pão Francês           |
| Lanchonete  | Café Expresso, Fatia de Bolo |
| Frios       | Mussarela             |

### Produtos

| Produto        | Unid. | Preço custo | Preço venda | Estoque inicial |
|----------------|-------|------------:|------------:|----------------:|
| Pão Francês    | kg    |  6,00       | 16,00       | 20,000 kg       |
| Café Expresso  | un    |  1,50       |  5,00       | 100             |
| Fatia de Bolo  | un    |  3,00       |  8,00       | 30              |
| Mussarela      | kg    | 32,00       | 50,00       | 10,000 kg       |

### Roteiro do dia D (o "dia padrão")

| Venda | Itens                                   | Subtotal | Desconto        | Total  | Pagamento                      | Custo  | Status        |
|-------|-----------------------------------------|---------:|-----------------|-------:|--------------------------------|-------:|---------------|
| V1    | 0,500 kg Pão (8,00) + 2 Café (10,00)    | 18,00    | —               | 18,00  | Dinheiro 20,00 (troco 2,00)    |  6,00  | concluída     |
| V2    | 3 Bolo (24,00) + 0,250 kg Mussarela (12,50) | 36,50 | R$ 6,50        | 30,00  | PIX 30,00                      | 17,00  | concluída     |
| V3    | 1,250 kg Pão (20,00) + 1 Café (5,00)    | 25,00    | 10% = 2,50      | 22,50  | Débito 22,50 — Maquineta 1     |  9,00  | concluída     |
| V4    | 4 Café (20,00)                          | 20,00    | —               | 20,00  | Dinheiro 20,00                 |  6,00  | **cancelada** |

Caixa: abertura **R$ 100,00**, sangria **R$ 30,00**, suprimento **R$ 50,00**.

### Resultado esperado do dia D (gabarito)

| Indicador                     | Valor esperado | Como chega                         |
|-------------------------------|---------------:|------------------------------------|
| Faturamento bruto             | R$ 79,50       | 18,00 + 36,50 + 25,00 (subtotais)  |
| Descontos                     | R$ 9,00        | 6,50 + 2,50                        |
| Faturamento líquido           | R$ 70,50       | 18,00 + 30,00 + 22,50              |
| Custo total                   | R$ 32,00       | 6,00 + 17,00 + 9,00                |
| Lucro bruto                   | R$ 38,50       | 70,50 − 32,00                      |
| Margem média                  | 54,61 %        | 38,50 / 70,50                      |
| Qtd. vendas                   | 3              | V4 cancelada não conta             |
| Ticket médio                  | R$ 23,50       | 70,50 / 3                          |
| Itens vendidos                | 8              | 0,5+2+3+0,25+1,25+1                |
| Total vendas da sessão        | R$ 70,50       | V4 entra e sai no cancelamento     |

---

## 1. PDV — Carrinho e venda

```gherkin
# language: pt
@pdv @manual
Funcionalidade: Carrinho do PDV
  Como operador de caixa
  Quero adicionar, alterar e remover itens
  Para que o total da venda reflita exatamente o que o cliente leva

  Contexto:
    Dado que existe uma sessão de caixa aberta
    E os produtos da massa de dados estão cadastrados

  Cenário: Adicionar produto unitário soma no total
    Quando adiciono 1 "Café Expresso" ao carrinho
    Então o carrinho deve ter 1 item "Café Expresso" com quantidade 1
    E o total do item deve ser R$ 5,00
    E o subtotal do carrinho deve ser R$ 5,00

  Cenário: Adicionar o mesmo produto de novo incrementa a quantidade (não duplica linha)
    Dado que o carrinho tem 1 "Café Expresso"
    Quando adiciono 1 "Café Expresso" novamente
    Então o carrinho deve ter apenas 1 linha de "Café Expresso"
    E a quantidade deve ser 2
    E o subtotal deve ser R$ 10,00

  Cenário: Botão "+" aumenta a quantidade de produto unitário
    Dado que o carrinho tem 2 "Café Expresso"
    Quando clico no botão "+" do item
    Então a quantidade deve ser 3
    E o subtotal deve ser R$ 15,00

  Cenário: Botão "−" diminui a quantidade de produto unitário
    Dado que o carrinho tem 3 "Café Expresso"
    Quando clico no botão "−" do item
    Então a quantidade deve ser 2
    E o subtotal deve ser R$ 10,00

  Cenário: Diminuir até zero remove o item do carrinho
    Dado que o carrinho tem 1 "Café Expresso"
    Quando clico no botão "−" do item
    Então o item "Café Expresso" não deve mais estar no carrinho
    E o subtotal deve ser R$ 0,00

  Cenário: Produto por kg abre o modal de peso
    Quando seleciono o produto "Pão Francês"
    Então o modal de peso deve ser exibido
    Quando informo o peso 0,500 kg e confirmo
    Então o carrinho deve ter "Pão Francês" com quantidade "0,500 kg"
    E o total do item deve ser R$ 8,00

  Esquema do Cenário: Valor do item por kg acompanha o peso informado
    Quando adiciono "<produto>" com peso <peso> kg
    Então o total do item deve ser R$ <total>

    Exemplos:
      | produto     | peso  | total |
      | Pão Francês | 0,500 | 8,00  |
      | Pão Francês | 1,250 | 20,00 |
      | Pão Francês | 0,333 | 5,33  |
      | Pão Francês | 0,001 | 0,02  |
      | Mussarela   | 0,250 | 12,50 |
      | Mussarela   | 0,175 | 8,75  |

  Cenário: Botão "+" em produto por kg soma 1 grama (0,001 kg)
    Dado que o carrinho tem 0,500 kg de "Pão Francês"
    Quando clico no botão "+" do item
    Então a quantidade deve ser "0,501 kg"
    E o total do item deve ser R$ 8,02

  Cenário: Botão "−" em produto por kg tira 1 grama (0,001 kg)
    Dado que o carrinho tem 0,500 kg de "Pão Francês"
    Quando clico no botão "−" do item
    Então a quantidade deve ser "0,499 kg"
    E o total do item deve ser R$ 7,98

  Cenário: Editar o peso digitando direto no carrinho
    Dado que o carrinho tem 0,500 kg de "Pão Francês"
    Quando edito a quantidade para "1,250"
    Então o total do item deve ser R$ 20,00

  Cenário: Total do carrinho com itens unitários e por kg
    Quando adiciono 0,500 kg de "Pão Francês"
    E adiciono 2 "Café Expresso"
    Então o subtotal deve ser R$ 18,00

  Cenário: Carrinho e venda gravada mostram o mesmo valor (arredondamento)
    Quando adiciono 0,333 kg de "Pão Francês"
    E finalizo a venda em dinheiro
    Então o total exibido no carrinho deve ser igual ao total do recibo
    E o total gravado na venda deve ser R$ 5,33
```

```gherkin
# language: pt
@pdv @desconto @api
Funcionalidade: Desconto na venda

  Cenário: Desconto em valor reduz o total
    Dado um carrinho com 3 "Fatia de Bolo" e 0,250 kg de "Mussarela"
    Quando aplico desconto de R$ 6,50
    Então o subtotal deve ser R$ 36,50
    E o desconto deve ser R$ 6,50
    E o total deve ser R$ 30,00

  Cenário: Desconto percentual reduz o total
    Dado um carrinho com 1,250 kg de "Pão Francês" e 1 "Café Expresso"
    Quando aplico desconto de 10%
    Então o desconto calculado deve ser R$ 2,50
    E o total deve ser R$ 22,50

  Cenário: Desconto maior que o subtotal é recusado
    Dado um carrinho com 1 "Café Expresso"
    Quando tento finalizar com desconto de R$ 6,00
    Então a venda deve ser recusada com a mensagem "Desconto não pode ser maior que o subtotal"
    E o estoque do "Café Expresso" não deve mudar

  Cenário: Remover o desconto volta ao total cheio
    Dado um carrinho de R$ 36,50 com desconto de R$ 6,50
    Quando removo o desconto
    Então o total deve ser R$ 36,50
```

```gherkin
# language: pt
@pdv @pagamento @api
Funcionalidade: Pagamento e finalização

  Cenário: Pagamento em dinheiro com troco
    Dado um carrinho de R$ 18,00
    Quando pago R$ 20,00 em "Dinheiro"
    Então a venda deve ser concluída
    E o troco deve ser R$ 2,00

  Cenário: Pagamento insuficiente é recusado
    Dado um carrinho de R$ 18,00
    Quando pago R$ 15,00 em "Dinheiro"
    Então a venda deve ser recusada com "Valor pago (15.00) é menor que o total (18.00)"

  Cenário: Pagamento dividido em duas formas
    Dado um carrinho de R$ 50,00
    Quando pago R$ 20,00 em "PIX" e R$ 30,00 em "Cartão de Crédito"
    Então a venda deve ser concluída com troco R$ 0,00
    E a venda deve ter 2 pagamentos que somam R$ 50,00

  Cenário: Cartão seleciona Maquineta 1 por padrão
    Dado um carrinho de R$ 22,50
    Quando escolho a forma "Cartão de Débito"
    Então a "Maquineta 1" deve estar selecionada

  Cenário: Finalizar venda baixa o estoque
    Dado que o "Pão Francês" tem 20,000 kg em estoque
    E o "Café Expresso" tem 100 un
    Quando finalizo uma venda com 0,500 kg de "Pão Francês" e 2 "Café Expresso"
    Então o estoque do "Pão Francês" deve ser 19,500 kg
    E o estoque do "Café Expresso" deve ser 98
    E deve existir uma movimentação de estoque do tipo "venda" para cada item

  Cenário: Venda acima do estoque é recusada
    Dado que a "Mussarela" tem 0,200 kg em estoque
    Quando tento vender 0,250 kg de "Mussarela"
    Então a venda deve ser recusada com "Estoque insuficiente para 'Mussarela'"

  Cenário: Produto "Diverso" (código 999) vende sem estoque
    Quando adiciono um item Diverso de R$ 7,00
    E finalizo a venda
    Então a venda deve ser concluída com total R$ 7,00

  Cenário: Não é possível vender sem caixa aberto
    Dado que não existe sessão de caixa aberta
    Quando tento finalizar uma venda
    Então devo ver "Nenhuma sessão de caixa aberta. Abra o caixa antes de vender."
```

```gherkin
# language: pt
@pdv @cancelamento @api
Funcionalidade: Cancelamento de venda

  Cenário: Cancelar venda devolve o estoque e tira o valor do caixa
    Dado que a sessão tem total de vendas R$ 70,50
    E o "Café Expresso" tem 94 un em estoque
    Quando finalizo a venda V4 (4 "Café Expresso", R$ 20,00)
    Então o total de vendas da sessão deve ser R$ 90,50
    E o estoque do "Café Expresso" deve ser 90
    Quando cancelo a venda V4 com o motivo "cliente desistiu"
    Então o status da venda deve ser "cancelada"
    E o total de vendas da sessão deve voltar a R$ 70,50
    E o estoque do "Café Expresso" deve voltar a 94
    E deve existir uma movimentação de estoque do tipo "devolucao"

  Cenário: Não cancela uma venda já cancelada
    Dado que a venda V4 está cancelada
    Quando tento cancelar a venda V4 de novo
    Então devo receber erro "Venda com status 'cancelada' não pode ser cancelada"
```

---

## 2. Caixa — abertura, movimentações e fechamento

```gherkin
# language: pt
@caixa @api
Funcionalidade: Sessão de caixa

  Cenário: Abrir caixa com valor inicial
    Quando abro o "Caixa 1" com R$ 100,00
    Então a sessão deve ficar com status "aberto"
    E o valor de abertura deve ser R$ 100,00
    E o total de vendas deve ser R$ 0,00

  Cenário: Tecla Enter abre o caixa
    Dado que estou na tela de abertura de caixa
    Quando digito R$ 100,00 e pressiono Enter
    Então a sessão deve ser aberta

  Cenário: Não abre duas sessões no mesmo caixa
    Dado que o "Caixa 1" já está aberto
    Quando tento abrir o "Caixa 1" novamente
    Então devo receber erro "Caixa já possui sessão aberta"

  Cenário: Cada venda concluída soma no total da sessão
    Dado que o caixa foi aberto com R$ 100,00
    Quando finalizo as vendas V1, V2 e V3
    Então o total de vendas da sessão deve ser R$ 70,50

  Cenário: Sangria e suprimento atualizam os totais
    Dado que o caixa foi aberto com R$ 100,00
    Quando registro uma sangria de R$ 30,00 com motivo "depósito"
    E registro um suprimento de R$ 50,00 com motivo "troco"
    Então o total de sangrias deve ser R$ 30,00
    E o total de suprimentos deve ser R$ 50,00

  Cenário: Sangria maior que o saldo é recusada
    Dado que o caixa foi aberto com R$ 100,00 e não tem vendas
    Quando tento registrar uma sangria de R$ 150,00
    Então devo receber erro "Saldo insuficiente para sangria"
```

```gherkin
# language: pt
@caixa @fechamento @api
Funcionalidade: Fechamento de caixa

  Contexto:
    Dado que o caixa foi aberto com R$ 100,00
    E foi executado o roteiro do dia D (V1, V2, V3 concluídas e V4 cancelada)
    E foi feita sangria de R$ 30,00 e suprimento de R$ 50,00

  Cenário: Resumo do fechamento por forma de pagamento
    Quando fecho o caixa
    Então o resumo deve mostrar:
      | campo                | valor  |
      | Dinheiro             | 18,00  |
      | PIX                  | 30,00  |
      | Cartão de Débito     | 22,50  |
      | Cartão de Crédito    | 0,00   |
      | Vale                 | 0,00   |
      | Quantidade de vendas | 3      |
      | Ticket médio         | 23,50  |
      | Total de vendas      | 70,50  |
    # P2 corrigido: "Dinheiro" mostra 18,00 (valor líquido do troco).

  @bug-suspeito
  Cenário: Diferença de caixa considera só o dinheiro físico
    # Dinheiro na gaveta = 100,00 abertura + 18,00 vendas em dinheiro − 30,00 sangria + 50,00 suprimento
    Quando fecho o caixa informando R$ 138,00 contados na gaveta
    Então a diferença deve ser R$ 0,00
    # Hoje o sistema espera 190,50 (soma PIX e cartão no saldo) e mostra diferença −52,50. Ver P1.

  @bug-suspeito
  Cenário: Fechamento com falta de dinheiro
    Quando fecho o caixa informando R$ 135,00
    Então a diferença deve ser negativa em R$ 3,00
    # Depende de P1. Hoje o sistema mostraria −55,50.

  Cenário: Total do caixa fechado aparece no dashboard do dia
    Quando fecho o caixa
    E abro o dashboard com o filtro "Hoje"
    Então o "Fat. Líquido" deve ser R$ 70,50
    E o "Faturamento Bruto" deve ser R$ 79,50
    E a "Qtd. Vendas" deve ser 3

  Cenário: Botões de fechar caixa e valores reiniciam após o fechamento
    Quando fecho o caixa
    E volto para a tela /caixa
    Então os campos de valor devem estar zerados
    E o botão de "Abrir caixa" deve estar visível
```

---

## 3. Dashboard — Financeiro

```gherkin
# language: pt
@dashboard @financeiro @api
Funcionalidade: Indicadores financeiros do dashboard
  Para que o dono confie nos números
  Cada card deve bater com as vendas concluídas do período

  Contexto:
    Dado que foi executado o roteiro do dia D
    E abro o dashboard com o filtro "Hoje"

  Cenário: Faturamento bruto soma os subtotais antes do desconto
    Então "Faturamento Bruto" deve ser R$ 79,50

  Cenário: Faturamento líquido é o bruto menos os descontos
    Então "Fat. Líquido" deve ser R$ 70,50

  Cenário: Lucro bruto é o líquido menos o custo
    Então "Lucro Bruto" deve ser R$ 38,50

  Cenário: Margem média é lucro sobre faturamento líquido
    Então "Margem Média" deve ser 54,61%

  Cenário: Venda cancelada não entra em nenhum indicador
    Quando cancelo a venda V3 (R$ 22,50)
    E atualizo o dashboard
    Então "Fat. Líquido" deve ser R$ 48,00
    E "Faturamento Bruto" deve ser R$ 54,50
    E "Qtd. Vendas" deve ser 2

  Esquema do Cenário: Um valor vendido aparece integralmente no faturamento
    Dado uma base sem vendas no dia
    Quando vendo R$ <valor> sem desconto
    Então "Faturamento Bruto" deve ser R$ <valor>
    E "Fat. Líquido" deve ser R$ <valor>

    Exemplos:
      | valor    |
      | 1000,00  |
      | 0,02     |
      | 5,33     |

  Cenário: Venda feita à noite entra no "Hoje" (fuso de Brasília)
    Dado uma venda de R$ 10,00 feita hoje às 22:30 (horário de Brasília)
    Quando abro o dashboard com o filtro "Hoje"
    Então "Fat. Líquido" deve incluir os R$ 10,00
```

## 4. Dashboard — Operacional

```gherkin
# language: pt
@dashboard @operacional @api
Funcionalidade: Indicadores operacionais do dashboard

  Contexto:
    Dado que foi executado o roteiro do dia D
    E abro o dashboard com o filtro "Hoje"

  Cenário: Quantidade de vendas conta só as concluídas
    Então "Qtd. Vendas" deve ser 3

  Cenário: Ticket médio é o faturamento líquido dividido pela quantidade de vendas
    Então "Ticket Médio" deve ser R$ 23,50

  Cenário: Custo total usa o custo do produto no momento da venda
    Então "Custo Total" deve ser R$ 32,00

  Cenário: Mudar o preço de custo depois não altera vendas passadas
    Quando altero o preço de custo do "Pão Francês" para R$ 10,00
    E atualizo o dashboard
    Então "Custo Total" deve continuar R$ 32,00

  Cenário: Itens vendidos soma as quantidades
    Então "Itens Vendidos" deve ser 8

  @bug-suspeito
  Cenário: Itens vendidos não zera venda só por peso
    Dado uma base sem vendas no dia
    Quando vendo 0,500 kg de "Pão Francês" e 0,250 kg de "Mussarela"
    Então "Itens Vendidos" deve mostrar 0,750 (ou 2 itens, conforme regra definida)
    # Hoje mostra 0: o backend converte a soma pra inteiro. Ver P5.

  Cenário: Recebimentos por maquineta
    Então em "Recebimentos por Maquineta" a "Maquineta 1" deve ter:
      | Débito | Crédito | Total |
      | 22,50  | 0,00    | 22,50 |

  @bug-suspeito
  Cenário: Filtro de caixa no dashboard
    Dado vendas no "Caixa 1" de R$ 70,50 e no "Caixa 2" de R$ 30,00
    Quando filtro o dashboard pelo "Caixa 1"
    Então "Fat. Líquido" deve ser R$ 70,50
    # Hoje o filtro caixa_id é ignorado nos KPIs. Ver P6.
```

---

## 5. Relatório de vendas por dia

```gherkin
# language: pt
@relatorio @vendas-dia @api
Funcionalidade: Vendas por dia

  Cenário: Um dia com vendas
    Dado que foi executado o roteiro do dia D
    Quando consulto "Vendas por dia" do período D até D
    Então deve existir 1 linha com:
      | data | total_vendas | quantidade_vendas |
      | D    | 70,50        | 3                 |

  Cenário: Vários dias, cada um no seu dia
    Dado vendas de R$ 100,00 no dia D-1 e R$ 70,50 no dia D
    Quando consulto o período "7 dias"
    Então o dia D-1 deve mostrar R$ 100,00
    E o dia D deve mostrar R$ 70,50
    E a soma das barras deve ser igual ao "Fat. Líquido" do período

  @bug-suspeito
  Cenário: Venda das 22h fica no dia certo do gráfico
    Dado uma venda de R$ 10,00 no dia D às 22:30 (Brasília)
    Quando consulto "Vendas por dia"
    Então a venda deve aparecer no dia D, e não em D+1
    # Hoje o agrupamento usa a data em UTC. Ver P4.

  Cenário: Relatório PDF/Excel bate com o dashboard
    Dado que foi executado o roteiro do dia D
    Quando exporto o relatório de vendas de D em PDF e em Excel
    Então ambos devem listar 3 vendas
    E o "TOTAL GERAL" deve ser R$ 70,50
    E a venda cancelada V4 não deve aparecer
```

---

## 6. Relatório por produto

> Faturamento aqui é a soma dos itens (**antes** do desconto geral da venda), portanto a
> soma dos produtos bate com o **Faturamento Bruto**, não com o Líquido.

```gherkin
# language: pt
@relatorio @produto @api
Funcionalidade: Relatório de vendas por produto

  Contexto:
    Dado que foi executado o roteiro do dia D
    Quando gero o relatório dinâmico por "produto" com todas as métricas no dia D

  Cenário: Indicadores por produto
    Então o relatório deve conter:
      | produto       | quantidade | faturamento | custo | lucro | num_vendas | ticket_medio |
      | Café Expresso | 3          | 15,00       | 4,50  | 10,50 | 2          | 7,50         |
      | Fatia de Bolo | 3          | 24,00       | 9,00  | 15,00 | 1          | 24,00        |
      | Mussarela     | 0,250      | 12,50       | 8,00  | 4,50  | 1          | 12,50        |
      | Pão Francês   | 1,750      | 28,00       | 10,50 | 17,50 | 2          | 14,00        |

  Cenário: Venda cancelada não entra no relatório por produto
    Então o "Café Expresso" deve ter quantidade 3 (e não 7)

  Cenário: Soma do relatório bate com o dashboard
    Então a soma do faturamento dos produtos deve ser R$ 79,50 (= Faturamento Bruto)
    E a soma do custo deve ser R$ 32,00 (= Custo Total)

  Cenário: Produto por kg mostra a unidade
    Então a linha "Pão Francês" deve mostrar unidade "kg"

  Cenário: Filtrar por um produto
    Quando filtro pelo produto "Pão Francês"
    Então o relatório deve ter só 1 linha, com faturamento R$ 28,00
```

## 7. Relatório por categoria

```gherkin
# language: pt
@relatorio @categoria @api
Funcionalidade: Relatório de vendas por categoria

  Contexto:
    Dado que foi executado o roteiro do dia D
    Quando gero o relatório dinâmico por "categoria" com todas as métricas no dia D

  Cenário: Indicadores por categoria
    Então o relatório deve conter:
      | categoria  | quantidade | faturamento | custo | lucro | num_vendas | ticket_medio |
      | Frios      | 0,250      | 12,50       | 8,00  | 4,50  | 1          | 12,50        |
      | Lanchonete | 6          | 39,00       | 13,50 | 25,50 | 3          | 13,00        |
      | Pães       | 1,750      | 28,00       | 10,50 | 17,50 | 2          | 14,00        |

  Cenário: Número de vendas da categoria conta cada venda uma vez só
    # V1 tem Café, V2 tem Bolo, V3 tem Café → 3 vendas distintas na Lanchonete
    Então "Lanchonete" deve ter num_vendas 3

  Cenário: Categoria + produto (duas dimensões)
    Quando gero o relatório por "categoria" e "produto"
    Então "Lanchonete / Café Expresso" deve ter faturamento R$ 15,00
    E "Lanchonete / Fatia de Bolo" deve ter faturamento R$ 24,00

  Cenário: Relatório sem dimensão ou métrica é recusado
    Quando gero o relatório sem escolher dimensão
    Então devo ver "Escolha ao menos uma dimensão"
```

---

## 8. Curva ABC / Top produtos

Regra: ordena por faturamento, % acumulado ≤ 80 → **A**, ≤ 95 → **B**, resto → **C**.

```gherkin
# language: pt
@dashboard @curva-abc @api
Funcionalidade: Curva ABC e Top produtos

  Contexto:
    Dado que foi executado o roteiro do dia D
    E abro o dashboard com o filtro "Hoje"

  @bug-suspeito
  Cenário: Classificação ABC do dia
    Então a curva ABC deve ser:
      | posição | produto       | faturamento | %     | % acumulado | classe |
      | 1       | Pão Francês   | 28,00       | 35,22 | 35,22       | A      |
      | 2       | Fatia de Bolo | 24,00       | 30,19 | 65,41       | A      |
      | 3       | Café Expresso | 15,00       | 18,87 | 84,28       | B      |
      | 4       | Mussarela     | 12,50       | 15,72 | 100,00      | C      |
    # Hoje o Café deve aparecer com 35,00 (soma a venda cancelada V4). Ver P3.

  Cenário: Top 3 mostra os medalhistas na ordem
    Então o 🥇 deve ser "Pão Francês"
    E o 🥈 deve ser "Fatia de Bolo"
    E o 🥉 deve ser "Café Expresso"

  @bug-suspeito
  Cenário: Vendas fora do período não entram na curva
    Dado uma venda de R$ 500,00 de "Mussarela" no dia D-10
    Quando abro o dashboard com o filtro "Hoje"
    Então a "Mussarela" deve continuar com faturamento R$ 12,50

  Cenário: Soma da curva bate com os relatórios
    Então a soma do faturamento da curva ABC deve ser R$ 79,50
```

---

## 9. Estoque e cadastro

```gherkin
# language: pt
@estoque @categoria @manual
Funcionalidade: Cadastro de categorias

  Cenário: Criar categoria
    Quando crio a categoria "Confeitaria"
    Então ela deve aparecer na lista de categorias
    E deve aparecer como filtro no PDV e no Estoque

  Cenário: Criar subcategoria
    Dado que existe a categoria "Confeitaria"
    Quando crio a subcategoria "Bolos" dentro de "Confeitaria"
    Então "Bolos" deve aparecer abaixo de "Confeitaria" na árvore

  Cenário: Não permite categoria duplicada no mesmo nível
    Dado que existe a categoria "Pães"
    Quando tento criar outra categoria "Pães" no mesmo nível
    Então devo ver uma mensagem de erro
    E deve continuar existindo só uma "Pães"

  Cenário: Renomear categoria reflete nos produtos
    Quando renomeio "Frios" para "Frios e Laticínios"
    Então o produto "Mussarela" deve mostrar a categoria "Frios e Laticínios"
    E o relatório por categoria deve usar o novo nome

  Cenário: Excluir categoria
    Dado uma categoria "Teste" sem produtos
    Quando excluo a categoria "Teste"
    Então ela não deve mais aparecer na lista
```

```gherkin
# language: pt
@estoque @produto @api
Funcionalidade: Cadastro de produto

  Cenário: Cadastrar produto salva preço de custo e de venda
    Quando cadastro o produto "Sonho" na categoria "Pães", unidade "un", custo R$ 2,00 e venda R$ 6,00
    Então o produto deve aparecer na lista do Estoque
    E o preço de custo deve ser R$ 2,00
    E o preço de venda deve ser R$ 6,00
    E a margem de lucro deve ser 200,00%
    # margem do produto = (venda − custo) / custo. Ver P7.

  Cenário: Editar preço de venda vale para as próximas vendas
    Dado que vendi 1 "Sonho" a R$ 6,00
    Quando altero o preço de venda do "Sonho" para R$ 7,00
    E vendo mais 1 "Sonho"
    Então a primeira venda deve continuar com R$ 6,00
    E a segunda venda deve ter R$ 7,00

  Cenário: Produto vendido por kg
    Quando cadastro "Pão de Queijo" com unidade "kg" e venda R$ 40,00
    Então no PDV, ao selecioná-lo, deve abrir o modal de peso

  Cenário: Produto inativo não pode ser vendido
    Dado que o produto "Sonho" está inativo
    Quando tento vender "Sonho"
    Então devo ver "Produto(s) não encontrado(s) ou inativo(s)"
```

```gherkin
# language: pt
@estoque @movimentacao @api
Funcionalidade: Movimentação de estoque

  Esquema do Cenário: Ajustes manuais
    Dado que o "Café Expresso" tem 100 un em estoque
    Quando registro uma movimentação "<tipo>" de <qtd>
    Então o estoque deve ser <saldo>

    Exemplos:
      | tipo    | qtd | saldo |
      | entrada | 20  | 120   |
      | saida   | 10  | 90    |
      | perda   | 5   | 95    |
      | ajuste  | 80  | 80    |

  Cenário: Alerta de estoque baixo
    Dado que o "Café Expresso" tem estoque mínimo 10
    Quando o estoque cai para 8
    Então o produto deve aparecer em "Alertas de estoque"

  Cenário: Alerta urgente abaixo de 30% do mínimo
    Dado que o "Café Expresso" tem estoque mínimo 10
    Quando o estoque cai para 3
    Então o alerta deve estar marcado como urgente
```

---

## 10. Pontos de atenção encontrados na leitura do código

Achei estes pontos lendo o código. Os cenários `@bug-suspeito` acima servem para confirmar cada um.

| #  | Onde | O que acontece hoje | Impacto |
|----|------|---------------------|---------|
| P1 | `caixa_service.fechar_caixa` | `saldo_esperado = abertura + total_vendas − sangrias + suprimentos` usa **todas** as formas (PIX/cartão também) | No dia D o sistema espera R$ 190,50 na gaveta, mas só há R$ 138,00 → diferença falsa de −52,50. A sangria também é validada contra esse saldo inflado |
| P2 ✅ | `venda_service` / resumo do fechamento | **Corrigido.** `Pagamento.valor` gravava o valor **entregue** (20,00) em vez do líquido do troco (18,00). Agora grava o líquido, o recibo continua mostrando o entregue, e PIX/cartão/vale acima do total é recusado | Vendas **antigas** continuam com o valor inflado no banco |
| P3 | `dashboard_service.curva_abc` | O filtro de status/período está no `JOIN` de `Venda`, mas soma `ItemVenda.total_item` de qualquer jeito | Curva ABC soma vendas **canceladas** e **de outros períodos** |
| P4 | `vendas_por_dia` e dimensão `dia` do relatório dinâmico | Agrupa por `date(created_at)` em **UTC** | Vendas depois das 21h aparecem no dia seguinte no gráfico |
| P5 | `calcular_kpis` → `itens_vendidos=int(...)` | Soma kg + un e trunca pra inteiro | 0,750 kg vira 0; misturar kg com unidade não dá um número que signifique algo |
| P6 | `calcular_kpis(caixa_id=...)` | Parâmetro recebido mas não usado no filtro | Filtro por caixa no dashboard não muda os KPIs |
| P7 | `Produto.margem_lucro` × "Margem Média" | Produto usa markup sobre o custo; dashboard usa margem sobre a venda | Mesmo nome ("margem"), contas diferentes: o usuário pode estranhar |
| P8 | `relatorio_service._buscar_vendas` (PDF/Excel) | Usa `datetime.combine` sem fuso, diferente do dashboard | Relatório PDF/Excel pode perder vendas das 21h–24h e divergir do dashboard |
| P9 | `pdvStore` × backend | Carrinho não arredonda cada item, o backend arredonda | Possível diferença de R$ 0,01 entre a tela e a venda gravada em itens por kg |

---

## 11. Como automatizar (próximo passo)

- Backend já tem `pytest` + `tests/factories.py`. Dá para adicionar `pytest-bdd`, salvar cada
  bloco acima como `backend/tests/features/<nome>.feature` e escrever os *steps* com as factories.
- Os cenários `@manual` (botões +/−, modal de peso, Enter, maquineta padrão) cabem melhor em
  Playwright/Cypress no frontend, ou em `pdvStore.test.ts` para a lógica do carrinho.
- Rodar primeiro os `@bug-suspeito`: se falharem, viram issues; se passarem, minha leitura estava errada.
