from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import threading,webbrowser
ROOT=Path(__file__).resolve().parent
class H(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(ROOT),**k)
    def log_message(self,*a): pass
s=ThreadingHTTPServer(("127.0.0.1",0),H)
u=f"http://127.0.0.1:{s.server_address[1]}/stage13z9-preview.html"
print("LOCAL ONLY:",u)
threading.Timer(.5,lambda:webbrowser.open(u)).start()
try:s.serve_forever()
except KeyboardInterrupt:pass
finally:s.server_close()
