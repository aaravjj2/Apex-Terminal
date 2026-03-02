import React, { useState, useCallback } from 'react';
import {
  FileText, Tag, Clock, Users, Download, Plus, Search,
  ChevronRight, Star, Trash2, Edit3, Eye, BookOpen,
  Link2, Hash, CheckSquare, Square, MoreHorizontal,
  ArrowLeft, Save, X, Copy, FolderOpen, Calendar,
} from 'lucide-react';

// --- Types ---

interface ResearchNote {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  symbols: string[];
  created: string;
  updated: string;
  author: string;
  starred: boolean;
  shared: boolean;
  version: number;
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface Citation {
  id: string;
  title: string;
  source: string;
  url: string;
  date: string;
}

interface VersionEntry {
  version: number;
  date: string;
  author: string;
  changes: string;
}

// --- Mock Data ---

const CATEGORIES = ['Equity Analysis', 'Macro Research', 'Sector Notes', 'Trade Ideas', 'Earnings', 'Technical', 'Risk Assessment'];

const MOCK_NOTES: ResearchNote[] = [
  { id: 'n1', title: 'AAPL Q4 Earnings Analysis', content: '## Apple Q4 2024 Earnings\n\n**Revenue**: $89.5B (+5.5% YoY)\n**EPS**: $1.64 (beat by $0.06)\n\n### Key Takeaways\n\n1. iPhone revenue grew 6% driven by iPhone 15 Pro demand\n2. Services segment hit new ATH at $22.3B\n3. Greater China showed signs of recovery\n4. Guidance suggests strong holiday quarter\n\n### Valuation\n\nAt current levels ($189), the stock trades at 31x forward earnings. Given the services growth trajectory and installed base monetization potential, this premium seems justified.\n\n**Price Target**: $210 (+11% upside)\n**Rating**: Overweight\n\n### Risks\n- Regulatory headwinds (EU DMA compliance)\n- China competition from Huawei\n- AI integration execution risk', category: 'Earnings', tags: ['earnings', 'tech', 'mega-cap'], symbols: ['AAPL'], created: '2025-02-15', updated: '2025-02-28', author: 'Research Desk', starred: true, shared: true, version: 3 },
  { id: 'n2', title: 'AI Infrastructure Thesis', content: '## The AI Infrastructure Buildout\n\nData center capex is accelerating as hyperscalers race to build AI compute capacity.\n\n### Key Beneficiaries\n- **NVDA**: GPU monopoly, CUDA moat\n- **AVGO**: Custom ASIC opportunity\n- **ANET**: Data center networking\n- **EQIX**: Colocation capacity\n\n### Risk/Reward\nThe sector is priced for perfection. Any capex deceleration signal could trigger a correction.\n\n**Preferred Trade**: Long NVDA / Short SMH as a relative value play.', category: 'Trade Ideas', tags: ['AI', 'infrastructure', 'capex'], symbols: ['NVDA', 'AVGO', 'ANET', 'EQIX'], created: '2025-02-20', updated: '2025-02-27', author: 'Research Desk', starred: true, shared: false, version: 2 },
  { id: 'n3', title: 'Fed Rate Path Analysis', content: '## Federal Reserve Rate Outlook\n\nThe market is pricing in 3 rate cuts for 2025, starting June.\n\n### Our View\nWe expect only 2 cuts, beginning in September, as inflation proves stickier than expected.\n\n### Implications\n- Duration: Underweight vs benchmark\n- Credit: Prefer IG over HY\n- Equities: Favor quality over growth', category: 'Macro Research', tags: ['fed', 'rates', 'monetary-policy'], symbols: [], created: '2025-02-10', updated: '2025-02-25', author: 'Macro Desk', starred: false, shared: true, version: 4 },
  { id: 'n4', title: 'Semiconductor Cycle Positioning', content: '## Semi Cycle Analysis\n\nMemory is in early upcycle. Logic facing mixed signals from China export restrictions.', category: 'Sector Notes', tags: ['semis', 'cycle', 'memory'], symbols: ['MU', 'INTC', 'TSM', 'ASML'], created: '2025-02-05', updated: '2025-02-22', author: 'Research Desk', starred: false, shared: false, version: 1 },
  { id: 'n5', title: 'Risk Assessment: China Tariffs', content: '## China Tariff Scenario Analysis\n\nEvaluating portfolio impact under 3 tariff scenarios.', category: 'Risk Assessment', tags: ['risk', 'china', 'tariffs', 'geopolitics'], symbols: ['AAPL', 'TSLA', 'NKE'], created: '2025-01-28', updated: '2025-02-18', author: 'Risk Desk', starred: false, shared: true, version: 2 },
];

const MOCK_TODOS: TodoItem[] = [
  { id: 'q1', text: 'Review NVDA earnings call transcript', done: false, priority: 'high' },
  { id: 'q2', text: 'Update sector rotation model', done: false, priority: 'medium' },
  { id: 'q3', text: 'Analyze JPM credit spread data', done: true, priority: 'medium' },
  { id: 'q4', text: 'Write up China PMI implications', done: false, priority: 'high' },
  { id: 'q5', text: 'Screen for value stocks in healthcare', done: false, priority: 'low' },
  { id: 'q6', text: 'Backtest momentum factor rotation', done: true, priority: 'medium' },
];

const MOCK_CITATIONS: Citation[] = [
  { id: 'c1', title: 'Apple 10-K Filing', source: 'SEC EDGAR', url: 'https://sec.gov/...', date: '2024-11-01' },
  { id: 'c2', title: 'Global Semiconductor Market Report', source: 'WSTS', url: 'https://wsts.org/...', date: '2025-01-15' },
  { id: 'c3', title: 'Federal Reserve Meeting Minutes', source: 'Federal Reserve', url: 'https://fed.gov/...', date: '2025-02-05' },
];

const MOCK_VERSIONS: VersionEntry[] = [
  { version: 3, date: '2025-02-28', author: 'Research Desk', changes: 'Updated price target and risk factors' },
  { version: 2, date: '2025-02-20', author: 'Research Desk', changes: 'Added valuation section and chart snapshot' },
  { version: 1, date: '2025-02-15', author: 'Research Desk', changes: 'Initial draft' },
];

// --- Main Component ---

export const ResearchWorkspace: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [notes, setNotes] = useState<ResearchNote[]>(MOCK_NOTES);
  const [selectedNote, setSelectedNote] = useState<string | null>('n1');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sidePanel, setSidePanel] = useState<'notes' | 'queue' | 'citations' | 'versions'>('notes');
  const [todos, setTodos] = useState<TodoItem[]>(MOCK_TODOS);
  const [showCollaborators, setShowCollaborators] = useState(false);

  const activeNote = notes.find((n) => n.id === selectedNote);

  const filteredNotes = notes.filter((n) => {
    const matchSearch = !searchQuery || n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.tags.some((t) => t.includes(searchQuery.toLowerCase()));
    const matchCat = filterCategory === 'all' || n.category === filterCategory;
    return matchSearch && matchCat;
  });

  const startEditing = useCallback(() => {
    if (activeNote) {
      setEditContent(activeNote.content);
      setEditing(true);
    }
  }, [activeNote]);

  const saveEdit = useCallback(() => {
    if (activeNote) {
      setNotes((prev) => prev.map((n) => n.id === activeNote.id ? { ...n, content: editContent, updated: new Date().toISOString().slice(0, 10), version: n.version + 1 } : n));
      setEditing(false);
    }
  }, [activeNote, editContent]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, starred: !n.starred } : n));
  }, []);

  return (
    <div className={`flex h-full bg-[#0a0a14] text-gray-300 font-mono ${className}`}>
      {/* Left Sidebar */}
      <div className="w-72 border-r border-[#1a1a2e] flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="px-3 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a] flex items-center justify-between">
          <div className="flex items-center gap-0.5 bg-[#0a0a14] rounded p-0.5">
            {(['notes', 'queue', 'citations', 'versions'] as const).map((tab) => (
              <button key={tab} onClick={() => setSidePanel(tab)} className={`px-2 py-1 text-[10px] rounded transition-colors capitalize ${sidePanel === tab ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {sidePanel === 'notes' && (
          <>
            {/* Search & Filter */}
            <div className="p-2 border-b border-[#1a1a2e] space-y-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes…"
                  className="w-full bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs pl-7 pr-2 py-1.5 rounded focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-[#12121f] border border-[#1a1a2e] text-gray-300 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-amber-500/50"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => { setSelectedNote(note.id); setEditing(false); }}
                  className={`w-full text-left p-2.5 rounded border transition-colors ${selectedNote === note.id ? 'bg-amber-500/10 border-amber-900/40' : 'bg-[#0d0d1a] border-[#1a1a2e] hover:border-amber-900/20'}`}
                >
                  <div className="flex items-center gap-1.5">
                    {note.starred && <Star size={10} className="text-amber-400 fill-amber-400" />}
                    <span className="text-xs text-gray-200 font-medium truncate">{note.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-gray-500">{note.category}</span>
                    <span className="text-[9px] text-gray-600">{note.updated}</span>
                    {note.shared && <Users size={8} className="text-[#6699ff]" />}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {note.symbols.slice(0, 3).map((s) => (
                      <span key={s} className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">${s}</span>
                    ))}
                    {note.symbols.length > 3 && <span className="text-[9px] text-gray-600">+{note.symbols.length - 3}</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* New Note */}
            <div className="p-2 border-t border-[#1a1a2e]">
              <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30 transition-colors">
                <Plus size={12} /> New Note
              </button>
            </div>
          </>
        )}

        {sidePanel === 'queue' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1 mb-2">Research Queue</div>
            {todos.map((item) => (
              <div key={item.id} className={`flex items-start gap-2 p-2 rounded border border-[#1a1a2e] bg-[#0d0d1a] ${item.done ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleTodo(item.id)} className="mt-0.5 text-gray-500 hover:text-amber-400">
                  {item.done ? <CheckSquare size={12} className="text-[#00cc66]" /> : <Square size={12} />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${item.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>{item.text}</span>
                </div>
                <span className={`text-[9px] px-1 py-0.5 rounded ${item.priority === 'high' ? 'bg-[#ff3333]/20 text-[#ff3333]' : item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-600/20 text-gray-500'}`}>
                  {item.priority}
                </span>
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-1 py-2 rounded border border-dashed border-[#1a1a2e] text-gray-600 text-xs hover:text-gray-400 hover:border-gray-600 transition-colors mt-2">
              <Plus size={10} /> Add Item
            </button>
          </div>
        )}

        {sidePanel === 'citations' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1 mb-2">Citations & Sources</div>
            {MOCK_CITATIONS.map((c) => (
              <div key={c.id} className="p-2 rounded border border-[#1a1a2e] bg-[#0d0d1a]">
                <div className="text-xs text-gray-300 font-medium">{c.title}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  <span className="text-[#6699ff]">{c.source}</span>
                  <span className="text-gray-600">{c.date}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <button className="text-[10px] text-gray-500 hover:text-amber-400 flex items-center gap-0.5"><Link2 size={9} /> Link</button>
                  <button className="text-[10px] text-gray-500 hover:text-amber-400 flex items-center gap-0.5 ml-2"><Copy size={9} /> Cite</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {sidePanel === 'versions' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider px-1 mb-2">Version History</div>
            {MOCK_VERSIONS.map((v) => (
              <div key={v.version} className="p-2 rounded border border-[#1a1a2e] bg-[#0d0d1a]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-medium">v{v.version}</span>
                  <span className="text-[10px] text-gray-600">{v.date}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{v.author}</div>
                <div className="text-[10px] text-gray-400 mt-1">{v.changes}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeNote ? (
          <>
            {/* Note Header */}
            <div className="px-4 py-2 border-b border-[#1a1a2e] bg-[#0d0d1a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-gray-200">{activeNote.title}</h2>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-gray-500">{activeNote.category}</span>
                  <span className="text-[10px] text-gray-600">v{activeNote.version}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleStar(activeNote.id)} className={`p-1 ${activeNote.starred ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'}`}>
                    <Star size={14} fill={activeNote.starred ? 'currentColor' : 'none'} />
                  </button>
                  {!editing ? (
                    <button onClick={startEditing} className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 bg-amber-500/20 rounded hover:bg-amber-500/30 transition-colors">
                      <Edit3 size={12} /> Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={saveEdit} className="flex items-center gap-1 px-2 py-1 text-xs text-[#00cc66] bg-[#00cc66]/20 rounded hover:bg-[#00cc66]/30 transition-colors">
                        <Save size={12} /> Save
                      </button>
                      <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-[#1a1a2e] rounded hover:bg-[#2a2a3e] transition-colors">
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  )}
                  <button className="p-1 text-gray-600 hover:text-gray-400"><Download size={14} /></button>
                  <button onClick={() => setShowCollaborators((s) => !s)} className="p-1 text-gray-600 hover:text-gray-400"><Users size={14} /></button>
                </div>
              </div>
              {/* Tags & Symbols */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <Tag size={10} className="text-gray-600" />
                  {activeNote.tags.map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-gray-400">#{tag}</span>
                  ))}
                </div>
                <div className="h-3 w-px bg-[#1a1a2e]" />
                <div className="flex items-center gap-1">
                  {activeNote.symbols.map((s) => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">${s}</span>
                  ))}
                </div>
                <div className="flex-1" />
                <span className="text-[10px] text-gray-600">Updated {activeNote.updated} by {activeNote.author}</span>
              </div>
            </div>

            {/* Note Content */}
            <div className="flex-1 overflow-auto">
              {editing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-[#0a0a14] text-gray-300 text-sm p-4 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              ) : (
                <div className="p-4 prose prose-invert prose-sm max-w-none">
                  {activeNote.content.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-amber-400 text-base font-bold mt-4 mb-2 border-b border-[#1a1a2e] pb-1">{line.slice(3)}</h2>;
                    if (line.startsWith('### ')) return <h3 key={i} className="text-gray-200 text-sm font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-gray-200 font-bold text-xs my-0.5">{line.slice(2, -2)}</p>;
                    if (line.startsWith('- **')) {
                      const parts = line.slice(2).split('**');
                      return <div key={i} className="flex items-start gap-1.5 text-xs my-0.5 ml-2"><span className="text-gray-600 mt-0.5">•</span><span><span className="text-amber-400 font-medium">{parts[1]}</span>{parts[2]}</span></div>;
                    }
                    if (line.startsWith('- ')) return <div key={i} className="flex items-start gap-1.5 text-xs my-0.5 ml-2 text-gray-400"><span className="text-gray-600 mt-0.5">•</span>{line.slice(2)}</div>;
                    if (line.match(/^\d+\./)) return <div key={i} className="text-xs text-gray-300 my-0.5 ml-2">{line}</div>;
                    if (line.startsWith('**') && line.includes('**:')) {
                      const [label, ...rest] = line.split('**:');
                      return <div key={i} className="text-xs my-0.5"><span className="text-gray-200 font-medium">{label.replace(/\*\*/g, '')}</span>:{rest.join('**:')}</div>;
                    }
                    if (line.trim() === '') return <div key={i} className="h-2" />;
                    return <p key={i} className="text-xs text-gray-400 my-0.5 leading-relaxed">{line}</p>;
                  })}
                </div>
              )}
            </div>

            {/* Chart Snapshot Area */}
            <div className="border-t border-[#1a1a2e] bg-[#0c0c18] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px]">
                <button className="flex items-center gap-1 text-gray-500 hover:text-amber-400 transition-colors">
                  <BookOpen size={10} /> Embed Chart
                </button>
                <button className="flex items-center gap-1 text-gray-500 hover:text-amber-400 transition-colors">
                  <Link2 size={10} /> Link Data
                </button>
                <button className="flex items-center gap-1 text-gray-500 hover:text-amber-400 transition-colors">
                  <Hash size={10} /> Add Symbol
                </button>
                <button className="flex items-center gap-1 text-gray-500 hover:text-amber-400 transition-colors">
                  <Download size={10} /> Export PDF
                </button>
              </div>
              <div className="text-[10px] text-gray-600">
                {activeNote.content.split(/\s+/).length} words • v{activeNote.version}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">Select a note or create a new one</div>
            </div>
          </div>
        )}
      </div>

      {/* Collaborators Panel */}
      {showCollaborators && (
        <div className="w-56 border-l border-[#1a1a2e] flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-[#1a1a2e] flex items-center justify-between bg-[#0d0d1a]">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Collaborators</span>
            <button onClick={() => setShowCollaborators(false)} className="text-gray-600 hover:text-gray-400"><X size={12} /></button>
          </div>
          <div className="p-2 space-y-2">
            {[
              { name: 'Research Desk', role: 'Owner', online: true },
              { name: 'Macro Desk', role: 'Editor', online: true },
              { name: 'Risk Desk', role: 'Viewer', online: false },
              { name: 'Trading Desk', role: 'Viewer', online: false },
            ].map((user) => (
              <div key={user.name} className="flex items-center gap-2 p-2 bg-[#0d0d1a] rounded border border-[#1a1a2e]">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-[#1a1a2e] flex items-center justify-center text-[9px] text-gray-400 font-bold">{user.name[0]}</div>
                  {user.online && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#00cc66] rounded-full border border-[#0a0a14]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-300 truncate">{user.name}</div>
                  <div className="text-[9px] text-gray-600">{user.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-[#1a1a2e] mt-auto">
            <button className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-amber-400 bg-amber-500/20 rounded hover:bg-amber-500/30 transition-colors">
              <Plus size={10} /> Invite
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchWorkspace;
