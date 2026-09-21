#!/usr/bin/env python3
"""Build an internal, self-contained review copy. No external JS dependencies."""
import argparse
import json
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / 'prototype'
    html = (root / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>', '', html)
    html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>' + (root / 'styles.css').read_text(encoding='utf-8') + '</style>')
    scripts = []
    for var, filename in [('__SUDMAR_SNAPSHOT__', 'operations.json'), ('__SUDMAR_REFERENCES__', 'workbook-reference.json')]:
        data = json.loads((root / 'data' / filename).read_text(encoding='utf-8'))
        value = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
        scripts.append(f'globalThis.{var}={value};')
    for name in ['config', 'core', 'icons', 'repository', 'app']:
        code = (root / 'src' / (name + '.js')).read_text(encoding='utf-8')
        code = re.sub(r'^import .+?;\s*$', '', code, flags=re.MULTILINE)
        code = re.sub(r'^export ', '', code, flags=re.MULTILINE)
        scripts.append(code)
    script = '\n'.join(scripts).replace('</script', '<\\/script')
    html = html.replace('<script type="module" src="./src/app.js"></script>', '<script>\n' + script + '\n</script>')
    html = html.replace('<title>SUDMAR · Centro de operaciones</title>', '<title>SUDMAR · Vista de revisión v0.3</title>')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding='utf-8')
    print(f'Created {args.output} ({args.output.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()
