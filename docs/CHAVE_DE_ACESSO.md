# Chave de acesso (mensalidade)

O sistema instalado no cliente só funciona com uma **chave de acesso** válida.
A chave é gerada por você (dono do sistema) depois que o cliente paga.

## Ciclo do cliente

| Momento                          | O que o cliente vê |
|----------------------------------|--------------------|
| Chave com mais de 5 dias         | Nada, uso normal |
| Faltam 5 dias ou menos           | Faixa amarela no topo (inclusive no PDV): *"Sua chave de acesso vence em X dias. Regularize o seu pagamento e solicite ao responsável pelo sistema uma nova chave de acesso."* |
| Chave vencida                    | Sistema bloqueado: só aparece a tela para colar a chave nova |
| Instalação/atualização sem chave | 5 dias em modo de aviso, depois bloqueia |

O cliente cola a chave nova na tela de bloqueio ou em **Configurações → Chave de acesso**
(pode colar antes de vencer). Qualquer usuário logado pode colar a chave.

## Gerar a chave (todo mês, após o pagamento)

```bash
cd backend
venv/bin/python gerar_chave_acesso.py "Nome do Cliente"            # 35 dias
venv/bin/python gerar_chave_acesso.py "Nome do Cliente" --dias 60  # outro prazo
```

Copie a linha que começa com `GN1.` e mande para o cliente (WhatsApp/e-mail).
A validade conta a partir do dia em que você gera.

## Chave privada — IMPORTANTE

- Fica em `~/.gironegocios/chave_privada_licenca.pem` (ou no caminho da variável
  `GIRONEGOCIOS_CHAVE_PRIVADA`). **Nunca** coloque no repositório nem no computador do cliente.
- **Faça backup** (pendrive/cofre de senhas). Sem ela você não consegue gerar chaves;
  criar um par novo (`--novo-par`) exige atualizar o sistema em todos os clientes.
- Quem tiver esse arquivo consegue gerar chaves para qualquer cliente.

## Limites conhecidos

- Atrasar o relógio do computador não estica a chave (o sistema guarda o maior horário já visto).
- Como o sistema roda no computador do cliente, alguém com conhecimento técnico
  pode alterar o código e remover o bloqueio. A proteção é contra o uso comum, não contra um programador.
- A chave não está presa a uma instalação: a chave de um cliente funcionaria em outro.
