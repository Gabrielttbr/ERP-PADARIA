# Simular a instalação na máquina do cliente (Windows)

Roteiro para testar o instalador do Windows (`INSTALAR_SISTEMA.bat` → `setup.ps1`)
como se fosse a primeira instalação numa padaria: Windows limpo, sem Python,
Node ou Git, e banco de dados vazio.

> **Importante:** o instalador **não usa os arquivos da sua máquina**. Ele baixa o
> código com `git clone` de `https://github.com/Gabrielttbr/ERP-PADARIA.git`
> (branch `main`). Tudo o que você quer testar precisa estar **commitado e com push
> na `main` do fork** antes de começar.

---

## 0. Pré-requisitos

| O quê                                               | Por quê                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 **Pro, Enterprise ou Education** | A Windows Sandbox não existe no Home (no Home, use uma VM: veja o [passo 7](#7-alternativa-vm-virtualbox--hyper-v)) |
| Virtualização ligada na BIOS                       | Exigida pela Sandbox                                                                                                |
| Internet                                             | O instalador baixa Python 3.12, Node 20, Git e as dependências                                                     |
| Mudanças na `main` do fork                        | `git push fork main`                                                                                              |

Antes de cada simulação, confirme que o fork está atualizado (no WSL):

```bash
cd ~/ERP-PADARIA
git status                # nada pendente
git log --oneline -1 main
git fetch fork && git log --oneline -1 fork/main   # deve ser o mesmo commit
```

---

## 1. Ativar a Windows Sandbox (uma vez só)

1. Menu Iniciar → **"Ativar ou desativar recursos do Windows"**.
2. Marque **Área Restrita do Windows** (*Windows Sandbox*) → OK.
3. Reinicie o computador.

Ou, no PowerShell **como administrador**:

```powershell
Enable-WindowsOptionalFeature -FeatureName "Containers-DisposableClientVM" -All -Online
```

A Sandbox é um Windows zerado e descartável: **ao fechar a janela, tudo o que foi
feito nela é apagado**. É o mais parecido com a máquina nova de um cliente.

---

## 2. Separar os arquivos do instalador

O cliente recebe só dois arquivos: `INSTALAR_SISTEMA.bat` e `setup.ps1`.
No WSL, copie os dois para uma pasta do Windows:

```bash
mkdir -p /mnt/c/SimulacaoPadaria
cp ~/ERP-PADARIA/INSTALAR_SISTEMA.bat ~/ERP-PADARIA/setup.ps1 /mnt/c/SimulacaoPadaria/
```

Crie também o arquivo `C:\SimulacaoPadaria\Padaria.wsb`, que abre a Sandbox já com
essa pasta na área de trabalho:

```bash
cat > /mnt/c/SimulacaoPadaria/Padaria.wsb <<'EOF'
<Configuration>
  <MemoryInMB>4096</MemoryInMB>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>C:\SimulacaoPadaria</HostFolder>
      <SandboxFolder>C:\Users\WDAGUtilityAccount\Desktop\Instalador</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
</Configuration>
EOF
```

> Não instale direto no seu Windows: ele já tem Python, Node e Git, e assim você
> não testa a parte do instalador que baixa e instala essas ferramentas.

---

## 3. Instalar (primeira instalação)

1. No Windows Explorer, dê **dois cliques em `C:\SimulacaoPadaria\Padaria.wsb`**.
   A Sandbox abre com a pasta **Instalador** na área de trabalho.
2. Abra a pasta **Instalador** → botão direito em **`INSTALAR_SISTEMA.bat`** →
   **Executar como administrador**.
3. Na tela de boas-vindas, aperte uma tecla.
4. Aguarde (de 5 a 15 minutos). Os passos aparecem na tela:

   1. Verificando/instalando **Python 3.12**
   2. Verificando/instalando **Node.js 20**
   3. Verificando/instalando **Git**
   4. Clonando o fork em **`C:\Padaria`**
   5. Criando o **`backend\.env`** (SQLite, JWT aleatório, `PADARIA_NOME=Minha Padaria`)
   6. Criando o venv e instalando as dependências Python
   7. **Criando o banco com o `init_db.py`** (admin, empresa, Caixa 01 e Diverso 999)
   8. `npm install` + `npm run build` do frontend
   9. Criando o `Iniciar_Padaria.bat` e o atalho **Padaria ERP** na área de trabalho
5. No final deve aparecer:

   ```
   Login inicial:
     Admin   : admin@padaria.com   / Admin@1234
   ```

✅ **Deu certo se:** terminou sem `[ERRO]`, existe `C:\Padaria` e o atalho
**Padaria ERP** está na área de trabalho.

---

## 4. Primeiro acesso: o que conferir

Dê dois cliques no atalho **Padaria ERP**. Uma janela preta sobe o servidor e, em
uns 12 segundos, o navegador abre em `http://localhost:8000`.

Entre com `admin@padaria.com` / `Admin@1234` e vá marcando:

### Banco limpo

- [ ] **Estoque/Produtos** mostra **só um produto**: **DIVERSO**, código **999**, categoria **Outros**.
- [ ] Não aparecem produtos, fornecedores ou clientes de exemplo (Pão Francês etc.).
- [ ] **Usuários** tem só o **Administrador**: não existem `caixa@` nem `estoque@`.
- [ ] Existe o caixa **Caixa 01**.

### Venda com o Diverso (o que foi corrigido)

- [ ] Abra o caixa (sessão) com um valor de abertura.
- [ ] No PDV, digite **`999`** e aperte **Enter**: abre o modal **Produto Diverso**.
- [ ] Informe um valor (ex.: R$ 7,00) e confirme: o item **DIVERSO** entra no carrinho.
- [ ] Finalize em dinheiro: a venda é gravada **sem erro**.
  Antes da correção, aqui dava *"Produto(s) não encontrado(s) ou inativo(s): [17]"*,
  porque numa instalação limpa o Diverso fica com id 1.
- [ ] Faça o mesmo buscando **"Diverso"** pelo nome e clicando no card.
- [ ] Uma venda com Diverso **e** um produto comum (cadastre um antes) também finaliza.

### Configuração inicial do cliente

- [ ] Troque a senha do admin.
- [ ] Em **Configurações**, preencha nome, CNPJ, endereço e rodapé do cupom da padaria.
- [ ] Cadastre um usuário **caixa** e entre com ele: deve cair direto na tela do caixa.
- [ ] Cadastre alguns produtos reais e faça vendas.

---

## 5. Reinstalar e reiniciar (os dados não podem sumir)

Faça isso **na mesma Sandbox**, sem fechar a janela.

1. Feche a janela preta do servidor.
2. Rode de novo o **`INSTALAR_SISTEMA.bat`** como administrador.
   - Deve aparecer *"Repositorio ja existe - atualizando..."* (`git pull`).
   - Deve aparecer *".env ja existe - mantendo configuracoes atuais"*.
   - No passo do banco: *"-- já existem usuários"*, *"-- produto DIVERSO já existe"*.
3. Abra o **Padaria ERP** de novo e confira:
   - [ ] Os produtos, vendas, usuários e configurações do passo 4 **continuam lá**.
   - [ ] A senha nova do admin continua valendo.
   - [ ] O Diverso continua com um só cadastro (não duplicou).

> Antes, o instalador usava o `seed_dev.py`, que **apaga o banco**: reinstalar
> perdia todos os dados do cliente.

### Diverso desativado volta sozinho

- [ ] Em Estoque, desative/exclua o **DIVERSO**.
- [ ] Feche a janela do servidor e abra o **Padaria ERP** de novo.
- [ ] O DIVERSO volta ativo, porque o backend garante o produto 999 toda vez que inicia.

---

## 6. Testar uma atualização (opcional)

Simula o cliente recebendo uma versão nova.

1. Com o sistema instalado na Sandbox (passos 3 a 5), faça e envie uma mudança no fork, no WSL:
   ```bash
   git push fork main
   ```
2. Na Sandbox, feche o servidor e rode **`C:\Padaria\ATUALIZAR_SISTEMA.bat`**.
   Ele faz backup do banco em `C:\Padaria\backups\`, `git pull`, atualiza as
   dependências e recompila o frontend.

3. [ ] O sistema abre com a mudança, e os dados continuam lá.
4. [ ] Existe um arquivo `padaria_<data>.db` em `C:\Padaria\backups\`.

---

## 7. Alternativa: VM (VirtualBox / Hyper-V)

Use uma VM se o seu Windows for Home ou se quiser testar reiniciar a máquina
(a Sandbox não sobrevive a um reboot).

1. Baixe uma imagem de avaliação do Windows 11 (developer.microsoft.com → *Windows 11 development environment*)
   ou instale um Windows 10/11 a partir da ISO.
2. **Tire um snapshot** da VM limpa, antes de instalar qualquer coisa.
3. Copie o `INSTALAR_SISTEMA.bat` e o `setup.ps1` para a VM (pasta compartilhada,
   pendrive virtual ou download do GitHub) e siga os passos 3 a 6.
4. Para simular de novo do zero, **volte ao snapshot**.

Na VM dá para testar também:

- [ ] Reiniciar o Windows e abrir o **Padaria ERP**: o sistema sobe normalmente.
- [ ] Um usuário do Windows **sem** privilégio de administrador consegue usar o atalho.

---

## 8. Problemas comuns

| Sintoma                                           | Causa provável / o que fazer                                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Execute como Administrador.`                   | Rode o `.bat` com **botão direito → Executar como administrador**.                                            |
| A Sandbox não abre / "virtualização"           | Ative a virtualização (VT-x/AMD-V) na BIOS.                                                                           |
| Erro no `git clone`                             | Sem internet na Sandbox, ou o fork virou privado (o cliente não tem login do GitHub).                                  |
| A instalação não tem a sua última mudança    | Faltou o `git push fork main`. O instalador sempre baixa do GitHub.                                                   |
| `[ERRO] Falha ao inicializar o banco de dados.` | Veja a mensagem do Python logo acima. Geralmente é dependência que não instalou no passo do venv.                    |
| O navegador não abre / página não carrega      | Espere a janela preta mostrar `Uvicorn running on http://0.0.0.0:8000` e acesse `http://localhost:8000` na mão.    |
| Porta 8000 ocupada                                | O `Iniciar_Padaria.bat` já mata o processo que estiver na porta. Se persistir, feche as outras janelas do servidor.  |
| O nome da padaria no cupom sai "Minha Padaria"    | É o padrão do `.env` criado pelo instalador. Ajuste em **Configurações** ou em `C:\Padaria\backend\.env`. |

---

## Resumo do que esta simulação valida

1. O instalador funciona num Windows sem nada instalado.
2. O banco do cliente nasce **limpo**: só admin, empresa, Caixa 01 e **DIVERSO (999)**.
3. A venda avulsa com o Diverso funciona numa instalação nova (id real, não o 17).
4. Reinstalar ou reiniciar **não apaga dados** e não duplica o Diverso.
5. A atualização (`ATUALIZAR_SISTEMA.bat`) mantém os dados e faz backup.
