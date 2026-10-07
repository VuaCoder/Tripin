#!/usr/bin/env python3
"""Sinh database.html — trang HTML tự chứa mô tả schema Tripin.

Đọc metadata THẬT từ PostgreSQL (pg_catalog) chứ không viết tay, nên trang luôn
khớp với DDL đang có trong database.

Cách dùng:
    createdb tripin
    psql -v ON_ERROR_STOP=1 -d tripin -f tripin.sql
    python3 generate-html.py -d tripin          # hoặc để trống thì dùng biến PG*

Tham số còn lại được chuyển thẳng cho `psql` (-h, -p, -U, -d ...), nên cũng dùng
được với DSN: python3 generate-html.py "postgresql://user:pw@host/db"

Ghi đè `database.html` nằm cạnh script này.
"""
import json
import os
import re
import subprocess
import sys
from collections import OrderedDict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.html")
PSQL = ["psql", *sys.argv[1:]]

GROUPS = OrderedDict([
    ("identity", ("Danh tính & nhà cung cấp", "#2563eb",
                  ["USER", "SUPPLIER", "HOTEL_PROFILE", "TRANSPORT_PROFILE",
                   "GUIDE_PROFILE", "AMENITY", "PROFILE_AMENITY"])),
    ("catalogue", ("Địa bàn, danh mục & tồn kho", "#7c3aed",
                   ["ZONE", "LOCATION", "PRODUCT", "ROOM_TYPE", "TRIP", "TRIP_EVENT",
                    "TOUR_PACKAGE_ITEM", "AVAILABILITY", "SEAT_INVENTORY"])),
    ("booking", ("Hành trình & đặt chỗ", "#059669",
                 ["TRAVELLER", "ITINERARY", "ITINERARY_VERSION", "ITINERARY_SEGMENT",
                  "BOOKING_GROUP", "BOOKING", "BOOKING_ITEM", "BOOKING_TRAVELLER",
                  "BOOKING_EVENT", "HOLD", "SLOT", "GUIDE_AVAILABILITY", "TOUR_REQUEST",
                  "CHAT_THREAD", "CHAT_MESSAGE"])),
    ("money", ("Tiền", "#d97706",
               ["PAYMENT", "PAYMENT_TRANSACTION", "CANCELLATION_POLICY", "REFUND",
                "PAYOUT", "INVOICE", "PLATFORM_SETTING"])),
    ("gov", ("Kiểm duyệt, audit & tích hợp", "#dc2626",
             ["MODERATION_REQUEST", "MODERATION_LOG", "AUDIT_LOG",
              "SUPPLIER_PAYOUT_ACCOUNT", "SUPPLIER_INTEGRATION"])),
    ("content", ("Nội dung & tương tác (trước ở MongoDB)", "#0891b2",
                 ["PRODUCT_CONTENT", "PROFILE_CONTENT", "REVIEW", "REVIEW_SUMMARY",
                  "NOTIFICATION", "WISHLIST", "CART", "CART_ITEM", "REPORT",
                  "HELP_ARTICLE", "TICKET", "TICKET_MESSAGE", "RAW_EVENT"])),
])

TYPE_MAP = {
    "character varying": "varchar",
    "timestamp with time zone": "timestamptz",
    "timestamp without time zone": "timestamp",
    "double precision": "float8",
    "integer": "int",
    "boolean": "bool",
    "smallint": "int2",
    "bigint": "int8",
}

DEL_ACTION = {"c": "CASCADE", "n": "SET NULL", "r": "RESTRICT", "a": "NO ACTION",
              "d": "SET DEFAULT"}


def rows(sql):
    """Chạy một câu SQL, trả về list các list field (TSV, dấu |)."""
    res = subprocess.run([*PSQL, "-tA", "-F", "|", "-c", sql],
                         capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit("psql thất bại:\n" + res.stderr.strip())
    return [line.split("|") for line in res.stdout.splitlines() if line.strip()]


def unquote(s):
    return s.strip().strip('"')


def paren_list(defn):
    i, j = defn.find("("), defn.rfind(")")
    if i < 0 or j < 0:
        return []
    return [unquote(p) for p in defn[i + 1:j].split(",")]


# ---------------------------------------------------------------- enums
enums = {}
for name, values in rows("""
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
GROUP BY t.typname ORDER BY t.typname"""):
    enums[name] = values.split("|")

# ---------------------------------------------------------------- columns
tables = OrderedDict()
for tbl, _num, col, typ, nullable, default in rows("""
SELECT cl.relname, a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
       CASE WHEN a.attnotnull THEN 'N' ELSE 'Y' END,
       COALESCE(pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_attribute a
JOIN pg_class cl ON cl.oid = a.attrelid AND cl.relkind = 'r'
JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attnum > 0 AND NOT a.attisdropped
ORDER BY cl.relname, a.attnum"""):
    tbl = unquote(tbl)
    t = tables.setdefault(tbl, {"name": tbl, "cols": [], "pk": [], "unique": [],
                                "checks": [], "fksOut": [], "fksIn": [],
                                "indexes": [], "group": None})
    t["cols"].append({
        "name": col,
        "type": TYPE_MAP.get(typ, typ),
        "raw": typ,
        "notnull": nullable == "N",
        "default": default or None,
    })

# ---------------------------------------------------------------- constraints
for tbl, kind, cname, defn in rows("""
SELECT conrelid::regclass::text, contype, conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND contype IN ('p','u','c','x')
ORDER BY 1, 2, 3"""):
    tbl = unquote(tbl)
    t = tables[tbl]
    if kind == "p":
        t["pk"] = paren_list(defn)
    elif kind == "u":
        t["unique"].append({"name": cname, "cols": paren_list(defn), "def": defn})
    elif kind == "c":
        t["checks"].append({"name": cname, "def": re.sub(r"^CHECK\s*", "", defn)})
    elif kind == "x":
        t["checks"].append({"name": cname, "def": defn, "exclude": True})

# ---------------------------------------------------------------- foreign keys
for tbl, cname, child_cols, parent, parent_cols, del_action in rows("""
SELECT conrelid::regclass::text, conname,
  (SELECT string_agg(a.attname, ', ' ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord)
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum),
  confrelid::regclass::text,
  (SELECT string_agg(a.attname, ', ' ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(attnum,ord)
     JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum),
  c.confdeltype
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype = 'f'
ORDER BY 1, 2"""):
    tbl, parent = unquote(tbl), unquote(parent)
    child_cols = [unquote(c) for c in child_cols.split(", ")]
    parent_cols = [unquote(c) for c in parent_cols.split(", ")]
    fk = {"name": cname, "cols": child_cols, "table": parent,
          "refCols": parent_cols, "onDelete": DEL_ACTION.get(del_action, del_action)}
    tables[tbl]["fksOut"].append(fk)
    tables[parent]["fksIn"].append({"name": cname, "table": tbl, "cols": child_cols,
                                    "refCols": parent_cols,
                                    "onDelete": fk["onDelete"]})

# ---------------------------------------------------------------- indexes
for tbl, iname, idef in rows("""
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname"""):
    tbl = unquote(tbl)
    tables[tbl]["indexes"].append({"name": iname, "def": idef})

# ---------------------------------------------------------------- groups
for key, (label, color, names) in GROUPS.items():
    for n in names:
        if n in tables:
            tables[n]["group"] = key
missing = [n for n, t in tables.items() if not t["group"]]
assert not missing, f"bảng chưa xếp nhóm: {missing}"
assert len(tables) == 56, len(tables)

# column -> flags
for t in tables.values():
    for c in t["cols"]:
        c["pk"] = c["name"] in t["pk"]
        c["fk"] = any(c["name"] in fk["cols"] for fk in t["fksOut"])
        c["uq"] = any(c["name"] in u["cols"] for u in t["unique"])
        c["enum"] = enums.get(c["type"])

model = {
    "groups": [{"key": k, "label": v[0], "color": v[1],
                "tables": [n for n in v[2] if n in tables]}
               for k, v in GROUPS.items()],
    "tables": list(tables.values()),
    "enums": enums,
}

n_cols = sum(len(t["cols"]) for t in tables.values())
n_fk = sum(len(t["fksOut"]) for t in tables.values())
n_check = sum(len(t["checks"]) for t in tables.values())
n_idx = sum(len(t["indexes"]) for t in tables.values())
n_nn = sum(1 for t in tables.values() for c in t["cols"] if c["notnull"])
n_null = n_cols - n_nn
n_uniq = sum(len(t["unique"]) for t in tables.values())

HTML = r"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tripin — Database (56 bảng) — LỊCH SỬ, không phải target schema</title>
<style>
:root{
  --bg:#f6f7f9; --panel:#fff; --ink:#111827; --muted:#6b7280; --line:#e5e7eb;
  --line2:#eef0f3; --code:#0f766e; --accent:#2563eb; --radius:10px;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
code,.mono{font-family:var(--mono);font-size:.92em}
a{color:var(--accent)}
.wrap{max-width:1680px;margin:0 auto;padding:0 20px}

header.top{background:linear-gradient(180deg,#fff,#fbfcfd);border-bottom:1px solid var(--line);
  padding:26px 0 20px}
h1{margin:0 0 6px;font-size:26px;letter-spacing:-.02em}
h1 .tag{font-size:12px;font-weight:600;color:#065f46;background:#d1fae5;border:1px solid #a7f3d0;
  padding:3px 8px;border-radius:999px;vertical-align:middle;margin-left:8px}
.sub{margin:0;color:var(--muted)}
.note{margin:12px 0 0;padding:9px 12px;border-left:3px solid #f59e0b;background:#fffbeb;
  border-radius:0 8px 8px 0;color:#78350f;font-size:13.5px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:9px 14px;min-width:96px}
.stat b{display:block;font-size:20px;letter-spacing:-.02em}
.stat span{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}

.toolbar{position:sticky;top:0;z-index:30;background:rgba(246,247,249,.94);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:11px 0}
.toolbar .wrap{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
#q{flex:1 1 260px;min-width:220px;padding:8px 12px;border:1px solid var(--line);
  border-radius:8px;font:inherit;background:#fff}
#q:focus{outline:2px solid #bfdbfe;border-color:#93c5fd}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 11px;
  font:inherit;font-size:12.5px;cursor:pointer;color:#374151;display:inline-flex;align-items:center;gap:6px}
.chip .dot{width:8px;height:8px;border-radius:50%}
.chip[aria-pressed="true"]{background:#111827;color:#fff;border-color:#111827}
.chip[aria-pressed="true"] .dot{box-shadow:0 0 0 2px rgba(255,255,255,.35)}
.switch{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#374151;cursor:pointer}
#count{font-size:12.5px;color:var(--muted);margin-left:auto}

h2{font-size:18px;margin:30px 0 4px;letter-spacing:-.01em}
.hint{color:var(--muted);font-size:13px;margin:0 0 12px}
.erdwrap{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  overflow:auto;padding:4px}
#erd{display:block}
#erd text{font-family:var(--mono);font-size:10.5px;fill:#374151;pointer-events:none}
#erd .ghdr{font-family:system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.02em}
#erd .node rect{fill:#fff;stroke:#d1d5db;stroke-width:1}
#erd .node{cursor:pointer}
#erd .node:hover rect{stroke:#111827;stroke-width:1.6}
#erd .node.sel rect{stroke:#111827;stroke-width:2;fill:#f9fafb}
#erd .node.dim{opacity:.18}
#erd .edge{fill:none;stroke-width:1.15;opacity:.16}
#erd .edge.hl{opacity:.95;stroke-width:1.9}
#erd .edge.fade{opacity:.045}
#erd .node.hl rect{stroke:#111827;stroke-width:1.8}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12.5px;color:#374151}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px;margin:14px 0 40px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  overflow:hidden;scroll-margin-top:74px;display:flex;flex-direction:column}
.card.sel{border-color:#111827;box-shadow:0 0 0 3px rgba(17,24,39,.07)}
.card.hide{display:none}
.card>header{padding:11px 14px;border-bottom:1px solid var(--line);display:flex;
  align-items:center;gap:9px;flex-wrap:wrap}
.card>header h3{margin:0;font:600 15px/1.3 var(--mono);letter-spacing:-.01em}
.gtag{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;color:#fff;white-space:nowrap}
.card .meta{margin-left:auto;font-size:11.5px;color:var(--muted);white-space:nowrap}
.card .body{padding:0 0 4px}
table.cols{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
table.cols col.c1{width:42%} table.cols col.c2{width:36%} table.cols col.c3{width:22%}
table.cols th{text-align:left;font:600 10.5px/1 system-ui;text-transform:uppercase;
  letter-spacing:.05em;color:var(--muted);padding:7px 14px 5px;border-bottom:1px solid var(--line2)}
table.cols td{padding:4px 14px;border-bottom:1px solid var(--line2);vertical-align:top;
  overflow-wrap:anywhere}
table.cols tr:last-child td{border-bottom:0}
table.cols tr.hit td{background:#fef9c3}
.cname{font-family:var(--mono);font-size:12.5px;color:#111827}
.ctype{font-family:var(--mono);font-size:12px;color:var(--code)}
.ctype.enum{cursor:help;border-bottom:1px dotted #99f6e4}
.k{display:inline-block;font:700 9.5px/1 system-ui;padding:3px 5px;border-radius:4px;
  margin-left:5px;vertical-align:1px;letter-spacing:.03em}
.k.pk{background:#fde68a;color:#78350f}
.k.fk{background:#bfdbfe;color:#1e3a8a}
.k.uq{background:#ddd6fe;color:#4c1d95}
.k.nn{background:#e5e7eb;color:#4b5563}
.dflt{color:var(--muted);font-family:var(--mono);font-size:11.5px}
.sect{padding:8px 14px 10px;border-top:1px dashed var(--line2);font-size:12.5px}
.sect h4{margin:6px 0 5px;font:600 10.5px/1 system-ui;text-transform:uppercase;
  letter-spacing:.05em;color:var(--muted)}
.rel{display:flex;gap:6px;align-items:baseline;padding:2px 0;flex-wrap:wrap}
.rel .arrow{color:var(--muted)}
.rel code{font-size:12px}
.act{font-size:10.5px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;
  padding:1px 5px;border-radius:4px;white-space:nowrap}
ul.plain{margin:0;padding-left:16px;color:#4b5563}
ul.plain li{margin:2px 0;font-family:var(--mono);font-size:11.5px;word-break:break-word}
.empty{color:var(--muted);font-style:italic}
footer{border-top:1px solid var(--line);padding:18px 0 34px;color:var(--muted);font-size:13px}
.hidden{display:none !important}
.superseded{background:#fff4ed;border-bottom:1px solid #f0c8b0;padding:12px 0}
.superseded p{margin:0;font-size:13.5px;line-height:1.6;color:#7a3a1d}
.superseded b{color:#a33d18}
.superseded code{background:#fde7db;padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:12.5px}
</style>
</head>
<body>

<div class="superseded"><div class="wrap">
  <p><b>⚠ TÀI LIỆU LỊCH SỬ — không phải target schema.</b>
     Đây là bản thiết kế theo tầm nhìn marketplace (khách sạn, vận chuyển, hành trình tự ghép, slot guide).
     Đối chiếu với use-case diagram thì nó <b>thừa 30 bảng</b> so với phạm vi đang code và <b>thiếu 10 model</b>
     mà ứng dụng đang chạy, nên nó <b>không phải superset</b> của <code>prisma/schema.prisma</code> và
     <b>không được dùng làm target schema</b>. Bản dùng được là
     <code>docs/database/scope/database.html</code> — 29 bảng + 1 bảng join, khớp 1-1 với Prisma.
     Quyết định: <code>docs/database/adr/0005-recut-design-to-scope.md</code>.</p>
</div></div>

<header class="top"><div class="wrap">
  <h1>Tripin — Database schema <span class="tag">PostgreSQL · một store</span></h1>
  <p class="sub">Mô hình miền đầy đủ sau khi gộp hai store (Postgres + MongoDB) thành một.
     Sinh tự động từ <code>docs/database/design/tripin.sql</code>.</p>
  <p class="note"><b>Đây là artifact thiết kế</b>, không phải schema ứng dụng đang chạy.
     Schema đang chạy là <code>prisma/schema.prisma</code> (29 model, tên khác, id UUID).</p>
  <div class="stats">
    <div class="stat"><b>__NT__</b><span>bảng</span></div>
    <div class="stat"><b>__NC__</b><span>cột</span></div>
    <div class="stat"><b>__NFK__</b><span>khoá ngoại</span></div>
    <div class="stat"><b>__NUQ__</b><span>unique</span></div>
    <div class="stat"><b>__NCH__</b><span>check / exclude</span></div>
    <div class="stat"><b>__NE__</b><span>enum</span></div>
    <div class="stat"><b>__NIX__</b><span>index</span></div>
    <div class="stat"><b>__NNN__</b><span>NOT NULL</span></div>
    <div class="stat"><b>__NNULL__</b><span>nullable</span></div>
  </div>
</div></header>

<div class="toolbar"><div class="wrap">
  <input id="q" type="search" placeholder="Tìm bảng, cột, kiểu… (vd: booking, travellerUserId, jsonb)">
  <div class="chips" id="chips"></div>
  <label class="switch"><input type="checkbox" id="onlyRel"> chỉ bảng có quan hệ</label>
  <span id="count"></span>
</div></div>

<div class="wrap">
  <h2>Sơ đồ quan hệ</h2>
  <p class="hint">Rê chuột lên một bảng để làm nổi các quan hệ của nó · bấm để nhảy tới thẻ chi tiết.
     Mỗi cột dọc là một nhóm nghiệp vụ.</p>
  <div class="erdwrap"><svg id="erd"></svg></div>
  <div class="legend" id="legend"></div>

  <h2 id="cardsTitle">Chi tiết từng bảng</h2>
  <p class="hint">PK = khoá chính · FK = khoá ngoại · UQ = unique · NN = NOT NULL.
     Rê chuột lên kiểu enum để xem danh sách giá trị.</p>
  <div class="grid" id="cards"></div>
</div>

<footer><div class="wrap">
  Sinh từ metadata của PostgreSQL sau khi chạy <code>tripin.sql</code> trên <code>postgres:16</code> —
  mọi con số và quan hệ trên trang này đọc trực tiếp từ catalog, không viết tay.
</div></footer>

<script type="application/json" id="data">__DATA__</script>
<script>
(function(){
  "use strict";
  var M = JSON.parse(document.getElementById("data").textContent);
  var T = {}, byName = {};
  M.tables.forEach(function(t){ T[t.name] = t; byName[t.name] = t; });
  var groupOf = {};
  M.groups.forEach(function(g){ g.tables.forEach(function(n){ groupOf[n] = g; }); });

  /* ---------------------------------------------------------------- chips */
  var chips = document.getElementById("chips");
  var active = new Set();
  M.groups.forEach(function(g){
    var b = document.createElement("button");
    b.className = "chip"; b.type = "button"; b.setAttribute("aria-pressed","false");
    b.innerHTML = '<span class="dot" style="background:'+g.color+'"></span>'+
                  g.label+' <span style="opacity:.6">'+g.tables.length+'</span>';
    b.onclick = function(){
      if (active.has(g.key)) active.delete(g.key); else active.add(g.key);
      b.setAttribute("aria-pressed", active.has(g.key) ? "true" : "false");
      apply();
    };
    chips.appendChild(b);
  });
  var legend = document.getElementById("legend");
  M.groups.forEach(function(g){
    var s = document.createElement("span");
    s.innerHTML = '<i style="background:'+g.color+'"></i>'+g.label;
    legend.appendChild(s);
  });

  /* ---------------------------------------------------------------- cards */
  var grid = document.getElementById("cards");
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c]; }); }
  function typeCell(c){
    var t = esc(c.type);
    if (!c.enum) return '<span class="ctype">'+t+'</span>';
    return '<span class="ctype enum" title="'+esc(c.type+": "+c.enum.join(", "))+'">'+
           t+' &#9432;</span>';
  }
  function relRow(cols, other, refCols, act){
    return '<div class="rel"><code>'+esc(cols.join(", "))+'</code>'+
      '<span class="arrow">&rarr;</span><code>'+esc(other)+'.'+esc(refCols.join(", "))+'</code>'+
      (act && act !== "NO ACTION" ? '<span class="act">ON DELETE '+esc(act)+'</span>' : '')+
      '</div>';
  }
  M.tables.forEach(function(t){
    var g = groupOf[t.name];
    var card = document.createElement("section");
    card.className = "card"; card.id = "t-" + t.name; card.dataset.table = t.name;
    var cols = t.cols.map(function(c){
      var k = "";
      if (c.pk) k += '<span class="k pk">PK</span>';
      if (c.fk) k += '<span class="k fk">FK</span>';
      if (c.uq) k += '<span class="k uq">UQ</span>';
      if (c.notnull) k += '<span class="k nn">NN</span>';
      return '<tr data-col="'+esc(c.name)+'"><td><span class="cname">'+esc(c.name)+'</span>'+k+
        '</td><td>'+typeCell(c)+'</td><td class="dflt">'+(c.default ? esc(c.default) : "")+
        '</td></tr>';
    }).join("");
    var h = '<header><h3>'+esc(t.name)+'</h3>'+
      '<span class="gtag" style="background:'+g.color+'">'+esc(g.label)+'</span>'+
      '<span class="meta">'+t.cols.length+' cột · '+t.fksOut.length+' FK ra · '+
      t.fksIn.length+' FK vào</span></header><div class="body">'+
      '<table class="cols"><colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup>'+
      '<thead><tr><th>Cột</th><th>Kiểu</th><th>Mặc định</th></tr></thead>'+
      '<tbody>'+cols+'</tbody></table>';

    h += '<div class="sect"><h4>Quan hệ ra ('+t.fksOut.length+')</h4>';
    h += t.fksOut.length ? t.fksOut.map(function(f){
      return relRow(f.cols, f.table, f.refCols, f.onDelete); }).join("")
      : '<span class="empty">không có</span>';
    h += '</div><div class="sect"><h4>Quan hệ vào ('+t.fksIn.length+')</h4>';
    h += t.fksIn.length ? t.fksIn.map(function(f){
      return relRow([f.table+"."+f.cols.join(", ")], t.name, f.refCols, f.onDelete);
      }).join("") : '<span class="empty">không có</span>';
    h += '</div>';

    if (t.unique.length || t.checks.length || t.indexes.length){
      h += '<div class="sect">';
      if (t.unique.length){
        h += '<h4>Unique ('+t.unique.length+')</h4><ul class="plain">'+
          t.unique.map(function(u){ return '<li>'+esc(u.def)+'</li>'; }).join("")+'</ul>';
      }
      if (t.checks.length){
        h += '<h4>Ràng buộc ('+t.checks.length+')</h4><ul class="plain">'+
          t.checks.map(function(c){ return '<li>'+esc(c.name)+' &mdash; '+esc(c.def)+'</li>'; })
            .join("")+'</ul>';
      }
      if (t.indexes.length){
        h += '<h4>Index ('+t.indexes.length+')</h4><ul class="plain">'+
          t.indexes.map(function(i){
            return '<li>'+esc(i.def.replace(
              /^CREATE (UNIQUE )?INDEX (\S+) ON \S+ USING /, '$2 — '))+'</li>'; })
            .join("")+'</ul>';
      }
      h += '</div>';
    }
    h += '</div>';
    card.innerHTML = h;
    card.querySelector("header").onclick = function(){ select(t.name, true); };
    grid.appendChild(card);
  });

  /* ---------------------------------------------------------------- ERD */
  var SVG = "http://www.w3.org/2000/svg";
  var BW = 232, BH = 28, BGAP = 9, CGAP = 30, PAD = 16, HDR = 30;
  var pos = {}, maxRows = 0;
  M.groups.forEach(function(g, gi){
    maxRows = Math.max(maxRows, g.tables.length);
    var x = PAD + gi * (BW + CGAP);
    g.tables.forEach(function(n, ri){
      pos[n] = { x: x, y: PAD + HDR + ri * (BH + BGAP), g: g };
    });
  });
  var W = PAD * 2 + M.groups.length * BW + (M.groups.length - 1) * CGAP;
  var H = PAD * 2 + HDR + maxRows * (BH + BGAP);
  var svg = document.getElementById("erd");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("width", W); svg.setAttribute("height", H);

  function el(n, attrs, parent){
    var e = document.createElementNS(SVG, n);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e); return e;
  }
  var defs = el("defs", {});
  ["#94a3b8"].forEach(function(c, i){
    var m = el("marker", { id:"arrow"+i, viewBox:"0 0 10 10", refX:"9", refY:"5",
      markerWidth:"5", markerHeight:"5", orient:"auto-start-reverse" }, defs);
    el("path", { d:"M 0 0 L 10 5 L 0 10 z", fill:c }, m);
  });

  M.groups.forEach(function(g){
    var p = pos[g.tables[0]];
    el("text", { x:p.x, y:PAD + 14, class:"ghdr", fill:g.color },
       el("g", {})).textContent = g.label;
  });

  var edges = el("g", {});
  M.tables.forEach(function(t){
    t.fksOut.forEach(function(f){
      var a = pos[t.name], b = pos[f.table];
      if (!a || !b) return;
      var right = b.x >= a.x;
      var x1 = right ? a.x + BW : a.x, y1 = a.y + BH / 2;
      var x2 = right ? b.x : b.x + BW, y2 = b.y + BH / 2;
      var dx = Math.max(28, Math.abs(x2 - x1) * 0.42);
      var c1 = x1 + (right ? dx : -dx), c2 = x2 + (right ? -dx : dx);
      el("path", { class:"edge", d:"M "+x1+" "+y1+" C "+c1+" "+y1+", "+c2+" "+y2+
        ", "+x2+" "+y2, stroke:a.g.color, "marker-end":"url(#arrow0)",
        "data-child":t.name, "data-parent":f.table }, edges);
    });
  });

  var nodes = el("g", {});
  M.tables.forEach(function(t){
    var p = pos[t.name];
    var g = el("g", { class:"node", "data-table":t.name,
      transform:"translate("+p.x+","+p.y+")" }, nodes);
    el("rect", { width:BW, height:BH, rx:5 }, g);
    el("rect", { width:4, height:BH, rx:2, fill:p.g.color, stroke:"none" }, g);
    var lab = el("text", { x:12, y:18 }, g);
    lab.textContent = t.name;
    var n = el("text", { x:BW - 8, y:18, "text-anchor":"end", fill:"#9ca3af" }, g);
    n.textContent = t.cols.length;
    g.addEventListener("mouseenter", function(){ hover(t.name); });
    g.addEventListener("mouseleave", function(){ hover(null); });
    g.addEventListener("click", function(){ select(t.name, true); });
  });

  var selected = null;
  function hover(name){
    if (selected) return;
    applyHighlight(name);
  }
  function applyHighlight(name){
    var conn = {};
    if (name){
      conn[name] = 1;
      T[name].fksOut.forEach(function(f){ conn[f.table] = 1; });
      T[name].fksIn.forEach(function(f){ conn[f.table] = 1; });
    }
    Array.prototype.forEach.call(nodes.children, function(g){
      var n = g.dataset.table;
      g.classList.toggle("hl", !!name && !!conn[n] && n !== name);
      g.classList.toggle("dim", !!name && !conn[n]);
    });
    Array.prototype.forEach.call(edges.children, function(e){
      var on = !name || e.dataset.child === name || e.dataset.parent === name;
      e.classList.toggle("hl", !!name && on);
      e.classList.toggle("fade", !!name && !on);
    });
  }

  function select(name, scroll){
    selected = name;
    Array.prototype.forEach.call(nodes.children, function(g){
      g.classList.toggle("sel", g.dataset.table === name);
    });
    Array.prototype.forEach.call(grid.children, function(c){
      c.classList.toggle("sel", c.dataset.table === name);
    });
    applyHighlight(name);
    if (scroll){
      var card = document.getElementById("t-" + name);
      if (card) card.scrollIntoView({ behavior:"smooth", block:"center" });
    }
  }

  /* ---------------------------------------------------------------- filter */
  var q = document.getElementById("q");
  var onlyRel = document.getElementById("onlyRel");
  var count = document.getElementById("count");

  function matches(t, term){
    if (!term) return true;
    if (t.name.toLowerCase().indexOf(term) >= 0) return true;
    if (groupOf[t.name].label.toLowerCase().indexOf(term) >= 0) return true;
    return t.cols.some(function(c){
      return c.name.toLowerCase().indexOf(term) >= 0 ||
             c.type.toLowerCase().indexOf(term) >= 0;
    });
  }

  function apply(){
    var term = q.value.trim().toLowerCase();
    var relOnly = onlyRel.checked;
    var shown = 0;
    Array.prototype.forEach.call(grid.children, function(card){
      var t = byName[card.dataset.table];
      var ok = matches(t, term) && (!active.size || active.has(groupOf[t.name].key))
               && (!relOnly || t.fksOut.length || t.fksIn.length);
      card.classList.toggle("hide", !ok);
      if (ok) shown++;
      Array.prototype.forEach.call(card.querySelectorAll("tr[data-col]"), function(tr){
        tr.classList.toggle("hit", !!term &&
          (tr.dataset.col.toLowerCase().indexOf(term) >= 0 ||
           tr.textContent.toLowerCase().indexOf(term) >= 0));
      });
    });
    Array.prototype.forEach.call(nodes.children, function(g){
      var t = byName[g.dataset.table];
      var ok = matches(t, term) && (!active.size || active.has(groupOf[t.name].key))
               && (!relOnly || t.fksOut.length || t.fksIn.length);
      g.style.display = ok ? "" : "none";
      if (!ok) g.classList.remove("sel");
    });
    Array.prototype.forEach.call(edges.children, function(e){
      var a = byName[e.dataset.child], b = byName[e.dataset.parent];
      var ok = (!term || (matches(a, term) && matches(b, term))) &&
               (!active.size || (active.has(groupOf[a.name].key) &&
                                 active.has(groupOf[b.name].key))) &&
               (!relOnly || true);
      e.style.display = ok ? "" : "none";
    });
    count.textContent = shown + "/" + M.tables.length + " bảng";
  }

  q.addEventListener("input", apply);
  onlyRel.addEventListener("change", apply);
  apply();
})();
</script>
</body>
</html>
"""

HTML = (HTML.replace("__DATA__", json.dumps(model, ensure_ascii=False, separators=(",", ":")))
            .replace("__NT__", str(len(tables)))
            .replace("__NC__", str(n_cols))
            .replace("__NFK__", str(n_fk))
            .replace("__NUQ__", str(n_uniq))
            .replace("__NCH__", str(n_check))
            .replace("__NE__", str(len(enums)))
            .replace("__NIX__", str(n_idx))
            .replace("__NNN__", str(n_nn))
            .replace("__NNULL__", str(n_null)))

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(HTML)

print(f"wrote {OUT}")
print(f"tables={len(tables)} cols={n_cols} fks={n_fk} unique={n_uniq} "
      f"checks={n_check} enums={len(enums)} indexes={n_idx} "
      f"notnull={n_nn} nullable={n_null}")
