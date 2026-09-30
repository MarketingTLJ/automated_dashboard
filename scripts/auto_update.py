"""
Atualização automática diária do dashboard (Agendador de Tarefas do Windows, 06:00).

    Bitrix24 (webhook) + INVESTIMENTOS.xlsx → data.js → build → commit/push → Deploy Hook

Só publica se TODAS as travas passarem. Em qualquer falha: restaura o data.js,
registra em logs/auto_update.log e mostra uma notificação no Windows.
O site continua no ar com os dados da última atualização boa.

Uso:  python scripts/auto_update.py             ← execução normal (o que o agendador roda)
      python scripts/auto_update.py --dry-run   ← tudo, menos commit/push/deploy
Ver CLAUDE.md §15.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT      = Path(__file__).resolve().parent.parent
SCRIPTS   = ROOT / "scripts"
DATA_JS   = ROOT / "src" / "data" / "data.js"
USERS     = SCRIPTS / "bitrix_users.json"
LOG_DIR   = ROOT / "logs"
LOG_FILE  = LOG_DIR / "auto_update.log"
STATE     = LOG_DIR / "estado.json"       # contagens da última execução boa
LOCK      = LOG_DIR / "auto_update.lock"
NO_WINDOW = 0x08000000 if os.name == 'nt' else 0

sys.path.insert(0, str(SCRIPTS))


class Abort(RuntimeError):
    """Falha que impede a publicação."""


# ── Log / notificação ─────────────────────────────────────────────────────────
def log(msg):
    LOG_DIR.mkdir(exist_ok=True)
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(line, flush=True)
    with LOG_FILE.open('a', encoding='utf-8') as f:
        f.write(line + "\n")


def notify(title, text):
    """Notificação do Windows (toast). Silenciosa se não der — o log já tem tudo."""
    if os.name != 'nt':
        return
    esc = lambda s: s.replace("'", "''")[:250]
    ps = (
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;"
        "$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);"
        f"$x.GetElementsByTagName('text')[0].AppendChild($x.CreateTextNode('{esc(title)}')) > $null;"
        f"$x.GetElementsByTagName('text')[1].AppendChild($x.CreateTextNode('{esc(text)}')) > $null;"
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("
        "'{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe')"
        ".Show([Windows.UI.Notifications.ToastNotification]::new($x))"
    )
    try:
        subprocess.run(['powershell', '-NoProfile', '-Command', ps], timeout=30,
                       capture_output=True, creationflags=NO_WINDOW)
    except Exception:
        pass


# ── Utilitários ───────────────────────────────────────────────────────────────
def run(cmd, timeout=600, check=True):
    exe = shutil.which(cmd[0]) or cmd[0]
    r = subprocess.run([exe, *cmd[1:]], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, creationflags=NO_WINDOW)
    if check and r.returncode != 0:
        raise Abort(f"{' '.join(cmd)} falhou (código {r.returncode}):\n{(r.stdout + r.stderr)[-1500:]}")
    return r


def env_value(key):
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            if line.startswith(key + '='):
                return line.split('=', 1)[1].strip()
    return None


def load_js(text):
    out = {}
    for name in ('DATA', 'DATA_TERMINO'):
        m = re.search(rf'export const {name}\s*=\s*(\[.*?\n\]);', text, re.S)
        out[name] = json.loads(m.group(1)) if m else []
    return out


def strip_timestamp(text):
    """data.js sem as linhas de horário — para saber se os DADOS mudaram."""
    text = re.sub(r'^// Last updated:.*$', '', text, flags=re.M)
    return re.sub(r'^export const ATUALIZADO_EM = .*$', '', text, flags=re.M)


# ── Travas de segurança ───────────────────────────────────────────────────────
def check_coherence(new):
    """CLAUDE.md §8 e §12 — coerência interna de todos os meses."""
    errs = []
    for d in new['DATA']:
        ym = d['ym']
        if d['leads_total'] != d['leads_sdr'] + d['leads_closer']:
            errs.append(f"{ym}: leads_total ≠ SDR + Closer")
        if d['reunioes'] != d['leads_closer']:
            errs.append(f"{ym}: reuniões ≠ leads Closer")
        if d['leads_efetivos'] != max(d['leads_total'] - d['leads_descartados'], 0):
            errs.append(f"{ym}: leads efetivos ≠ total − descartados")
        if d['sdr_perdido'] + d['sdr_ativo'] > d['leads_sdr']:
            errs.append(f"{ym}: SDR perdido + ativo > leads SDR")
        pf = d.get('por_fonte', {})
        for tot, k in (('leads_sdr', 'leads_sdr'), ('leads_closer', 'leads_closer'),
                       ('sdr_perdido', 'sdr_perdido'), ('leads_descartados', 'descartados'),
                       ('ganho', 'ganho'), ('perdido', 'perdido')):
            if sum(v.get(k, 0) for v in pf.values()) != d[tot]:
                errs.append(f"{ym}: soma por fonte de {k} ≠ total")
    for d in new['DATA_TERMINO']:
        pf = d.get('por_fonte', {})
        for k in ('qtd_v', 'rec_v', 'qtd_i', 'rec_i'):
            if abs(sum(v.get(k, 0) for v in pf.values()) - d[k]) > 0.05:
                errs.append(f"{d['ym']} (término): soma por fonte de {k} ≠ total")
    if errs:
        raise Abort("Incoerência nos números:\n  - " + "\n  - ".join(errs[:15]))


def check_vs_previous(new, old, counts):
    """Queda brusca = provável problema de extração (ex: fase renomeada, filtro quebrado)."""
    prev = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    for k, n in counts.items():
        p = prev.get('counts', {}).get(k)
        if p and n < 0.9 * p:
            raise Abort(f"Base '{k}' caiu de {p} para {n} registros (>10%) — verificar antes de publicar")

    # Meses fechados antigos (exceto os 2 mais recentes, que ainda mudam bastante)
    old_m = {d['ym']: d for d in old['DATA']}
    old_t = {d['ym']: d for d in old['DATA_TERMINO']}
    yms = sorted(set(old_m) & {d['ym'] for d in new['DATA']})[:-2]
    if len(yms) >= 3:
        new_m = {d['ym']: d for d in new['DATA']}
        new_t = {d['ym']: d for d in new['DATA_TERMINO']}
        for label, a, b, key in (('leads', old_m, new_m, 'leads_total'),
                                 ('receita de vendas', old_t, new_t, 'rec_v')):
            so = sum(a[y].get(key, 0) for y in yms if y in a)
            sn = sum(b[y].get(key, 0) for y in yms if y in b)
            if so and sn < 0.9 * so:
                raise Abort(f"Total de {label} dos meses anteriores caiu de {so:,.0f} para {sn:,.0f} (>10%)")


# ── Fluxo ─────────────────────────────────────────────────────────────────────
def git_sync():
    branch = run(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).stdout.strip()
    if branch != 'main':
        raise Abort(f"Repositório está no branch '{branch}', não em 'main' — não publico")
    run(['git', 'fetch', 'origin', 'main'], timeout=120)
    behind = int(run(['git', 'rev-list', '--count', 'HEAD..origin/main']).stdout.strip() or 0)
    if behind:
        log(f"  main está {behind} commit(s) atrás — atualizando (pull --rebase)")
        run(['git', 'pull', '--rebase', '--autostash', 'origin', 'main'], timeout=180)
    # Commits locais ainda não enviados (ex: push falhou ontem)
    return int(run(['git', 'rev-list', '--count', 'origin/main..HEAD']).stdout.strip() or 0)


def wait_for_network(max_wait=600):
    """Ao acordar o PC às 06h o Wi-Fi demora a conectar — espera até 10 min."""
    t0 = time.time()
    while True:
        try:
            urllib.request.urlopen('https://tljmkt.bitrix24.com.br', timeout=15)
            return
        except urllib.error.HTTPError:
            return  # respondeu (mesmo com erro HTTP) → há rede
        except Exception:
            if time.time() - t0 > max_wait:
                raise Abort("Sem conexão com a internet há 10 minutos")
            time.sleep(20)


def deploy():
    url = env_value('VERCEL_DEPLOY_HOOK_URL')
    if not url:
        raise Abort("VERCEL_DEPLOY_HOOK_URL ausente em .env.local — não consigo disparar o deploy")
    req = urllib.request.Request(url, data=b'', method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        if r.status not in (200, 201):
            raise Abort(f"Deploy Hook respondeu HTTP {r.status}")


def main(dry_run=False):
    started = time.time()
    log("=" * 60)
    log(f"Atualização automática {'(DRY-RUN) ' if dry_run else ''}iniciada")

    if LOCK.exists() and time.time() - LOCK.stat().st_mtime < 2 * 3600:
        log("Outra execução em andamento (lock) — saindo")
        return 0
    LOG_DIR.mkdir(exist_ok=True)
    LOCK.write_text(str(os.getpid()))

    old_text  = DATA_JS.read_text(encoding='utf-8') if DATA_JS.exists() else ''
    old_users = USERS.read_text(encoding='utf-8') if USERS.exists() else None
    published = False
    try:
        wait_for_network()
        log("1/6 Sincronizando com o GitHub")
        ahead = git_sync()
        old_text = DATA_JS.read_text(encoding='utf-8')  # pode ter mudado no pull

        log("2/6 Extraindo dados do Bitrix24 + INVESTIMENTOS.xlsx")
        import extract
        res = extract.main('bitrix')
        for w in res['warnings']:
            log(f"  AVISO: {w}")
        log(f"  Registros: {res['counts']}")

        log("3/6 Travas de segurança")
        new_text = DATA_JS.read_text(encoding='utf-8')
        new, old = load_js(new_text), load_js(old_text)
        check_coherence(new)
        check_vs_previous(new, old, res['counts'])
        last = next((d for d in reversed(new['DATA']) if not d.get('parcial')), new['DATA'][-1])
        lt = next((d for d in new['DATA_TERMINO'] if d['ym'] == last['ym']), {})
        inv_txt = 'pendente' if last.get('inv_pendente') else f"R${lt.get('inv', 0):,.0f}"
        log(f"  OK · último mês fechado {last['label']}: leads={last['leads_total']} · "
            f"vendas={lt.get('qtd_v')} · receita=R${lt.get('rec_v', 0):,.0f} · inv={inv_txt}")

        if strip_timestamp(new_text) == strip_timestamp(old_text):
            log("Sem mudanças nos dados desde a última publicação — nada a publicar")
            DATA_JS.write_text(old_text, encoding='utf-8')
            if ahead and not dry_run:
                log(f"  Enviando {ahead} commit(s) pendente(s) de execução anterior + deploy")
                run(['git', 'push', 'origin', 'main'], timeout=180)
                deploy()
            STATE.write_text(json.dumps({'counts': res['counts'], 'ok_em': datetime.now().isoformat()}), encoding='utf-8')
            return 0

        log("4/6 Build (npm run build)")
        run(['npm', 'run', 'build'], timeout=900)

        if dry_run:
            log("DRY-RUN: pulando commit/push/deploy — restaurando data.js")
            DATA_JS.write_text(old_text, encoding='utf-8')
            if old_users is not None:
                USERS.write_text(old_users, encoding='utf-8')
            return 0

        log("5/6 Commit + push")
        paths = ['src/data/data.js']
        if old_users != (USERS.read_text(encoding='utf-8') if USERS.exists() else None):
            paths.append('scripts/bitrix_users.json')
        run(['git', 'add', '--', *paths])
        run(['git', 'commit', '-m', f"data: atualização automática {datetime.now():%d/%m/%Y %H:%M} (Bitrix24)",
             '--', *paths])
        published = True  # commit local feito — daqui em diante não restaurar o data.js
        run(['git', 'push', 'origin', 'main'], timeout=180)

        log("6/6 Disparando deploy (Vercel Deploy Hook)")
        deploy()
        STATE.write_text(json.dumps({'counts': res['counts'], 'ok_em': datetime.now().isoformat()}), encoding='utf-8')
        log(f"CONCLUÍDO em {time.time() - started:.0f}s — site atualiza em 1-3 min")
        return 0

    except Exception as e:
        detail = str(e) if isinstance(e, Abort) else f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        log(f"FALHA: {detail}")
        if not published:
            DATA_JS.write_text(old_text, encoding='utf-8')
            if old_users is not None:
                USERS.write_text(old_users, encoding='utf-8')
            log("  data.js restaurado — o site segue com a última atualização boa")
        else:
            log("  Commit local feito mas push/deploy falhou — a próxima execução reenvia")
        notify("Dashboard TLJ: atualização falhou",
               str(e).splitlines()[0] + " — ver logs/auto_update.log")
        return 1
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == '__main__':
    if sys.stdout:  # pythonw (Agendador de Tarefas) roda sem console
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help="tudo menos commit/push/deploy")
    sys.exit(main(ap.parse_args().dry_run))
