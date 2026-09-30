# Registra (ou atualiza) a tarefa do Agendador do Windows que roda a atualização
# automática do dashboard todo dia às 06:00. Ver CLAUDE.md §15.
#
#   powershell -ExecutionPolicy Bypass -File scripts\registrar_agendamento.ps1
#
# - Acorda o PC se estiver dormindo (e ligado na tomada)
# - Se o PC estiver desligado às 06:00, roda assim que for ligado
# - Roda só com o usuário logado (precisa das credenciais do Git do Windows)

$ErrorActionPreference = 'Stop'
$TaskName = 'TLJ Dashboard - Atualizacao diaria'
$Root     = Split-Path -Parent $PSScriptRoot
$Python   = (Get-Command python -ErrorAction Stop).Source
$PythonW  = Join-Path (Split-Path -Parent $Python) 'pythonw.exe'
if (-not (Test-Path $PythonW)) { $PythonW = $Python }

$action   = New-ScheduledTaskAction -Execute $PythonW `
              -Argument ('"' + (Join-Path $Root 'scripts\auto_update.py') + '"') `
              -WorkingDirectory $Root
$trigger  = New-ScheduledTaskTrigger -Daily -At '06:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
              -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description 'Bitrix24 -> data.js -> build -> GitHub -> Vercel (scripts/auto_update.py)' -Force | Out-Null

$t = Get-ScheduledTask -TaskName $TaskName
Write-Output "Tarefa registrada: $($t.TaskName) | estado: $($t.State) | proxima execucao: $((Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime)"
Write-Output "Python: $PythonW"
