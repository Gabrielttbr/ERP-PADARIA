"""Coloca a chave de acesso DESTE banco num estado de teste (uso do dono/dev).

    python simular_chave_acesso.py vencida            # bloqueado (venceu ontem)
    python simular_chave_acesso.py aviso              # faixa amarela (vence em 3 dias)
    python simular_chave_acesso.py aviso --dias 1     # vence amanhã
    python simular_chave_acesso.py sem-chave          # nunca teve chave, 5 dias de aviso
    python simular_chave_acesso.py sem-chave-vencida  # nunca teve chave, prazo acabou
    python simular_chave_acesso.py valida             # volta ao normal (35 dias)
    python simular_chave_acesso.py ver                # só mostra a situação atual

Usa o banco do .env da pasta atual (rode de dentro de backend/). Grava direto
no banco, sem passar pela tela — é o único jeito de pôr uma chave já vencida.
Precisa da chave privada (mesma do gerar_chave_acesso.py).

Depois de rodar, dê F5 no navegador. O bloqueio da API pode levar até 1 minuto
para valer (cache); a tela já reflete na hora.
"""

import argparse
import asyncio
from datetime import timedelta

from cryptography.hazmat.primitives import serialization

from app.database import AsyncSessionLocal, engine
from app.migrations import garantir_tabelas_novas
from app.models.licenca import Licenca
from app.services import licenca_service as ls
from app.utils.tempo import agora
from gerar_chave_acesso import _caminho


def _assinar(cliente: str, dias_para_vencer: int) -> str:
    privada = serialization.load_pem_private_key(_caminho().read_bytes(), password=None)
    hoje = agora().date()
    return ls.gerar_chave(privada, cliente, hoje - timedelta(days=30), hoje + timedelta(days=dias_para_vencer))


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("estado", choices=["vencida", "aviso", "sem-chave", "sem-chave-vencida", "valida", "ver"])
    parser.add_argument("--dias", type=int, default=3, help="Para 'aviso': dias até vencer (0 a 5)")
    parser.add_argument("--cliente", default="Cliente de Teste")
    args = parser.parse_args()

    engine.echo = False  # APP_DEBUG=true no .env de dev enche a tela de SQL
    await garantir_tabelas_novas(engine)
    async with AsyncSessionLocal() as db:
        registro = await db.get(Licenca, 1)
        if registro is None:
            registro = Licenca(id=1)
            db.add(registro)

        if args.estado != "ver":
            agora_ = agora()
            registro.ultimo_visto = agora_  # zera o "relógio" guardado
            registro.instalada_em = agora_
            registro.ativada_em = agora_
            if args.estado == "vencida":
                registro.chave = _assinar(args.cliente, -1)
            elif args.estado == "aviso":
                registro.chave = _assinar(args.cliente, args.dias)
            elif args.estado == "valida":
                registro.chave = _assinar(args.cliente, ls.DIAS_VALIDADE_PADRAO)
            else:
                registro.chave = None
                registro.ativada_em = None
                if args.estado == "sem-chave-vencida":
                    registro.instalada_em = agora_ - timedelta(days=ls.DIAS_SEM_CHAVE + 1)
            await db.flush()

        situacao = await ls.situacao_atual(db)
        await db.commit()

    print(f"Situação: {situacao.situacao.upper()}  (vence {situacao.expira_em:%d/%m/%Y}, "
          f"{situacao.dias_restantes} dia(s))")
    print(situacao.mensagem)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
