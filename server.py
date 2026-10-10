from __future__ import annotations

import json
import re
import uuid
from email.parser import BytesParser
from email.policy import default
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "content" / "projects.json"
MAX_UPLOAD_BYTES = 512 * 1024 * 1024
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def read_projects() -> list[dict]:
    if not DATA_PATH.exists():
        return []
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return payload.get("projects", []) if isinstance(payload, dict) else payload


def write_projects(projects: list[dict]) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        json.dumps({"version": 1, "projects": projects}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_projects(value) -> list[dict]:
    if isinstance(value, dict):
        value = value.get("projects")
    if not isinstance(value, list):
        raise ValueError("Ожидался массив карточек.")

    result = []
    ids = set()
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Каждая карточка должна быть объектом.")
        project_id = str(item.get("id", "")).strip()
        title = str(item.get("title", "")).strip()
        media = str(item.get("media", "")).strip()
        media_type = str(item.get("mediaType", "video")).strip().lower()
        if not project_id or not title or not media:
            raise ValueError("У карточки должны быть id, заголовок и медиафайл.")
        if project_id in ids:
            raise ValueError(f"Повторяется id карточки: {project_id}")
        if media_type not in {"video", "image"}:
            raise ValueError("Тип медиафайла должен быть video или image.")
        if not media.startswith("/assets/"):
            raise ValueError("Медиафайлы должны находиться внутри папки assets.")
        ids.add(project_id)
        result.append(
            {
                "id": project_id,
                "title": title,
                "mediaType": media_type,
                "media": media,
                "alt": str(item.get("alt", title)).strip() or title,
                "kzText": str(item.get("kzText", "")),
                "ruText": str(item.get("ruText", "")),
                "published": bool(item.get("published", True)),
            }
        )
    return result


def parse_multipart(content_type: str, body: bytes) -> dict:
    header = (
        f"Content-Type: {content_type}\r\n"
        "MIME-Version: 1.0\r\n\r\n"
    ).encode("utf-8")
    message = BytesParser(policy=default).parsebytes(header + body)
    fields = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="Content-Disposition")
        if not name:
            continue
        fields[name] = {
            "value": part.get_payload(decode=True) or b"",
            "filename": part.get_filename(),
        }
    return fields


def safe_extension(filename: str, media_type: str) -> str:
    extension = Path(filename).suffix.lower()
    allowed = VIDEO_EXTENSIONS if media_type == "video" else IMAGE_EXTENSIONS
    if extension not in allowed:
        allowed_text = ", ".join(sorted(allowed))
        raise ValueError(f"Для этого типа разрешены: {allowed_text}")
    return extension


class PrioritetHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, payload, status=200):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_UPLOAD_BYTES:
            raise ValueError("Запрос слишком большой.")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _error(self, message, status=400):
        self._send_json({"ok": False, "error": message}, status)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/projects":
            try:
                self._send_json({"projects": read_projects()})
            except (OSError, json.JSONDecodeError) as error:
                self._error(f"Не удалось прочитать карточки: {error}", 500)
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/projects":
            try:
                projects = clean_projects(self._read_json())
                write_projects(projects)
                self._send_json({"ok": True, "projects": projects})
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
                self._error(str(error))
            except OSError as error:
                self._error(f"Не удалось сохранить файл: {error}", 500)
            return

        if path == "/api/media":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0:
                    raise ValueError("Файл не выбран.")
                if length > MAX_UPLOAD_BYTES:
                    raise ValueError("Файл слишком большой. Максимальный размер — 512 МБ.")
                content_type = self.headers.get("Content-Type", "")
                if not content_type.startswith("multipart/form-data"):
                    raise ValueError("Загрузка должна быть multipart/form-data.")
                fields = parse_multipart(content_type, self.rfile.read(length))
                media_type = fields.get("mediaType", {}).get("value", b"video").decode("utf-8").strip()
                if media_type not in {"video", "image"}:
                    raise ValueError("Неизвестный тип медиафайла.")
                file_field = fields.get("file", {})
                filename = file_field.get("filename") or ""
                extension = safe_extension(filename, media_type)
                data = file_field.get("value", b"")
                if not data:
                    raise ValueError("Файл пустой.")

                folder = ROOT / "assets" / ("videos" if media_type == "video" else "images")
                folder.mkdir(parents=True, exist_ok=True)
                stored_name = f"media-{uuid.uuid4().hex[:12]}{extension}"
                destination = folder / stored_name
                destination.write_bytes(data)
                self._send_json(
                    {
                        "ok": True,
                        "mediaType": media_type,
                        "media": f"/assets/{folder.name}/{stored_name}",
                        "filename": filename,
                    }
                )
            except (ValueError, UnicodeDecodeError) as error:
                self._error(str(error))
            except OSError as error:
                self._error(f"Не удалось сохранить медиафайл: {error}", 500)
            return

        self._error("Маршрут не найден.", 404)

    def do_DELETE(self):
        path = urlsplit(self.path).path
        match = re.fullmatch(r"/api/projects/([^/]+)", path)
        if not match:
            self._error("Маршрут не найден.", 404)
            return
        project_id = match.group(1)
        projects = read_projects()
        remaining = [project for project in projects if project.get("id") != project_id]
        if len(remaining) == len(projects):
            self._error("Карточка не найдена.", 404)
            return
        write_projects(remaining)
        self._send_json({"ok": True, "projects": remaining})

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


if __name__ == "__main__":
    host, port = "127.0.0.1", 8765
    server = ThreadingHTTPServer((host, port), PrioritetHandler)
    print(f"Локальный сервер запущен: http://{host}:{port}/")
    print(f"Главная: http://{host}:{port}/prototypes/prototype-home.html")
    print(f"Админка: http://{host}:{port}/prototypes/admin.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
    finally:
        server.server_close()
