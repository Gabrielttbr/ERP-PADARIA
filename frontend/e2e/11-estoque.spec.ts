import { test, expect, reBrl, digitarValor, TelaEstoque, TelaRelatorios, Dashboard, consultarBanco, estoqueGravado } from './support'

/** cenarios_testes.md — 9. Estoque · Funcionalidade: Cadastro de categorias */
test.describe('Cadastro de categorias @estoque @categoria', () => {
  test.beforeEach(async ({ seed, page }) => {
    seed('base')
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await estoque.abrirCategorias()
  })

  test('Criar categoria', async ({ page, pdv }) => {
    const estoque = new TelaEstoque(page)
    await test.step('Quando crio a categoria "Confeitaria"', () => estoque.criarCategoria('Confeitaria'))
    await test.step('Então ela deve aparecer na lista de categorias', async () => {
      await expect(page.getByText('Categoria criada!')).toBeVisible()
      await expect(estoque.categoria('Confeitaria')).toBeVisible()
    })
    await test.step('E deve aparecer como filtro no Estoque e no PDV', async () => {
      await estoque.abrir()
      await expect(page.locator('select option', { hasText: 'Confeitaria' }).first()).toBeAttached()
      await pdv.abrirCaixa(100)
      await expect(page.getByRole('button', { name: 'Confeitaria', exact: true })).toBeVisible()
    })
  })

  test('Criar subcategoria', async ({ page }) => {
    const estoque = new TelaEstoque(page)
    await test.step('Dado que existe a categoria "Confeitaria"', async () => {
      await estoque.criarCategoria('Confeitaria')
      await expect(estoque.categoria('Confeitaria')).toBeVisible()
    })
    await test.step('Quando crio a subcategoria "Bolos" dentro de "Confeitaria"', () => estoque.criarCategoria('Bolos', 'Confeitaria'))
    await test.step('Então "Bolos" deve aparecer abaixo de "Confeitaria" na árvore', async () => {
      await expect(estoque.categoria('Bolos')).toHaveAttribute('data-nivel', '1')
      const nomes = await page.getByTestId('categoria-item').evaluateAll(els => els.map(e => e.getAttribute('data-nome')))
      expect(nomes.indexOf('Bolos')).toBe(nomes.indexOf('Confeitaria') + 1)
    })
  })

  test('Não permite categoria duplicada no mesmo nível', async ({ page }) => {
    test.fail(true, 'P16 — a API não valida nome duplicado: no SQLite (instalação Windows, usado no E2E) a 2ª "Pães" é criada; no PostgreSQL só o índice barra, com erro 500')
    const estoque = new TelaEstoque(page)
    let status = 0
    await test.step('Dado que existe a categoria "Pães"', () => expect(estoque.categoria('Pães')).toBeVisible())
    await test.step('Quando tento criar outra categoria "Pães" no mesmo nível', async () => { status = await estoque.criarCategoria('Pães') })
    await test.step('Então a API deve recusar com uma mensagem de erro', () => expect(status).toBe(400))
    await test.step('E deve continuar existindo só uma "Pães" (tela e banco)', async () => {
      await expect(estoque.categoria('Pães')).toHaveCount(1)
      expect(consultarBanco("select count(*) as n from categorias where nome = 'Pães' and ativo = 1")).toEqual([{ n: 1 }])
    })
  })

  test('Renomear categoria reflete nos produtos e no relatório', async ({ page, seed }) => {
    seed('dia-d')
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await estoque.abrirCategorias()
    await test.step('Quando renomeio "Frios" para "Frios e Laticínios"', async () => {
      await estoque.categoria('Frios').getByTitle('Clique para editar o nome').click()
      const campo = estoque.categoria('Frios').locator('input')
      await campo.fill('Frios e Laticínios')
      await campo.press('Enter')
      await expect(page.getByText('Nome atualizado')).toBeVisible()
    })
    await test.step('Então o produto "Mussarela" deve mostrar a categoria "Frios e Laticínios"', async () => {
      await estoque.abrir()
      await expect(estoque.linha('Mussarela')).toContainText('Frios e Laticínios')
    })
    await test.step('E o relatório por categoria deve usar o novo nome', async () => {
      const rel = new TelaRelatorios(page)
      await rel.abrir('Relatório Dinâmico')
      await rel.escolher(['Categoria', 'Faturamento'])
      await rel.gerar()
      expect((await rel.tabela()).map(l => l['Categoria'])).toContain('Frios e Laticínios')
    })
  })

  test('Excluir categoria', async ({ page }) => {
    const estoque = new TelaEstoque(page)
    await test.step('Dado uma categoria "Teste" sem produtos', async () => {
      await estoque.criarCategoria('Teste')
      await expect(estoque.categoria('Teste')).toBeVisible()
    })
    await test.step('Quando excluo a categoria "Teste"', async () => {
      await estoque.categoria('Teste').getByRole('button', { name: 'Remover' }).click()
      await estoque.categoria('Teste').getByRole('button', { name: 'Confirmar' }).click()
    })
    await test.step('Então ela não deve mais aparecer na lista', () => expect(estoque.categoria('Teste')).toHaveCount(0))
    await test.step('E no banco fica inativa (exclusão lógica)', () =>
      expect(consultarBanco("select ativo from categorias where nome = 'Teste'")).toEqual([{ ativo: 0 }]))
  })

  test('Recriar uma categoria excluída com o mesmo nome', async ({ page }) => {
    test.info().annotations.push({ type: 'P16', description: 'Passa no SQLite (E2E). No PostgreSQL (Docker) falha: a categoria excluída continua no banco (ativo=0) e o índice único (nome, pai) recusa o mesmo nome com erro 500.' })
    const estoque = new TelaEstoque(page)
    await test.step('Dado que criei e excluí a categoria "Teste"', async () => {
      await estoque.criarCategoria('Teste')
      await expect(estoque.categoria('Teste')).toBeVisible()
      await estoque.categoria('Teste').getByRole('button', { name: 'Remover' }).click()
      await estoque.categoria('Teste').getByRole('button', { name: 'Confirmar' }).click()
      await expect(estoque.categoria('Teste')).toHaveCount(0)
    })
    await test.step('Quando crio "Teste" de novo', () => estoque.criarCategoria('Teste'))
    await test.step('Então ela deve ser criada e aparecer na lista', async () => {
      await expect(page.getByText('Categoria criada!').last()).toBeVisible({ timeout: 3000 })
      await expect(estoque.categoria('Teste')).toBeVisible({ timeout: 3000 })
    })
  })
})

/** cenarios_testes.md — 9. Estoque · Funcionalidade: Cadastro de produto */
test.describe('Cadastro de produto @estoque @produto', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  test('Cadastrar produto salva preço de custo e de venda', async ({ page }) => {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await test.step('Quando cadastro "Sonho" em "Pães", unidade "un", custo R$ 2,00 e venda R$ 6,00', async () => {
      await estoque.preencherProduto({ nome: 'Sonho', categoria: 'Pães', unidade: 'un', custo: 2, venda: 6, estoque: '20' })
      await estoque.salvarProduto()
    })
    await test.step('Então o produto deve aparecer na lista com custo R$ 2,00, venda R$ 6,00 e margem 200,0%', async () => {
      const linha = estoque.linha('Sonho')
      await expect(linha).toContainText('Pães')
      await expect(linha).toContainText(reBrl(2))
      await expect(linha).toContainText(reBrl(6))
      await expect(linha).toContainText('200.0%')
    })
    await test.step('E no banco o produto é gravado com os preços, a unidade, a categoria e o estoque', () =>
      expect(consultarBanco(
        `select p.preco_custo, p.preco_venda, p.unidade_medida, p.estoque_atual, p.ativo, c.nome as categoria
           from produtos p join categorias c on c.id = p.categoria_id where p.nome = 'Sonho'`))
        .toEqual([{ preco_custo: 2, preco_venda: 6, unidade_medida: 'un', estoque_atual: 20, ativo: 1, categoria: 'Pães' }]))
  })

  test('Margem estimada aparece no formulário ao digitar os preços', async ({ page }) => {
    test.fail(true, 'P15 — a "Margem estimada" lê form.preco_venda/preco_custo, mas os campos de preço gravam em precoVenda/precoCusto: no cadastro nunca aparece; na edição não acompanha a digitação')
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await test.step('Quando preencho custo R$ 2,00 e venda R$ 6,00 num produto novo', () =>
      estoque.preencherProduto({ nome: 'Sonho', categoria: 'Pães', unidade: 'un', custo: 2, venda: 6 }))
    await test.step('Então a margem estimada deve ser 200,0% (markup, ver P7)', () =>
      expect(page.getByTestId('produto-margem')).toHaveText('200.0%', { timeout: 3000 }))
  })

  test('Editar preço de venda vale para as próximas vendas', async ({ page, pdv }) => {
    const estoque = new TelaEstoque(page)
    await test.step('Dado que vendi 1 "Café Expresso" a R$ 5,00', async () => {
      await pdv.abrirCaixa(100)
      await pdv.adicionar('Café Expresso')
      await pdv.pagar('PIX')
    })
    await test.step('Quando altero o preço de venda do "Café Expresso" para R$ 7,00', async () => {
      await estoque.abrir()
      await estoque.editar('Café Expresso')
      await digitarValor(page.getByTestId('produto-preco-venda'), 7)
      await estoque.salvarProduto()
    })
    await test.step('E vendo mais 1 "Café Expresso"', async () => {
      await pdv.abrir()
      await pdv.adicionar('Café Expresso')
      await expect(pdv.total).toHaveText(reBrl(7))
      await pdv.pagar('PIX')
    })
    await test.step('Então a primeira venda continua R$ 5,00 e a segunda R$ 7,00 (total R$ 12,00)', async () => {
      const dash = new Dashboard(page)
      const dados = await dash.abrir('Hoje')
      await expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(12))
      expect(dados.kpis.quantidade_vendas).toBe(2)
    })
  })

  test('Produto vendido por kg abre o modal de peso no PDV', async ({ page, pdv }) => {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await test.step('Quando cadastro "Pão de Queijo" com unidade "kg" e venda R$ 40,00', async () => {
      await estoque.preencherProduto({ nome: 'Pão de Queijo', categoria: 'Pães', unidade: 'kg', custo: 15, venda: 40, estoque: '5' })
      await estoque.salvarProduto()
    })
    await test.step('Então no PDV, ao selecioná-lo, deve abrir o modal de peso', async () => {
      await pdv.abrirCaixa(100)
      await pdv.adicionarPeso('Pão de Queijo', '250')
      await expect(pdv.totalItem('Pão de Queijo')).toHaveText(reBrl(10))
    })
  })

  test('Produto removido não aparece para venda', async ({ page, pdv }) => {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await test.step('Dado que removo o produto "Fatia de Bolo"', async () => {
      await estoque.linha('Fatia de Bolo').getByTestId('acao-excluir').click()
      await page.getByRole('button', { name: 'Sim, Remover' }).click()
      await expect(page.getByText('Produto removido')).toBeVisible()
    })
    await test.step('Quando procuro "Fatia de Bolo" no PDV', async () => {
      await pdv.abrirCaixa(100)
      await pdv.busca.fill('Fatia de Bolo')
    })
    await test.step('Então o produto não deve estar disponível para venda', () =>
      expect(page.getByText('Nenhum produto encontrado')).toBeVisible())
  })
})

/** Cadastro rápido: o cliente cadastra muitos produtos por dia só no teclado. */
test.describe('Cadastro rápido pelo teclado @estoque @produto @teclado', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  test('Enter avança os campos, cadastra no último e já deixa pronto o próximo', async ({ page }) => {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await test.step('Quando abro o cadastro pelo F2, o código de barras já está focado', async () => {
      await page.keyboard.press('F2')
      await expect(page.getByPlaceholder('Leia com o scanner ou digite manualmente')).toBeFocused()
    })
    await test.step('E o estoque inicial já vem 9999999 e o custo R$ 0,01', async () => {
      await expect(page.getByTestId('produto-estoque')).toHaveValue('9999999')
      await expect(page.getByTestId('produto-preco-custo')).toHaveValue(reBrl(0.01))
    })
    await test.step('E preencho tudo só com o teclado, passando de campo com Enter', async () => {
      await page.keyboard.type('7890000000017')
      await page.keyboard.press('Enter')
      await expect(page.getByPlaceholder('Ex: Arroz 5kg')).toBeFocused()
      await page.keyboard.type('Biscoito')
      await page.keyboard.press('Enter')                       // → fabricante
      await page.keyboard.press('Enter')                       // → categoria
      await expect(page.getByTestId('produto-categoria')).toBeFocused()
      await page.getByTestId('produto-categoria').selectOption({ label: 'Pães' })
      await page.keyboard.press('Enter')                       // → preço de venda
      await expect(page.getByTestId('produto-preco-venda')).toBeFocused()
      for (const d of '450') await page.keyboard.press(d)
      await page.keyboard.press('ArrowRight')                  // → preço de custo (ao lado)
      await expect(page.getByTestId('produto-preco-custo')).toBeFocused()
      for (const d of '150') await page.keyboard.press(d)
      await page.keyboard.press('ArrowDown')                   // → unidade
      await page.keyboard.press('Enter')                       // → estoque inicial
      await page.keyboard.type('30')
      await page.keyboard.press('Enter')                       // → estoque mínimo
      await page.keyboard.press('Enter')                       // último campo: cadastra
      await expect(page.getByText('Produto cadastrado!')).toBeVisible()
    })
    await test.step('Então o formulário continua aberto, limpo, com a categoria mantida e o código focado', async () => {
      await expect(page.getByTestId('cadastro-contador')).toContainText('1 cadastrado agora · último: Biscoito')
      await expect(page.getByPlaceholder('Leia com o scanner ou digite manualmente')).toBeFocused()
      await expect(page.getByPlaceholder('Ex: Arroz 5kg')).toHaveValue('')
      await expect(page.getByTestId('produto-categoria').locator('option:checked')).toHaveText('Pães')
    })
    await test.step('E no banco o produto foi gravado certo', () =>
      expect(consultarBanco(
        `select p.codigo_barras, p.preco_custo, p.preco_venda, p.estoque_atual, c.nome as categoria
           from produtos p join categorias c on c.id = p.categoria_id where p.nome = 'Biscoito'`))
        .toEqual([{ codigo_barras: '7890000000017', preco_custo: 1.5, preco_venda: 4.5, estoque_atual: 30, categoria: 'Pães' }]))
    await test.step('E o próximo produto sai com Ctrl+Enter de qualquer campo', async () => {
      await page.keyboard.press('Enter')
      await page.keyboard.type('Rosquinha')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      for (const d of '300') await page.keyboard.press(d)
      await page.keyboard.press('Control+Enter')
      await expect(page.getByTestId('cadastro-contador')).toContainText('2 cadastrados agora · último: Rosquinha')
      await expect(estoque.linha('Rosquinha')).toContainText('Pães')
    })
    await test.step('E sem mexer, o estoque inicial vai 9.999.999 e o custo R$ 0,01', () =>
      expect(consultarBanco(`select preco_custo, preco_venda, estoque_atual from produtos where nome = 'Rosquinha'`))
        .toEqual([{ preco_custo: 0.01, preco_venda: 3, estoque_atual: 9999999 }]))
    await test.step('E Esc fecha o cadastro', async () => {
      await page.keyboard.press('Escape')
      await expect(page.getByPlaceholder('Ex: Arroz 5kg')).toBeHidden()
    })
  })

  test('Campo obrigatório vazio: avisa e volta o cursor para ele', async ({ page }) => {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await page.keyboard.press('F2')
    await expect(page.getByPlaceholder('Leia com o scanner ou digite manualmente')).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByText('Nome é obrigatório')).toBeVisible()
    await expect(page.getByPlaceholder('Ex: Arroz 5kg')).toBeFocused()
  })
})

/** cenarios_testes.md — 9. Estoque · Funcionalidade: Movimentação de estoque */
test.describe('Movimentação de estoque @estoque @movimentacao', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  // Esquema do Cenário: Ajustes manuais
  const exemplos = [
    { tipo: 'entrada', qtd: '20', saldo: '120' },
    { tipo: 'saida', qtd: '10', saldo: '90' },
    { tipo: 'perda', qtd: '5', saldo: '95' },
    { tipo: 'ajuste', qtd: '80', saldo: '80' },
  ] as const
  for (const ex of exemplos) {
    test(`Ajuste manual — ${ex.tipo} de ${ex.qtd}`, async ({ page }) => {
      const estoque = new TelaEstoque(page)
      await estoque.abrir()
      await test.step('Dado que o "Café Expresso" tem 100 un em estoque', () => expect(estoque.linha('Café Expresso')).toContainText('100 un'))
      await test.step(`Quando registro uma movimentação "${ex.tipo}" de ${ex.qtd}`, () => estoque.ajustar('Café Expresso', ex.tipo, ex.qtd))
      await test.step(`Então o estoque deve ser ${ex.saldo}`, () => expect(estoque.linha('Café Expresso')).toContainText(`${ex.saldo} un`))
      await test.step(`E no banco: estoque ${ex.saldo} e movimentação "${ex.tipo}" de 100 para ${ex.saldo}`, () => {
        const { estoque: saldo, movimentacoes } = estoqueGravado('Café Expresso')
        expect(saldo).toBe(Number(ex.saldo))
        expect(movimentacoes).toEqual([{ tipo: ex.tipo, quantidade: Math.abs(Number(ex.saldo) - 100), saldo_antes: 100, saldo_depois: Number(ex.saldo), referencia_id: null }])
      })
    })
  }

  async function definirMinimo(page: import('@playwright/test').Page, minimo: string) {
    const estoque = new TelaEstoque(page)
    await estoque.abrir()
    await estoque.editar('Café Expresso')
    await page.getByTestId('produto-estoque-minimo').fill(minimo)
    await estoque.salvarProduto()
    return estoque
  }

  test('Alerta de estoque baixo', async ({ page }) => {
    let estoque: TelaEstoque
    await test.step('Dado que o "Café Expresso" tem estoque mínimo 10', async () => { estoque = await definirMinimo(page, '10') })
    await test.step('Quando o estoque cai para 8', () => estoque.ajustar('Café Expresso', 'ajuste', '8'))
    await test.step('Então o produto deve aparecer em "Alertas de estoque" (não urgente)', async () => {
      await new Dashboard(page).abrir('Hoje')
      const alerta = page.getByTestId('alerta-estoque').filter({ hasText: 'Café Expresso' })
      await expect(alerta).toBeVisible()
      await expect(alerta).toHaveAttribute('data-urgente', 'nao')
    })
  })

  test('Alerta urgente abaixo de 30% do mínimo', async ({ page }) => {
    let estoque: TelaEstoque
    await test.step('Dado que o "Café Expresso" tem estoque mínimo 10', async () => { estoque = await definirMinimo(page, '10') })
    await test.step('Quando o estoque cai para 3', () => estoque.ajustar('Café Expresso', 'ajuste', '3'))
    await test.step('Então o alerta deve estar marcado como urgente', async () => {
      await new Dashboard(page).abrir('Hoje')
      await expect(page.getByTestId('alerta-estoque').filter({ hasText: 'Café Expresso' })).toHaveAttribute('data-urgente', 'sim')
    })
  })
})
