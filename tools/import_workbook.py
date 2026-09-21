#!/usr/bin/env python3
"""Read the existing workbook without editing it. Uses only Python's standard library.

Run: python3 tools/import_workbook.py /path/dashboard.xlsx --output prototype/data
The output is a dated snapshot, not a synchronization service or an audit history.
"""
import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                      for cell in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        props = workbook.find('s:workbookPr', NS)
        epoch = dt.datetime(1904, 1, 1) if props is not None and props.get('date1904') == '1' else dt.datetime(1899, 12, 30)
        relationships = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        for sheet in workbook.find('s:sheets', NS):
            target = relationships[sheet.get(RID)]
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
            root = ET.fromstring(archive.read(target))
            rel_file = posixpath.join(posixpath.dirname(target), '_rels', posixpath.basename(target) + '.rels')
            links = {}
            if rel_file in archive.namelist():
                link_targets = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read(rel_file))}
                links = {link.get('ref'): link_targets.get(link.get(RID), link.get('location')) for link in root.findall('s:hyperlinks/s:hyperlink', NS)}
            rows = []
            for row in root.findall('s:sheetData/s:row', NS):
                cells = {}
                formulas = {}
                for cell in row:
                    col = re.sub(r'\d+', '', cell.get('r', ''))
                    node = cell.find('s:v', NS)
                    value = node.text if node is not None else None
                    kind = cell.get('t')
                    if kind == 's' and value is not None:
                        value = shared[int(value)]
                    elif kind == 'inlineStr':
                        value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    elif kind == 'b' and value is not None:
                        value = value == '1'
                    elif kind not in ('str', 'e') and value is not None:
                        try:
                            value = float(value)
                            if value.is_integer():
                                value = int(value)
                        except ValueError:
                            pass
                    if value is not None and value != '':
                        cells[col] = value
                    formula = cell.find('s:f', NS)
                    if formula is not None and formula.text:
                        formulas[col] = formula.text
                if cells:
                    rows.append({'row': int(row.get('r')), 'cells': cells, 'formulas': formulas})
            sheets[sheet.get('name')] = {'rows': rows, 'links': links}
        core = ET.fromstring(archive.read('docProps/core.xml'))
        modified = core.find('{http://purl.org/dc/terms/}modified')
        return sheets, epoch, modified.text if modified is not None else None


def text(value):
    if value is None:
        return ''
    return str(value).strip()


def date_value(value, epoch):
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        if value <= 0:
            return None
        return (epoch + dt.timedelta(days=value)).date().isoformat()
    if isinstance(value, str):
        value = value.strip()
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            try:
                return dt.date.fromisoformat(value).isoformat()
            except ValueError:
                pass
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--output', type=Path, default=Path('prototype/data'))
    args = parser.parse_args()
    sheets, epoch, modified = read_workbook(args.workbook)
    ticket_sheet, task_sheet = sheets['TICKETS'], sheets['TAREAS']
    tickets, tasks = [], []
    for row in ticket_sheet['rows']:
        c = row['cells']
        if row['row'] == 1 or not (c.get('A') or c.get('C')):
            continue
        link = ticket_sheet['links'].get('Q' + str(row['row']))
        if not link and text(c.get('Q')).startswith(('http://', 'https://')):
            link = text(c.get('Q'))
        tickets.append({
            'id': 'ticket-' + str(row['row']), 'sourceRow': row['row'],
            'folio': text(c.get('A')), 'priority': text(c.get('B')), 'title': text(c.get('C')),
            'client': text(c.get('D')), 'businessUnit': text(c.get('E')),
            'area': text(c.get('F')), 'stage': text(c.get('G')), 'owner': text(c.get('H')),
            'openedAt': date_value(c.get('I'), epoch), 'dueAt': date_value(c.get('J'), epoch),
            'closedAt': date_value(c.get('K'), epoch), 'model': text(c.get('L')),
            'serial': text(c.get('M')), 'status': text(c.get('N')),
            'log': text(c.get('O')), 'diagnosis': text(c.get('P')),
            'evidenceUrl': link, 'evidenceLabel': text(c.get('Q')),
            'sourceExtra': {k: v for k, v in c.items() if k not in 'ABCDEFGHIJKLMNOPQ'},
        })
    for row in task_sheet['rows']:
        c = row['cells']
        # Formula-filled template rows are not tasks. Keep partial tasks that have an ID or description.
        if row['row'] == 1 or not (c.get('A') or c.get('H')):
            continue
        tasks.append({
            'id': 'task-' + str(row['row']), 'sourceRow': row['row'], 'ticketFolio': text(c.get('A')),
            'title': text(c.get('H')), 'notes': text(c.get('I')), 'owner': text(c.get('J')),
            'startAt': date_value(c.get('K'), epoch), 'duration': c.get('L'),
            'dueAt': date_value(c.get('M'), epoch), 'completedAt': date_value(c.get('Q'), epoch),
            'status': text(c.get('O')), 'checked': c.get('N') is True or c.get('N') == 1,
            'sourceProgress': c.get('R'), 'sourceDaysCompleted': c.get('P'),
            # Keep cached source values, but join to the actual ticket by exact folio in the app.
            'sourceTicket': {'title': text(c.get('B')), 'client': text(c.get('C')),
                'businessUnit': text(c.get('D')), 'stage': text(c.get('E')),
                'openedAt': date_value(c.get('F'), epoch), 'endAt': date_value(c.get('G'), epoch),
                'model': text(c.get('S')), 'serial': text(c.get('T')),
                'status': text(c.get('U')), 'week': c.get('V'), 'year': c.get('W'), 'area': text(c.get('X'))}
        })
    folios = collections.Counter(t['folio'] for t in tickets if t['folio'])
    missing = sorted({t['ticketFolio'] for t in tasks if t['ticketFolio'] not in folios})
    duplicates = sorted([k for k, v in folios.items() if v > 1])
    issues = {'duplicateTicketFolios': duplicates, 'taskFoliosNotInTickets': missing,
              'tasksWithoutTitle': sum(not t['title'] for t in tasks)}
    metadata = {
        'schemaVersion': 1, 'sourceFile': args.workbook.name, 'sourceModifiedAt': modified,
        'importedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'sourceSha256': hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
        'mode': 'snapshot', 'counts': {'tickets': len(tickets), 'tasks': len(tasks)},
        'sheets': [{'name': name, 'nonemptyRows': len(sheet['rows'])} for name, sheet in sheets.items()],
        'quality': issues,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, payload in [('operations.json', {'metadata': metadata, 'tickets': tickets, 'tasks': tasks}),
                              ('workbook-reference.json', {name: sheet for name, sheet in sheets.items() if name not in ('TICKETS', 'TAREAS')})]:
        (args.output / filename).write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    report = {
        'source': metadata, 'statusCounts': dict(collections.Counter(t['status'] for t in tickets)),
        'taskStatusCounts': dict(collections.Counter(t['status'] for t in tasks)),
        'areaCounts': dict(collections.Counter(t['area'] for t in tickets)),
        'linksRegistered': sum(bool(t['evidenceUrl']) for t in tickets),
        'note': 'Links are preserved, not checked. Cached formulas are read, not recalculated. Historical states are not reconstructed.',
    }
    (args.output / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
