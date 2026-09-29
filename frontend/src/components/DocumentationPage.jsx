import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Search, ChevronRight, Info, AlertTriangle, CheckCircle, ShieldAlert, X, Check } from 'lucide-react';
import { DOC_META, SECTIONS } from './documentation/content';

/**
 * In-app documentation handbook (Sidebar -> Documentation).
 *
 * All copy lives in ./documentation/content.js as typed blocks so this file only
 * handles presentation: search, section navigation, expand/collapse and printing.
 * Styling follows the rest of the SPA (Tailwind, isDarkMode prop passed from App).
 */

const NOTE_STYLES = {
  info: { icon: Info, light: 'border-cyan-200 bg-cyan-50 text-cyan-900', dark: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100' },
  warn: { icon: AlertTriangle, light: 'border-amber-200 bg-amber-50 text-amber-900', dark: 'border-amber-500/40 bg-amber-500/10 text-amber-100' },
  ok: { icon: CheckCircle, light: 'border-emerald-200 bg-emerald-50 text-emerald-900', dark: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' },
  danger: { icon: ShieldAlert, light: 'border-rose-200 bg-rose-50 text-rose-900', dark: 'border-rose-500/40 bg-rose-500/10 text-rose-100' },
};

// Renders **bold** spans inside a string without pulling in a markdown library.
function Inline({ text, isDarkMode }) {
  const parts = String(text).split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((part, index) => (index % 2 === 1
        ? (
          <strong key={index} className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {part}
          </strong>
        )
        : <span key={index}>{part}</span>))}
    </>
  );
}

function CodeBlock({ code, isDarkMode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <pre className={`${isDarkMode ? 'bg-slate-950/70 border-slate-700 text-slate-200' : 'bg-slate-900 border-slate-800 text-slate-100'} overflow-x-auto rounded-xl border p-4 font-mono text-[11px] leading-relaxed`}>
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-slate-700/80 px-2 py-1 text-[10px] font-semibold text-slate-100 transition-all hover:bg-slate-600"
      >
        {copied ? <Check size={11} /> : null}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Block({ block, isDarkMode }) {
  const body = isDarkMode ? 'text-slate-300' : 'text-slate-600';

  if (block.t === 'p') {
    return <p className={`text-sm leading-relaxed ${body}`}><Inline text={block.v} isDarkMode={isDarkMode} /></p>;
  }

  if (block.t === 'ul') {
    return (
      <ul className="space-y-1.5">
        {block.v.map((item, index) => (
          <li key={index} className={`flex gap-2 text-sm leading-relaxed ${body}`}>
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span><Inline text={item} isDarkMode={isDarkMode} /></span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.t === 'steps') {
    return (
      <ol className="space-y-2">
        {block.v.map((item, index) => (
          <li key={index} className={`flex gap-3 text-sm leading-relaxed ${body}`}>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <span><Inline text={item} isDarkMode={isDarkMode} /></span>
          </li>
        ))}
      </ol>
    );
  }

  if (block.t === 'code') {
    return <CodeBlock code={block.v} isDarkMode={isDarkMode} />;
  }

  if (block.t === 'note') {
    const style = NOTE_STYLES[block.kind] || NOTE_STYLES.info;
    const Icon = style.icon;
    return (
      <div className={`flex gap-3 rounded-xl border px-4 py-3 ${isDarkMode ? style.dark : style.light}`}>
        <Icon size={16} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed"><Inline text={block.v} isDarkMode={isDarkMode} /></p>
      </div>
    );
  }

  if (block.t === 't') {
    const headCell = isDarkMode ? 'border-slate-700 bg-slate-800/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600';
    const cell = isDarkMode ? 'border-slate-700/70 text-slate-300' : 'border-slate-100 text-slate-600';
    return (
      <div className={`${isDarkMode ? 'border-slate-700' : 'border-slate-200'} overflow-x-auto rounded-xl border`}>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              {block.head.map((heading) => (
                <th key={heading} className={`${headCell} border-b px-3 py-2 font-semibold uppercase tracking-wider`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 1 ? (isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/60') : ''}>
                {row.map((cellValue, cellIndex) => (
                  <td key={cellIndex} className={`${cell} border-b px-3 py-2 align-top leading-relaxed`}>
                    <Inline text={cellValue} isDarkMode={isDarkMode} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

const blockText = (block) => [block.v, block.head, block.rows].filter(Boolean).flat(2).join(' ');

const sectionText = (section) => [section.title, section.summary, ...section.blocks.map(blockText)].join(' ').toLowerCase();

export default function DocumentationPage({ isDarkMode = false }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const sectionRefs = useRef({});

  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? SECTIONS.filter((section) => sectionText(section).includes(term)) : SECTIONS),
    [term],
  );

  const groups = useMemo(() => {
    const ordered = new Map();
    filtered.forEach((section) => {
      if (!ordered.has(section.group)) ordered.set(section.group, []);
      ordered.get(section.group).push(section);
    });
    return [...ordered.entries()];
  }, [filtered]);

  useEffect(() => {
    if (term) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setActiveId(visible[0].target.dataset.docId);
    }, { rootMargin: '-110px 0px -60% 0px', threshold: 0 });

    filtered.forEach((section) => {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [filtered, term]);

  const toggle = (id) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goTo = (id) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    setActiveId(id);
    requestAnimationFrame(() => {
      const node = sectionRefs.current[id];
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const panel = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const heading = isDarkMode ? 'text-white' : 'text-slate-800';
  const chip = isDarkMode ? 'border-slate-700 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className={`flex items-center gap-2 text-lg font-bold ${heading}`}>
            <BookOpen size={20} className="text-cyan-600" />
            {DOC_META.product} - documentation
          </h3>
          <p className="text-xs text-slate-500">
            How the system works, why it works that way, and what to do when it does not.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${chip}`}>{DOC_META.version}</span>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${chip}`}>Updated {DOC_META.updated}</span>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${chip}`}>
              {filtered.length} of {SECTIONS.length} sections
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the manual (stock, void, role, idempotency...)"
              className={`${panel} w-72 max-w-full rounded-xl border py-2 pl-9 pr-8 text-xs outline-none focus:border-cyan-500`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-rose-500"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button type="button" onClick={() => setCollapsed(new Set())} className={`${panel} rounded-xl border px-3 py-2 text-[11px] font-semibold text-slate-500 transition-all hover:text-cyan-600`}>
            Expand all
          </button>
          <button type="button" onClick={() => setCollapsed(new Set(SECTIONS.map((section) => section.id)))} className={`${panel} rounded-xl border px-3 py-2 text-[11px] font-semibold text-slate-500 transition-all hover:text-cyan-600`}>
            Collapse all
          </button>
          <button type="button" onClick={() => window.print()} className={`${panel} rounded-xl border px-3 py-2 text-[11px] font-semibold text-slate-500 transition-all hover:text-cyan-600`}>
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav className={`${panel} hidden self-start rounded-xl border p-3 lg:sticky lg:top-4 lg:block`}>
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">On this page</p>
          {groups.map(([group, items]) => (
            <div key={group} className="mb-3 last:mb-0">
              <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600/80">{group}</p>
              <div className="space-y-0.5">
                {items.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goTo(section.id)}
                    className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-[11px] transition-all ${
                      activeId === section.id
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 font-semibold text-white'
                        : isDarkMode ? 'text-slate-400 hover:bg-slate-700/40 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-1 text-[11px] text-slate-500">Nothing matches that search.</p>}
        </nav>
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className={`${panel} rounded-xl border p-6 text-center`}>
              <p className={`text-sm font-semibold ${heading}`}>No section mentions “{query}”.</p>
              <p className="mt-1 text-xs text-slate-500">Try a shorter word, or clear the search to browse every section.</p>
              <button type="button" onClick={() => setQuery('')} className="mt-3 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white">
                Clear search
              </button>
            </div>
          )}

          {filtered.map((section) => {
            const open = !collapsed.has(section.id);
            return (
              <section
                key={section.id}
                id={`docs-${section.id}`}
                data-doc-id={section.id}
                ref={(node) => { sectionRefs.current[section.id] = node; }}
                className={`${panel} scroll-mt-24 rounded-xl border`}
              >
                <button type="button" onClick={() => toggle(section.id)} className="flex w-full items-start gap-3 p-4 text-left">
                  <ChevronRight size={14} className={`mt-1 shrink-0 text-cyan-600 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-bold ${heading}`}>{section.title}</h4>
                    <p className="text-[11px] text-slate-500">{section.summary}</p>
                  </div>
                  <span className={`hidden shrink-0 rounded-lg border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider sm:inline ${chip}`}>
                    {section.group}
                  </span>
                </button>
                {open && (
                  <div className={`${isDarkMode ? 'border-slate-700/70' : 'border-slate-100'} space-y-4 border-t px-4 py-4`}>
                    {section.blocks.map((block, index) => (
                      <Block key={index} block={block} isDarkMode={isDarkMode} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <div className={`${panel} rounded-xl border p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Other sources of truth</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>
                <strong className={heading}>SYSTEM_DOCUMENTATION.md</strong> - full architecture, model reference, permissions matrix, migration history and deployment notes.
              </li>
              <li>
                <strong className={heading}>backend/README.md</strong> - backend quick start and the checklist for adding an endpoint the right way.
              </li>
              <li>
                <a href="http://localhost:8000/api/docs/" target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
                  http://localhost:8000/api/docs/
                </a>{' '}
                - interactive API reference; <span className="font-mono text-[11px]">/api/redoc/</span> is the readable version.
              </li>
              <li>
                This page is edited in <span className="font-mono text-[11px]">frontend/src/components/documentation/content.js</span> - no backend change and no migration needed.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
