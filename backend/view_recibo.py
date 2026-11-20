#!/usr/bin/env python3
"""
Script para visualizar o último recibo gerado em formato legível.
"""
import os
import sys
from pathlib import Path

def view_recibo():
    # Caminho do arquivo de recibo
    recibo_path = Path("/tmp/ultimo_recibo.bin")

    if not recibo_path.exists():
        print("❌ Nenhum recibo gerado ainda!")
        print("   Faça uma venda no PDV primeiro.")
        return

    # Lê o arquivo binário
    with open(recibo_path, "rb") as f:
        data = f.read()

    # Tenta decodificar como texto (cp850 é o padrão de impressoras térmicas)
    try:
        # Remove caracteres de controle ESC/POS
        texto = data.decode('cp850', errors='ignore')

        # Remove caracteres de controle
        for byte_val in [b'\x1b', b'\x1d', b'\x00', b'\x01']:
            if isinstance(byte_val, bytes):
                byte_char = chr(byte_val[0]) if len(byte_val) == 1 else None
                if byte_char:
                    texto = texto.replace(byte_char, '')

        print("\n" + "="*60)
        print("📄 ÚLTIMO RECIBO GERADO")
        print("="*60)
        print(texto)
        print("="*60)
        print(f"\n✅ Arquivo: {recibo_path}")
        print(f"   Tamanho: {recibo_path.stat().st_size} bytes")

    except Exception as e:
        print(f"❌ Erro ao decodificar: {e}")
        print(f"\nDados brutos (primeiros 500 bytes):")
        print(data[:500])

if __name__ == "__main__":
    view_recibo()
