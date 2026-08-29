"""
Cliente REST do Bitrix24 — camada de acesso usada por discover_fields.py e extract_bitrix.py.

Autenticação: webhook de entrada, lido da env var BITRIX_WEBHOOK_URL.
Formato esperado: https://SEUPORTAL.bitrix24.com.br/rest/<USER_ID>/<TOKEN>/

⚠️ A URL do webhook é uma credencial de leitura de TODO o CRM. O repositório é
público — ela nunca pode ser commitada. Em produção vem de GitHub Secret; em
desenvolvimento, de um .env.local não versionado.

Paginação: usa o padrão rápido do Bitrix (start=-1 + filtro '>ID' + order ID ASC),
que evita o COUNT(*) a cada página. Muito mais barato que start=0,50,100...
em bases com dezenas de milhares de registros.
"""

import os
import time
import json
import urllib.request
import urllib.error


class BitrixError(RuntimeError):
    """Erro devolvido pela própria API do Bitrix (campo 'error' na resposta)."""


class BitrixClient:
    # O Bitrix limita a ~2 req/s por portal. Mantemos folga.
    MIN_INTERVAL = 0.55
    MAX_RETRIES = 5
    PAGE_SIZE = 50  # fixo na API, não é configurável

    def __init__(self, webhook_url: str | None = None, verbose: bool = True):
        url = webhook_url or os.environ.get("BITRIX_WEBHOOK_URL", "")
        url = url.strip()
        if not url:
            raise SystemExit(
                "BITRIX_WEBHOOK_URL não definida.\n"
                "  Local:  export BITRIX_WEBHOOK_URL='https://SEUPORTAL.bitrix24.com.br/rest/1/TOKEN/'\n"
                "  CI:     cadastrar como GitHub Secret (Settings > Secrets and variables > Actions)"
            )
        self.base = url if url.endswith("/") else url + "/"
        self.verbose = verbose
        self._last_call = 0.0
        self.call_count = 0

    # ── infraestrutura ────────────────────────────────────────────────────

    def _throttle(self):
        delta = time.monotonic() - self._last_call
        if delta < self.MIN_INTERVAL:
            time.sleep(self.MIN_INTERVAL - delta)
        self._last_call = time.monotonic()

    def _redact(self, msg: str) -> str:
        """Nunca deixar o token vazar em log — o CI é público."""
        return msg.replace(self.base, "<BITRIX_WEBHOOK_URL>")

    def call(self, method: str, params: dict | None = None) -> dict:
        """Chamada única. Faz retry com backoff em erro de rede, 5xx e rate limit."""
        payload = json.dumps(params or {}).encode("utf-8")
        url = self.base + method

        last_err = None
        for attempt in range(self.MAX_RETRIES):
            self._throttle()
            req = urllib.request.Request(
                url, data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=90) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                self.call_count += 1
                if "error" in data:
                    desc = data.get("error_description", data["error"])
                    # QUERY_LIMIT_EXCEEDED é transitório: espera e tenta de novo.
                    if "QUERY_LIMIT" in str(data["error"]).upper():
                        time.sleep(2 ** attempt)
                        last_err = BitrixError(desc)
                        continue
                    raise BitrixError(f"{method}: {desc}")
                return data
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(2 ** attempt)
                    continue
                raise BitrixError(self._redact(f"{method}: HTTP {e.code}")) from None
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                last_err = e
                time.sleep(2 ** attempt)

        raise BitrixError(self._redact(f"{method}: falhou após {self.MAX_RETRIES} tentativas ({last_err})"))

    # ── leitura em massa ──────────────────────────────────────────────────

    def list_all(self, method: str, params: dict | None = None,
                 label: str = "", por_id: bool = True) -> list:
        """
        Percorre todas as páginas de um método *.list.

        por_id=True usa a paginação rápida do Bitrix (start=-1 + filtro '>ID'):
        o portal pula o COUNT(*) e a leitura fica muito mais barata em bases
        grandes. Só vale para métodos que aceitam filtro por ID — crm.deal.list
        e crm.company.list. Para os demais (user.get, crm.deal.userfield.list),
        use por_id=False: eles ignoram o filtro '>ID' e, se insistirmos,
        devolvem sempre a mesma primeira página — laço infinito.
        """
        if not por_id:
            return self._list_all_offset(method, dict(params or {}, start=0), label)

        params = dict(params or {})
        base_filter = dict(params.get("filter") or {})
        params["order"] = {"ID": "ASC"}
        params["start"] = -1

        out, last_id = [], 0
        while True:
            page_params = dict(params)
            page_params["filter"] = {**base_filter, ">ID": last_id}
            data = self.call(method, page_params)
            batch = data.get("result") or []
            if not batch:
                break
            try:
                novo_last = max(int(r["ID"]) for r in batch)
            except (KeyError, TypeError, ValueError):
                # Método sem ID numérico — recomeça por offset.
                return self._list_all_offset(method, dict(params, start=0), label)

            # Cinto de segurança: se o ID não avança, o filtro '>ID' está sendo
            # ignorado e continuaríamos relendo a mesma página para sempre.
            if novo_last <= last_id:
                if self.verbose:
                    print(f"    {label or method}: filtro por ID ignorado, "
                          f"trocando para paginação por offset{' ' * 10}")
                return self._list_all_offset(method, dict(params, start=0), label)

            out.extend(batch)
            last_id = novo_last
            if self.verbose:
                print(f"    {label or method}: {len(out)} registros...", end="\r", flush=True)
            if len(batch) < self.PAGE_SIZE:
                break

        if self.verbose:
            print(f"    {label or method}: {len(out)} registros{' ' * 20}")
        return out

    def _list_all_offset(self, method: str, params: dict, label: str = "") -> list:
        params = dict(params)
        out, start, visto = [], 0, set()
        while True:
            data = self.call(method, dict(params, start=start))
            batch = data.get("result") or []
            out.extend(batch)
            nxt = data.get("next")
            if nxt is None or not batch:
                break
            # Mesmo cinto de segurança do modo por ID: se o offset não avança,
            # paramos em vez de reler a mesma página indefinidamente.
            if nxt in visto or nxt <= start:
                print(f"    AVISO: {method} não avançou a paginação em start={start}; "
                      f"parando com {len(out)} registros.")
                break
            visto.add(nxt)
            start = nxt
        if self.verbose:
            print(f"    {label or method}: {len(out)} registros (offset)")
        return out

    # ── atalhos de domínio ────────────────────────────────────────────────

    def deals(self, category_id: int, label: str = "") -> list:
        """Todos os negócios de um funil, com TODOS os campos (inclusive UF_*)."""
        return self.list_all(
            "crm.deal.list",
            {"select": ["*", "UF_*"], "filter": {"CATEGORY_ID": category_id}},
            label=label or f"funil {category_id}",
        )

    def users(self) -> dict:
        """{user_id: 'Nome Sobrenome'} — inclui usuários inativos (deals antigos)."""
        rows = self.list_all(
            "user.get", {"ADMIN_MODE": "Y"}, label="usuários", por_id=False
        )
        out = {}
        for u in rows:
            nome = " ".join(
                p for p in [u.get("NAME") or "", u.get("LAST_NAME") or ""] if p.strip()
            ).strip()
            out[str(u["ID"])] = nome or (u.get("EMAIL") or f"ID {u['ID']}")
        return out

    def stages(self, category_id: int) -> dict:
        """{STAGE_ID: nome de exibição} de um funil."""
        data = self.call("crm.dealcategory.stage.list", {"id": category_id})
        return {s["STATUS_ID"]: s["NAME"] for s in (data.get("result") or [])}

    def sources(self) -> dict:
        """{SOURCE_ID: nome} — o campo 'Fonte' das planilhas."""
        data = self.call("crm.status.list", {"filter": {"ENTITY_ID": "SOURCE"}})
        return {s["STATUS_ID"]: s["NAME"] for s in (data.get("result") or [])}

    def companies(self) -> dict:
        """{company_id: título} — usado no VLOOKUP Empresa -> Fonte."""
        rows = self.list_all(
            "crm.company.list", {"select": ["ID", "TITLE"]}, label="empresas"
        )
        return {str(c["ID"]): (c.get("TITLE") or "").strip() for c in rows}

    def deal_fields(self) -> dict:
        """Metadados de todos os campos de negócio, inclusive os customizados."""
        return self.call("crm.deal.fields").get("result") or {}

    def userfield_enum(self) -> dict:
        """
        {UF_CRM_XXX: {enum_id: valor legível}} para campos do tipo lista.

        Sem isso, campos como '[SDR] Motivo de perda' voltam como IDs numéricos
        em vez do texto que as planilhas mostram — e todo agrupamento por motivo
        sai errado sem gerar erro nenhum.
        """
        rows = self.list_all(
            "crm.deal.userfield.list", {"order": {"ID": "ASC"}},
            label="campos custom", por_id=False
        )
        out = {}
        for f in rows:
            if f.get("USER_TYPE_ID") == "enumeration" and f.get("LIST"):
                out[f["FIELD_NAME"]] = {
                    str(item["ID"]): item["VALUE"] for item in f["LIST"]
                }
        return out
