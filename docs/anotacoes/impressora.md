Como funciona a comunicação entre aplicação e impressora termica?


Protocolo utilizado: ESC/POS -> Mais utilizado.
Conexão: USB / BLUETOOTH / REDE (TCP/IP)
  -> No nosso sistema hoje: só USB e REDE (Bluetooth/Serial ainda não implementado).
Construção: Usa comandos por bites.

fluxo 

PDV finaliza venda
      ↓
Monta string com os dados (itens, totais, troco)
      ↓
Injeta comandos ESC/POS na string
      ↓
Envia os bytes para a impressora (USB / Serial / Rede)
      ↓
Impressora interpreta e imprime
      ↓
Comando de corte do papel


---

# Tutorial: instalar e conectar a impressora térmica

## Antes de começar: onde fica o backend?

Quem imprime é o **backend**, não o navegador. A impressora precisa estar ao
alcance do computador onde o backend roda.

| Cenário | Funciona? |
|---|---|
| Instalação local no Windows (`INSTALAR_SISTEMA.bat`, em `C:\Padaria`) | Sim, por USB ou rede |
| Servidor na nuvem (Docker + nginx) | Não. O servidor não enxerga USB nem IP da rede da loja |

Este tutorial vale para a **instalação local no Windows**.

## Impressoras suportadas

Qualquer impressora térmica **ESC/POS** ligada por **USB** ou **rede (TCP, porta 9100)**:
Epson TM-T20/T88, Elgin i7/i9, Knup, Tanca, Daruma, Bematech MP-4200 (no modo
ESC/POS) e genéricas.

Não funcionam:
- Impressoras serial/COM ou Bluetooth (o sistema ainda não tem esse modo).
- Impressoras usadas só pelo driver/spooler do Windows.
- Impressoras sem ESC/POS (ex.: etiqueta ZPL).

Largura do papel: **80mm** (42 colunas, padrão) ou **58mm** (32 colunas). O
comprimento é variável: a bobina é contínua e o cupom cresce conforme os itens.

## Passo 1 — Instalação física

1. Coloque a bobina, ligue a impressora e conecte o cabo (USB ou rede).
2. Faça o **autoteste**: com a impressora desligada, segure o botão FEED e ligue.
   Ela imprime uma página com o modelo, a largura do papel e, se for de rede, o IP.
   Guarde essa folha.

## Passo 2A — Impressora USB

1. **Descobrir VID e PID**: Gerenciador de Dispositivos → botão direito na
   impressora → Propriedades → Detalhes → *IDs de hardware*.
   Exemplo: `USB\VID_0416&PID_5011` → VID `0x0416`, PID `0x5011`.
2. **Trocar o driver para WinUSB** com o [Zadig](https://zadig.akeo.ie):
   *Options → List All Devices* → selecionar a impressora → **WinUSB** →
   *Replace Driver*.
   - Depois disso a impressora some do Windows como impressora comum. É esperado:
     o sistema fala direto com o USB.
3. **Instalar a libusb** (sem ela o log mostra `No backend available`):
   ```
   C:\Padaria\backend\venv\Scripts\pip install libusb-package
   ```
   Se ainda não reconhecer: baixar a `libusb-1.0.dll` (64 bits) em libusb.info
   e copiar para `C:\Windows\System32`.

## Passo 2B — Impressora de rede (recomendado, dá menos problema)

1. Pegue o IP no autoteste.
2. Deixe o **IP fixo** (no painel web da impressora ou com reserva de DHCP no
   roteador). Se o IP mudar, para de imprimir.
3. Teste a porta no PowerShell:
   ```
   Test-NetConnection 192.168.1.100 -Port 9100
   ```
   Tem que aparecer `TcpTestSucceeded : True`.

## Passo 3 — Configurar o `.env`

Arquivo: `C:\Padaria\backend\.env`. O instalador cria com `PRINTER_TYPE=file`
(**não imprime**, só salva o cupom em arquivo). Trocar para:

USB:
```env
PRINTER_TYPE=usb
PRINTER_VENDOR_ID=0x0416
PRINTER_PRODUCT_ID=0x5011
PRINTER_PAPER_WIDTH=80
```

Rede:
```env
PRINTER_TYPE=network
PRINTER_NETWORK_IP=192.168.1.100
PRINTER_NETWORK_PORT=9100
PRINTER_PAPER_WIDTH=80
```

`PRINTER_PAPER_WIDTH`: `80` para bobina de 80mm, `58` para bobina de 58mm.

Dados que saem no cabeçalho e rodapé do cupom:
```env
PADARIA_NOME=Minha Padaria
PADARIA_CNPJ=00.000.000/0001-00
PADARIA_ENDERECO=Rua Exemplo, 123
PADARIA_CIDADE=Cidade - UF
PADARIA_TELEFONE=(00) 0000-0000
PADARIA_MENSAGEM_RODAPE=Obrigado pela preferencia!
```

## Passo 4 — Reiniciar e testar

1. Fechar e abrir o sistema de novo (o `.env` só é lido quando o backend inicia).
2. Fazer uma venda de teste no PDV. O cupom deve sair com corte parcial no final.
3. Se não imprimir, olhar o log do backend. A venda é gravada mesmo se a
   impressão falhar; o único sinal é a linha `[ESCPOS] Erro ao imprimir via ...`.

Testar sem impressora: `PRINTER_TYPE=file` salva o cupom em
`%TEMP%\ultimo_recibo.bin`; para ver o conteúdo, rodar `python backend/view_recibo.py`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `No backend available` | Falta a libusb (passo 2A.3) |
| `Device not found` | VID/PID errado ou driver não trocado para WinUSB |
| `Access denied` / `Entity not found` | Outro programa usando a impressora; reiniciar o PC |
| Timeout na rede | IP mudou ou impressora em outra rede/VLAN |
| Acentos trocados (`Ã£`) | Impressora não está em CP850; ajustar a code page no utilitário do fabricante |
| Colunas desalinhadas ou cortadas | `PRINTER_PAPER_WIDTH` diferente do papel real |
| Imprime mas não corta | Impressora sem guilhotina (comum nas de 58mm mais baratas) |

## Onde fica no código

- Geração do cupom e envio: `backend/app/services/escpos_service.py`
- Chamada após a venda: `backend/app/routers/vendas.py` (`_imprimir_recibo`)
- Reimpressão (devolve os bytes ESC/POS): `GET /vendas/{id}/recibo`
- Configurações: `backend/app/config.py` e `backend/.env`
