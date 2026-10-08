"""確認中だけローカルサーバーを起動し、実描画検査を再実行する。"""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import subprocess

ROOT = Path(__file__).resolve().parents[3]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    subprocess.run(['python3', 'tools/review-job-art.py', 'exorcist', '--label', '祓魔師',
                    '--url', 'http://127.0.0.1:8765/',
                    '--output', 'docs/art/exorcist/game-display-review'],
                   cwd=ROOT, check=True, timeout=50)
finally:
    server.shutdown()
    server.server_close()
