import { describe, it, expect } from 'vitest'
import { mensagemErro } from './erro'

const erro = (detail: unknown) => ({ response: { data: { detail } } })

describe('mensagemErro', () => {
  it('usa o detail quando é texto', () => {
    expect(mensagemErro(erro('Estoque insuficiente'), 'x')).toBe('Estoque insuficiente')
  })

  it('transforma a lista de validação do Pydantic em texto (não quebra a tela)', () => {
    const detail = [
      { type: 'value_error', loc: ['body', 'pagamentos', 0, 'valor'], msg: 'Value error, Valor do pagamento deve ser positivo' },
      { type: 'missing', loc: ['body', 'motivo'], msg: 'Field required' },
    ]
    expect(mensagemErro(erro(detail), 'x')).toBe('Valor do pagamento deve ser positivo; Field required')
  })

  it('cai na mensagem padrão sem detail, com detail vazio ou objeto desconhecido', () => {
    expect(mensagemErro(new Error('rede'), 'Erro na venda')).toBe('Erro na venda')
    expect(mensagemErro(erro(''), 'Erro na venda')).toBe('Erro na venda')
    expect(mensagemErro(erro({ foo: 1 }), 'Erro na venda')).toBe('Erro na venda')
    expect(mensagemErro(erro([{ foo: 1 }]), 'Erro na venda')).toBe('Erro na venda')
  })
})
