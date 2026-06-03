import pandas as pd

rent = pd.read_excel('Reports/BASE RENTABILIZAÇÂO COMPLETA - 01.06.2026.xlsx')
rent['dt'] = pd.to_datetime(rent['Data de fechamento'], errors='coerce')

print('=== FASES RENTABILIZACAO ===')
print(rent['Fase'].value_counts().to_string())

print('\n=== TIPO PRODUTO VENDIDO ===')
col = 'Tipo de produto vendido'
if col in rent.columns:
    print(rent[col].value_counts().head(10).to_string())
else:
    print('Coluna nao encontrada')

print('\n=== E RENOVACAO ===')
col2 = 'É renovação?'
if col2 in rent.columns:
    print(rent[col2].value_counts().to_string())
else:
    print('Coluna nao encontrada')

print('\n=== MAR/26 RECORDS (Data de fechamento) ===')
mar = rent[(rent['dt'].dt.year==2026) & (rent['dt'].dt.month==3)]
print(f'Records: {len(mar)}')
cols = ['Responsável', 'Fase', 'Renda']
for c in ['É renovação?', 'Tipo de produto vendido', 'Interesse Incremento']:
    if c in rent.columns:
        cols.append(c)
if len(mar) > 0:
    print(mar[cols].to_string())

print('\n=== RECEITA TOTAL GANHO FASE (todos os meses) ===')
print(rent.groupby('Fase')['Renda'].agg(['count', 'sum']).sort_values('count', ascending=False))

print('\n=== CLOSER - VALIDACAO MAR/26 ===')
closer = pd.read_excel('Reports/BASE CLOSER - MODIFICADO 2025 a 01.06.25.xlsx')
closer['dt'] = pd.to_datetime(closer['Criado'], errors='coerce')
closer['dt_fech'] = pd.to_datetime(closer['Data de fechamento'], errors='coerce')

mar_c = closer[(closer['dt_fech'].dt.year==2026) & (closer['dt_fech'].dt.month==3) & (closer['Fase']=='Perdido')]
print(f'PP Mar/26 (filtro dt_fech+Perdido): {len(mar_c)} negócios, R$ {mar_c["Renda"].sum():.2f}')

mar_criado = closer[(closer['dt'].dt.year==2026) & (closer['dt'].dt.month==3)]
ganhos = mar_criado[mar_criado['Fase']=='Ganho']
print(f'Closer criados Mar/26: {len(mar_criado)}')
print(f'Ganhos Mar/26: {len(ganhos)}, Receita: R$ {ganhos["Renda"].sum():.2f}')
print(f'Perdidos Mar/26: {(mar_criado["Fase"]=="Perdido").sum()}')

print('\n=== SDR CRIADOS MAR/26 ===')
sdr = pd.read_excel('Reports/BASE SDR - MODIFICADO 2025 a 01.06.25.xlsx')
sdr['dt'] = pd.to_datetime(sdr['Criado'], errors='coerce')
mar_s = sdr[(sdr['dt'].dt.year==2026) & (sdr['dt'].dt.month==3)]
print(f'SDR criados Mar/26: {len(mar_s)}')
print(f'Fases: {mar_s["Fase"].value_counts().to_dict()}')

print('\n=== INVESTIMENTOS ===')
inv = pd.read_excel('Reports/INVESTIMENTOS.xlsx')
print(inv.to_string())

print('\nFim!')
