"""Gera a chave de acesso mensal de um cliente (uso exclusivo do dono do sistema).

    python gerar_chave_acesso.py "Padaria do João"
    python gerar_chave_acesso.py "Padaria do João" --dias 35

A chave sai na tela: é só copiar e mandar para o cliente, que cola em
Configurações → Chave de acesso (ou na tela de bloqueio).

Precisa da chave PRIVADA em ~/.gironegocios/chave_privada_licenca.pem (ou no
caminho de GIRONEGOCIOS_CHAVE_PRIVADA). Ela NUNCA vai para o repositório nem
para o computador do cliente — quem tem esse arquivo consegue gerar chaves.
Guarde uma cópia de segurança: sem ele não dá para gerar chave nova, e trocar
o par exige atualizar o sistema em todos os clientes.

Para criar um par novo (só se perder/vazar o atual):
    python gerar_chave_acesso.py --novo-par
e atualize CHAVE_PUBLICA_B64 em app/services/licenca_service.py.
"""

import argparse
import base64
import os
import sys
from datetime import timedelta
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

os.environ.setdefault("JWT_SECRET_KEY", "nao-usado-pelo-gerador-de-chave-de-acesso")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.licenca_service import (  # noqa: E402
    CHAVE_PUBLICA_B64,
    DIAS_AVISO,
    DIAS_VALIDADE_PADRAO,
    gerar_chave,
    ler_chave,
)
from app.utils.tempo import hoje_local  # noqa: E402

CAMINHO_PADRAO = Path.home() / ".gironegocios" / "chave_privada_licenca.pem"


def _caminho() -> Path:
    return Path(os.environ.get("GIRONEGOCIOS_CHAVE_PRIVADA") or CAMINHO_PADRAO)


def novo_par() -> None:
    caminho = _caminho()
    if caminho.exists():
        sys.exit(f"Já existe uma chave privada em {caminho}. Mova-a antes de criar outra.")
    caminho.parent.mkdir(parents=True, exist_ok=True)
    privada = Ed25519PrivateKey.generate()
    caminho.write_bytes(privada.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption(),
    ))
    caminho.chmod(0o600)
    publica = privada.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    print(f"Chave privada salva em {caminho}")
    print(f'Coloque em app/services/licenca_service.py:\nCHAVE_PUBLICA_B64 = "{base64.b64encode(publica).decode()}"')


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera a chave de acesso de um cliente.")
    parser.add_argument("cliente", nargs="?", help="Nome do cliente (aparece no sistema dele)")
    parser.add_argument("--dias", type=int, default=DIAS_VALIDADE_PADRAO,
                        help=f"Dias de validade a partir de hoje (padrão {DIAS_VALIDADE_PADRAO})")
    parser.add_argument("--novo-par", action="store_true", help="Cria um par de chaves novo")
    args = parser.parse_args()

    if args.novo_par:
        return novo_par()
    if not args.cliente:
        parser.error("informe o nome do cliente")
    if args.dias < 1:
        parser.error("--dias precisa ser pelo menos 1")

    caminho = _caminho()
    if not caminho.exists():
        sys.exit(f"Chave privada não encontrada em {caminho}.")
    privada = serialization.load_pem_private_key(caminho.read_bytes(), password=None)
    publica = base64.b64encode(privada.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    if publica != CHAVE_PUBLICA_B64:
        sys.exit("Esta chave privada não corresponde à chave pública do sistema — "
                 "as chaves geradas seriam recusadas.")

    hoje = hoje_local()
    expira = hoje + timedelta(days=args.dias)
    chave = gerar_chave(privada, args.cliente.strip(), hoje, expira)
    ler_chave(chave)  # confere antes de entregar

    aviso = expira - timedelta(days=DIAS_AVISO)
    print(f"\nCliente:      {args.cliente.strip()}")
    print(f"Válida até:   {expira:%d/%m/%Y}  ({args.dias} dias)")
    print(f"Aviso a partir de {aviso:%d/%m/%Y}\n")
    print("Chave de acesso (copie a linha inteira):\n")
    print(chave)
    print()


if __name__ == "__main__":
    main()
