"""Render a full ERD image for the Bungad Villareal API from erd_schema.json.
Regenerate with:  .venv/Scripts/python dump_schema.py > erd_schema.json
               .venv/Scripts/python render_erd.py  -> ../ERD.png
"""
import json
from PIL import Image, ImageDraw, ImageFont

# ---------- fonts ----------
def font(sz, bold=False):
    name = 'segoeui' if not bold else 'segoeuib'
    for n in (name, 'arial'):
        try:
            return ImageFont.truetype(f'C:/Windows/Fonts/{n}.ttf', sz)
        except OSError:
            continue
    return ImageFont.load_default()

F_TITLE, F_SUB, F_HDR, F_COL = font(34, True), font(17), font(16, True), font(16, True)
F_FLD, F_FLD_R, F_LEG, F_LEG_B = font(15), font(13), font(16), font(17, True)

# ---------- domain colours: (header, fill, border) ----------
PAL = {
    'idn':  ('#7B1FA2', '#F5EAFE', '#4A148C'),   # identity/access
    'ten':  ('#1A56B0', '#E8F0FE', '#0D3C7E'),   # tenancy
    'cat':  ('#188038', '#E6F4EA', '#0B5A26'),   # catalog & inventory
    'sal':  ('#C5221F', '#FDEAE8', '#8E1611'),   # sales & payments
    'loy':  ('#00796B', '#E0F7F5', '#004C43'),   # loyalty & CRM
    'ops':  ('#B06000', '#FEF7E0', '#7A4300'),   # operations
    'ext':  ('#455A64', '#ECEFF1', '#263238'),   # external auth_user
}
COLS = [
    ('IDENTITY & TENANCY', 'idn', ['User', 'DeviceToken', 'UserProfile', 'UserAccess',
                                   'Company', 'BusinessType', 'Business', 'Branch']),
    ('CATALOG & INVENTORY', 'cat', ['Category', 'Item', 'BusinessItem',
                                    'InventoryLevel', 'StockMovement', 'RoomTable']),
    ('SALES & PAYMENTS', 'sal', ['PaymentMethod', 'CashierShift', 'Transaction',
                                 'TransactionItem', 'Payment', 'DailySales']),
    ('LOYALTY & CRM', 'loy', ['LoyaltyProgram', 'ClientProfile', 'LoyaltyTransaction',
                              'CustomerReward', 'RewardClaim', 'CustomerFeedback']),
    ('OPERATIONS', 'ops', ['DocumentSequence', 'Attendance', 'Expense', 'AuditLog']),
]
DOM = {e: k for _, k, ents in COLS for e in ents}
DOM.update({e: 'ten' for e in ('Company', 'BusinessType', 'Business', 'Branch')})

TYPE_ABBR = {'CharField': 'str', 'TextField': 'txt', 'SlugField': 'slug',
             'EmailField': 'email', 'DecimalField': 'dec', 'BooleanField': 'bool',
             'IntegerField': 'int', 'PositiveIntegerField': 'int', 'BigAutoField': 'pk',
             'AutoField': 'pk', 'DateTimeField': 'dt', 'DateField': 'date',
             'TimeField': 'time', 'JSONField': 'json', 'ImageField': 'img',
             'FileField': 'file', 'URLField': 'url', 'FloatField': 'flt',
             'UUIDField': 'uuid', 'GenericIPAddressField': 'ip',
             'PositiveBigIntegerField': 'int', 'PK': 'PK'}

def abbr(t):
    if t.startswith('FK -> '):
        return 'FK -> ' + t[6:]
    if t.startswith('O2O -> '):
        return '1:1 -> ' + t[7:]
    return TYPE_ABBR.get(t, t[:6].lower())

# ---------- data ----------
models = {m['model']: m for m in json.load(open('erd_schema.json'))}
models['User'] = {'model': 'User', 'fields': [('id', 'PK'), ('username', 'str'),
                                              ('email', 'email'), ('password', 'hash')],
                  'fks': [], 'm2m': []}          # external: django auth

# ---------- measure boxes ----------
HDR_H, ROW_H, PAD, GAP_Y = 34, 21, 12, 30
def measure(name):
    m = models[name]
    rows = [(n, abbr(t)) for n, t in m['fields']]
    w = F_HDR.getbbox(name)[2] + 2 * PAD
    for l, r in rows:
        w = max(w, F_FLD.getbbox(l)[2] + F_FLD_R.getbbox(r)[2] + 3 * PAD)
    return {'name': name, 'rows': rows, 'w': max(w, 170),
            'h': HDR_H + max(len(rows), 1) * ROW_H + 6}

BOX = {}
col_x, col_w, top, max_bottom = 40, [], 118, 0
for title, dom, ents in COLS:
    boxes = [measure(e) for e in ents]
    cw = max(b['w'] for b in boxes)
    y = top + 44
    for b in boxes:
        b.update(x=col_x + (cw - b['w']) // 2, y=y, dom=DOM.get(b['name'], dom))
        BOX[b['name']] = b
        y += b['h'] + GAP_Y
    col_w.append(cw)
    col_x += cw + 92
    max_bottom = max(max_bottom, y - GAP_Y)
CANVAS_W, CANVAS_H = col_x - 52, max(max_bottom, top) + 340
img = Image.new('RGB', (CANVAS_W, CANVAS_H), '#FAFAFA')
d = ImageDraw.Draw(img)

# ---------- edges (drawn first so boxes cover line crossings) ----------
def col_idx(name):
    for i, (_, _, ents) in enumerate(COLS):
        if name in ents:
            return i
    return 0

def row_y(b, row):
    return b['y'] + HDR_H + row * ROW_H + ROW_H // 2 + 2

EDGE_COL = {'idn': '#6A1B9A', 'ten': '#1565C0', 'cat': '#2E7D32',
            'sal': '#C62828', 'loy': '#00897B', 'ops': '#EF6C00',
            'ext': '#546E7A'}

def fk_edge(child, parent, fk_row, dashed=False):
    c, p = BOX[child], BOX[parent]
    cy = row_y(c, fk_row)
    py = row_y(p, 0)                      # parent PK row
    ci, pi = col_idx(child), col_idx(parent)
    col = EDGE_COL[DOM.get(parent, 'ext')] if not dashed else '#8D6E63'
    w = 1 if not dashed else 2
    if ci == pi or (ci == pi + 1 and False):
        ch = c['x'] - 12 - (fk_row % 6) * 6
        ax = c['x']
        bx = p['x']
    elif ci > pi:                          # parent to the left
        ch = c['x'] - 16 - (fk_row % 5) * 7
        ax, bx = c['x'], p['x'] + p['w']
    else:                                  # parent to the right
        ch = c['x'] + c['w'] + 16 + (fk_row % 5) * 7
        ax, bx = c['x'] + c['w'], p['x']
    pts = [(ax, cy), (ch, cy), (ch, py), (bx, py)]
    d.line(pts, fill=col, width=w, joint='curve')
    # child dot / parent ring
    d.ellipse([ax - 3, cy - 3, ax + 3, cy + 3], fill=col)
    r = 4
    ex = bx + 6 if ci > pi else bx - 6
    d.ellipse([ex - r, py - r, ex + r, py + r], outline=col, width=2, fill='#FAFAFA')

def self_edge(name, fk_row):
    c = BOX[name]
    cy, py = row_y(c, fk_row), row_y(c, 0)
    x = c['x'] + c['w']
    col = EDGE_COL[DOM.get(name, 'ext')]
    d.line([(x, cy), (x + 22, cy), (x + 22, py), (x, py)], fill=col, width=1)
    d.ellipse([x - 3, cy - 3, x + 3, cy + 3], fill=col)

M2M = [('UserAccess', 'branches', 'Branch'), ('UserProfile', 'skills', 'Item'),
       ('Transaction', 'rewards_applied', 'CustomerReward')]

for name, m in models.items():
    if name not in BOX:
        continue
    for i, (fld, tgt) in enumerate(m['fks']):
        if tgt not in BOX:
            continue
        fk_row = next((r for r, (l, _) in enumerate(BOX[name]['rows'])
                       if l == fld + '_id'), 1 + i)
        if tgt == name:
            self_edge(name, fk_row)
        else:
            fk_edge(name, tgt, fk_row)

for a, _lbl, b in M2M:                       # dashed many-to-many links
    ca, cb = BOX[a], BOX[b]
    ax, bx = (ca['x'], cb['x'] + cb['w']) if col_idx(a) < col_idx(b) else (ca['x'] + ca['w'], cb['x'])
    ay, by = ca['y'] + ca['h'] - ROW_H // 2, cb['y'] + HDR_H // 2
    mid = (ax + bx) / 2
    d.line([(ax, ay), (mid, ay), (mid, by), (bx, by)], fill='#8D6E63', width=2)

# ---------- boxes ----------
for b in BOX.values():
    hdr, fill, brd = PAL[b['dom']]
    x, y, w, h = b['x'], b['y'], b['w'], b['h']
    d.rounded_rectangle([x, y, x + w, y + h], 8, fill=fill, outline=brd, width=2)
    d.rounded_rectangle([x, y, x + w, y + HDR_H], 8, fill=hdr)
    d.rectangle([x, y + HDR_H - 9, x + w, y + HDR_H], fill=hdr)
    d.text((x + PAD, y + 8), b['name'], font=F_HDR, fill='white')
    for r, (l, t) in enumerate(b['rows']):
        ry = y + HDR_H + 2 + r * ROW_H
        is_key = t.startswith(('PK', 'FK', '1:1'))
        d.text((x + PAD, ry + 2), l, font=F_FLD, fill='#111' if is_key else '#333')
        d.text((x + w - PAD - F_FLD_R.getbbox(t)[2], ry + 4), t, font=F_FLD_R,
               fill='#0D47A1' if t.startswith('FK') else ('#B71C1C' if t == 'PK' else '#777'))


# ---------- column headers ----------
cx = 40
for ci, (title, dom, ents) in enumerate(COLS):
    hdr, fill, brd = PAL[dom]
    w = col_w[ci]
    d.rounded_rectangle([cx, 76, cx + w, 110], 8, fill=hdr)
    d.text((cx + (w - F_COL.getbbox(title)[2]) // 2, 82), title, font=F_COL, fill='white')
    cx += w + 92

# ---------- title ----------
d.text((40, 6), 'Bungad Villareal System — Entity Relationship Diagram', font=F_TITLE, fill='#111')
d.text((40, 46), 'Django app "api" · 29 tables · SQLite / PostgreSQL · generated from models @ migration 0018',
       font=F_SUB, fill='#666')

# ---------- legend ----------
LY = CANVAS_H - 250
d.rounded_rectangle([40, LY, CANVAS_W - 40, LY + 226], 10, fill='white', outline='#BDBDBD', width=2)
d.text((60, LY + 12), 'LEGEND', font=F_LEG_B, fill='#111')
lx, ly = 60, LY + 44
for key, label in [('idn', 'Identity & Access'), ('ten', 'Tenancy'), ('cat', 'Catalog & Inventory'),
                   ('sal', 'Sales & Payments'), ('loy', 'Loyalty & CRM'), ('ops', 'Operations'),
                   ('ext', 'External (django auth)')]:
    hdr, fill, brd = PAL[key]
    d.rounded_rectangle([lx, ly, lx + 26, ly + 18], 4, fill=hdr)
    d.text((lx + 32, ly - 1), label, font=F_LEG, fill='#333')
    lx += 32 + F_LEG.getbbox(label)[2] + 34
    if lx > CANVAS_W - 320:
        lx, ly = 60, ly + 28
lx, ly = 60, ly + 34
d.text((lx, ly), 'dot (•) = child FK row   |   ring (○) = parent PK row   |   line colour = parent domain   |   '
                 'loop on right = self-FK (Category.parent, DeviceToken.rotated_from)',
       font=F_LEG, fill='#333')
d.line([(lx + 2, ly + 26), (lx + 42, ly + 26)], fill='#8D6E63', width=2)
d.text((lx + 50, ly + 18), 'M2M through-tables:  UserAccess.branches ↔ Branch · UserProfile.skills ↔ Item · '
                           'Transaction.rewards_applied ↔ CustomerReward', font=F_LEG, fill='#333')
d.text((lx, ly + 50), 'All FK are many-to-one (many child rows → one parent) unless marked 1:1 (UserProfile → User). '
                      'Owning-side table holds the FK column (…_id).', font=F_LEG, fill='#333')
d.text((lx, ly + 76), 'Multi-tenant core: Company → Business → Branch scopes every operational row; '
                      'User links in via UserAccess (role per business / branch).', font=F_LEG, fill='#333')

img.save('../ERD.png')
print('wrote ERD.png', img.size)

