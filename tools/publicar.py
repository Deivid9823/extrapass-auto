"""Publica en Instagram lo que toca hoy según contenido/calendario.json.

Lo ejecuta GitHub Actions cada día. Necesita estas variables:
  IG_TOKEN   token de acceso de Instagram (secreto del repositorio)
  BASE_URL   dirección pública de la carpeta del repositorio en GitHub Pages,
             por ejemplo https://usuario.github.io/extrapass-auto
Opcional:
  FECHA      publicar lo de otro día (AAAA-MM-DD), para pruebas
  PRUEBA=1   no publica nada: solo comprueba el token y las direcciones
"""
import json, os, sys, time, datetime, urllib.request, urllib.parse, urllib.error, pathlib
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONT = ROOT / "contenido"
API = "https://graph.instagram.com"
API_FB = "https://graph.facebook.com/v23.0"
IG_USER_ID = os.environ.get("IG_USER_ID", "").strip()
TOKEN = os.environ.get("IG_TOKEN", "").strip()
BASE = os.environ.get("BASE_URL", "").rstrip("/")
PRUEBA = os.environ.get("PRUEBA") == "1"


def api(method, path, _quiet=False, **params):
    params["access_token"] = TOKEN
    data = urllib.parse.urlencode(params).encode()
    url = f"{API}/{path}"
    req = urllib.request.Request(url + ("?" + data.decode() if method == "GET" else ""), data=None if method == "GET" else data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace").replace(TOKEN, "***")
        if _quiet:
            return None
        sys.exit(f"Error de Instagram en {path}: {e.code} {body}")


def accesible(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def esperar(cid):
    for _ in range(30):  # hasta 5 minutos
        st = api("GET", cid, fields="status_code").get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            sys.exit(f"Instagram no pudo procesar {cid}: {st}")
        time.sleep(10)
    sys.exit(f"Instagram tarda demasiado en procesar {cid}")


def main():
    if not TOKEN or not BASE:
        sys.exit("Faltan IG_TOKEN o BASE_URL")
    global API
    me = api("GET", "me", _quiet=True, fields="user_id,username")
    if me and me.get("user_id"):
        uid = me["user_id"]
    else:
        # token de inicio de sesión unificado o de usuario del sistema: va por graph.facebook.com
        API = API_FB
        if not IG_USER_ID:
            sys.exit("Este token no es de inicio de sesión de Instagram. Añade la variable IG_USER_ID con el identificador de la cuenta de Instagram que sale en el panel de Meta.")
        uid = IG_USER_ID
        me = api("GET", uid, fields="username")
    print(f"Cuenta: @{me.get('username')}")
    hoy = os.environ.get("FECHA") or datetime.datetime.now(ZoneInfo("Europe/Madrid")).date().isoformat()
    cal = json.loads((CONT / "calendario.json").read_text(encoding="utf-8"))
    pubf = CONT / "publicados.json"
    pub = json.loads(pubf.read_text(encoding="utf-8")) if pubf.exists() else {}
    items = [x for x in cal if x["fecha"] == hoy and x["carpeta"] not in pub]
    if not items:
        print(f"Hoy ({hoy}) no hay nada pendiente.")
        return
    for it in items:
        d = CONT / it["carpeta"]
        texto = (d / "texto.txt").read_text(encoding="utf-8").strip()
        enc = urllib.parse.quote(it["carpeta"])
        if it["formato"] == "reel":
            urls = [f"{BASE}/contenido/{enc}/reel.mp4"]
        else:
            urls = [f"{BASE}/contenido/{enc}/{f.name}" for f in sorted(d.glob("*.jpg"))][:10]
        malas = [u for u in urls if not accesible(u)]
        if malas:
            sys.exit("Estas direcciones no se pueden abrir (¿GitHub Pages activado y desplegado?):\n" + "\n".join(malas))
        print(f"{it['fecha']} · {it['formato']} · {it['titulo']} · {len(urls)} archivo(s)")
        if PRUEBA:
            print("PRUEBA=1: no se publica.")
            continue
        if it["formato"] == "reel":
            cid = api("POST", f"{uid}/media", media_type="REELS", video_url=urls[0], caption=texto, share_to_feed="true")["id"]
            esperar(cid)
        else:
            hijos = []
            for u in urls:
                h = api("POST", f"{uid}/media", image_url=u, is_carousel_item="true")["id"]
                hijos.append(h)
            for h in hijos:
                esperar(h)
            cid = api("POST", f"{uid}/media", media_type="CAROUSEL", children=",".join(hijos), caption=texto)["id"]
            esperar(cid)
        mid = api("POST", f"{uid}/media_publish", creation_id=cid)["id"]
        pub[it["carpeta"]] = {"media_id": mid, "publicado": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}
        pubf.write_text(json.dumps(pub, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"Publicado: {mid}")


if __name__ == "__main__":
    main()
