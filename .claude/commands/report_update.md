# /report_update

Atualiza o dashboard do Grupo TLJ com os novos arquivos Excel em `Reports/`.

## Passos

1. **Verificar arquivos Excel** em `Reports/` — confirmar que os 4 arquivos fundamentais estão presentes e com data de modificação recente:
   - `BASE SDR - MODIFICADO*.xlsx`
   - `BASE CLOSER - MODIFICADO*.xlsx`
   - `BASE RENTABILIZAÇÂO COMPLETA*.xlsx`
   - `INVESTIMENTOS.xlsx`

2. **Rodar o script de extração:**
   ```
   python scripts/extract.py
   ```

3. **Validar os números do mês mais recente** no output do script:
   - Total de leads
   - Qtd de ganhos e receita de novas vendas
   - PP total e valor
   - Investimento total
   - ROI

4. **Inspecionar o data.js gerado** — confirmar que o mês novo aparece em `src/data/data.js` e que os valores batem com o output do script.

5. **Subir o servidor de desenvolvimento** com `npm run dev` e verificar visualmente as 7 abas do dashboard, prestando atenção em:
   - Tab 0 (Resumo Executivo): KPIs do mês novo
   - Tab 1 (Receita): gráfico de barras com o novo mês
   - Tab 6 (Investimentos): ROI e CPL atualizados

6. **Reportar ao usuário** um resumo dos números-chave do mês atualizado e qualquer anomalia encontrada.
