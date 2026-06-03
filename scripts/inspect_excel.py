"""
Diagnostic script — inspeciona estrutura dos arquivos Excel.
Run: python scripts/inspect_excel.py
"""
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent
REPORTS = ROOT / "Reports"

def inspect(label, path, nrows=3):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"  {path.name}")
    print(f"{'='*60}")
    try:
        df = pd.read_excel(path, nrows=nrows)
        print(f"  Colunas ({len(df.columns)}): {list(df.columns)}")
        print(f"  Shape: {df.shape}")
        print(df.to_string())
    except Exception as e:
        print(f"  ERRO: {e}")

def inspect_inv(path):
    print(f"\n{'='*60}")
    print(f"  INVESTIMENTOS")
    print(f"  {path.name}")
    print(f"{'='*60}")
    try:
        df = pd.read_excel(path)
        print(f"  Shape: {df.shape}")
        print(f"  Colunas: {list(df.columns)}")
        print(df.to_string())
    except Exception as e:
        print(f"  ERRO: {e}")

files = {
    "BASE SDR":          REPORTS / "BASE SDR - MODIFICADO 2025 a 01.06.25.xlsx",
    "BASE CLOSER":       REPORTS / "BASE CLOSER - MODIFICADO 2025 a 01.06.25.xlsx",
    "BASE RENTABILIZ.":  REPORTS / "BASE RENTABILIZAÇÂO COMPLETA - 01.06.2026.xlsx",
}

for label, path in files.items():
    if path.exists():
        # Show column names + first 2 rows
        try:
            df = pd.read_excel(path, nrows=2)
            print(f"\n{'='*60}")
            print(f"  {label}  —  {path.name}")
            print(f"{'='*60}")
            print(f"  Total rows (full read): {len(pd.read_excel(path))}")
            print(f"  Colunas ({len(df.columns)}):")
            for i, col in enumerate(df.columns):
                print(f"    [{i:03d}] {col}  =  {df[col].iloc[0] if len(df) > 0 else 'N/A'}")
        except Exception as e:
            print(f"  ERRO: {e}")
    else:
        print(f"\n  ARQUIVO NÃO ENCONTRADO: {path}")

inv_path = REPORTS / "INVESTIMENTOS.xlsx"
if inv_path.exists():
    inspect_inv(inv_path)
else:
    print(f"\n  INVESTIMENTOS.xlsx NÃO ENCONTRADO: {inv_path}")
    # Try with ~$ prefix (temp file)
    tmp = REPORTS / "~$INVESTIMENTOS.xlsx"
    if tmp.exists():
        print(f"  Encontrado como arquivo temporário: {tmp.name} — feche o Excel antes de rodar!")
    # List all files in Reports
    print(f"\n  Arquivos em {REPORTS}:")
    for f in REPORTS.iterdir():
        print(f"    {f.name}")

# Check SDR specific columns
print(f"\n{'='*60}")
print("  VERIFICAÇÃO COLUNAS CRÍTICAS — SDR")
print(f"{'='*60}")
sdr_path = REPORTS / "BASE SDR - MODIFICADO 2025 a 01.06.25.xlsx"
if sdr_path.exists():
    sdr = pd.read_excel(sdr_path)
    print(f"  Col V (idx 21) = '{sdr.columns[21] if len(sdr.columns) > 21 else 'N/A'}' — esperado: Criado1")
    print(f"  'Fase' exists: {'Fase' in sdr.columns}")
    print(f"  'Responsável' exists: {'Responsável' in sdr.columns}")
    print(f"  'Fonte' exists: {'Fonte' in sdr.columns}")
    print(f"  '[SDR] Motivo de perda' exists: {'[SDR] Motivo de perda' in sdr.columns}")
    print(f"  'Criado1' exists: {'Criado1' in sdr.columns}")
    if 'Criado1' in sdr.columns:
        print(f"  Criado1 sample: {sdr['Criado1'].dropna().iloc[0] if len(sdr['Criado1'].dropna()) > 0 else 'empty'}")
    print(f"  Fases únicas: {sorted(sdr['Fase'].dropna().unique()) if 'Fase' in sdr.columns else 'N/A'}")

print(f"\n{'='*60}")
print("  VERIFICAÇÃO COLUNAS CRÍTICAS — CLOSER")
print(f"{'='*60}")
closer_path = REPORTS / "BASE CLOSER - MODIFICADO 2025 a 01.06.25.xlsx"
if closer_path.exists():
    closer = pd.read_excel(closer_path)
    print(f"  'Criado1' exists: {'Criado1' in closer.columns}")
    print(f"  Col W (idx 22) = '{closer.columns[22] if len(closer.columns) > 22 else 'N/A'}' — esperado: Criado1")
    print(f"  Col AC (idx 28) = '{closer.columns[28] if len(closer.columns) > 28 else 'N/A'}'")
    print(f"  Col AC (idx 29) = '{closer.columns[29] if len(closer.columns) > 29 else 'N/A'}' — esperado: Data de fechamento")
    print(f"  '#TLJ# SDR' exists: {'#TLJ# SDR' in closer.columns}")
    print(f"  'Renda' exists: {'Renda' in closer.columns}")
    print(f"  'Responsável' exists: {'Responsável' in closer.columns}")
    print(f"  Fases únicas: {sorted(closer['Fase'].dropna().unique()) if 'Fase' in closer.columns else 'N/A'}")
    if 'Criado1' in closer.columns:
        print(f"  Criado1 sample: {closer['Criado1'].dropna().iloc[0] if len(closer['Criado1'].dropna()) > 0 else 'empty'}")

print(f"\n{'='*60}")
print("  VERIFICAÇÃO COLUNAS CRÍTICAS — RENTABILIZAÇÃO")
print(f"{'='*60}")
rent_path = REPORTS / "BASE RENTABILIZAÇÂO COMPLETA - 01.06.2026.xlsx"
if rent_path.exists():
    rent = pd.read_excel(rent_path)
    print(f"  Colunas: {list(rent.columns)}")
    print(f"  'Tipo' unique: {sorted(rent['Tipo'].dropna().unique()) if 'Tipo' in rent.columns else 'N/A'}")
    print(f"  'Valor' exists: {'Valor' in rent.columns}")
    print(f"  'Data Fechado' exists: {'Data Fechado' in rent.columns}")
    print(f"  'Responsável' exists: {'Responsável' in rent.columns}")
    if 'Data Fechado' in rent.columns:
        print(f"  Data Fechado sample: {rent['Data Fechado'].dropna().iloc[0] if len(rent['Data Fechado'].dropna()) > 0 else 'empty'}")
    if 'Tipo' in rent.columns:
        for tipo in rent['Tipo'].dropna().unique():
            sub = rent[rent['Tipo']==tipo]
            print(f"  Tipo='{tipo}': {len(sub)} registros, Valor total={sub['Valor'].sum() if 'Valor' in rent.columns else 'N/A'}")

print("\nInspeção concluída!")
