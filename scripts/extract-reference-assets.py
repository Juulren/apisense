"""Preserve image assets referenced by the user-provided Stitch HTML."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen

class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            url = dict(attrs).get('src', '')
            if url.startswith('https://lh3.googleusercontent.com/'):
                self.urls.append(url)

if __name__ == '__main__':
    parser = Images()
    parser.feed(Path('design-reference/stitch/exports/inicio_de_sesi_n_simplificado_apisense/code.html').read_text(encoding='utf-8'))
    Path('assets').mkdir(exist_ok=True)
    with urlopen(parser.urls[0], timeout=30) as response:
        Path('assets/brand-logo.png').write_bytes(response.read())
    print('assets/brand-logo.png')
