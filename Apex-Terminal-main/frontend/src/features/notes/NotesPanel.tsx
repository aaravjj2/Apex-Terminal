import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Tag, RefreshCw } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

interface Note {
    id: string;
    content: string;
    anchor_type: string;
    anchor_id?: string;
    anchor_timestamp?: string;
    symbol?: string;
    created_at: string;
    updated_at: string;
    tags: string[];
}

export function NotesPanel() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [newAnchorType, setNewAnchorType] = useState('time');
    const [newTags, setNewTags] = useState('');

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/notes`);
            if (res.ok) {
                setNotes(await res.json());
            }
        } catch (e) {
            console.error('Failed to fetch notes:', e);
        } finally {
            setLoading(false);
        }
    };

    const createNote = async () => {
        try {
            const res = await fetch(`${API_BASE}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newContent,
                    anchor_type: newAnchorType,
                    tags: newTags.split(',').map(t => t.trim()).filter(Boolean)
                })
            });
            if (res.ok) {
                setShowCreate(false);
                setNewContent('');
                setNewTags('');
                fetchNotes();
            }
        } catch (e) {
            console.error('Failed to create note:', e);
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        try {
            await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' });
            fetchNotes();
        } catch (e) {
            console.error('Failed to delete note:', e);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-full flex flex-col bg-[#131722]">
            {/* Header */}
            <div className="h-10 border-b border-[#2a2e39] flex items-center px-4 justify-between bg-[#1e222d]">
                <div className="flex items-center gap-2">
                    <StickyNote size={16} className="text-yellow-400" />
                    <span className="text-sm font-bold text-[#d1d4dc]">Journal</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchNotes} className="p-1 hover:bg-[#2a2e39] rounded">
                        <RefreshCw size={14} className={`text-[#787b86] ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1 px-2 py-1 bg-[#2962ff] text-white text-xs rounded"
                    >
                        <Plus size={12} /> Add
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-3 border-b border-[#2a2e39] bg-[#1e222d] space-y-2">
                    <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="Write your note..."
                        className="w-full h-20 bg-[#131722] text-[#d1d4dc] p-2 text-xs rounded border border-[#2a2e39] resize-none"
                    />
                    <div className="flex gap-2">
                        <select
                            value={newAnchorType}
                            onChange={(e) => setNewAnchorType(e.target.value)}
                            className="bg-[#131722] text-[#d1d4dc] text-xs p-1.5 rounded border border-[#2a2e39]"
                        >
                            <option value="time">General</option>
                            <option value="bar">Bar</option>
                            <option value="trade">Trade</option>
                            <option value="order">Order</option>
                        </select>
                        <input
                            type="text"
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            placeholder="Tags (comma-separated)"
                            className="flex-1 bg-[#131722] text-[#d1d4dc] text-xs p-1.5 rounded border border-[#2a2e39]"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-xs text-[#787b86]">Cancel</button>
                        <button onClick={createNote} className="px-3 py-1 bg-[#089981] text-white text-xs rounded">Save</button>
                    </div>
                </div>
            )}

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {notes.length === 0 ? (
                    <div className="text-center text-[#787b86] text-xs py-8">
                        No notes yet. Click "Add" to create one.
                    </div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="bg-[#1e222d] border border-[#2a2e39] rounded p-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs text-[#d1d4dc] whitespace-pre-wrap">{note.content}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] px-1.5 py-0.5 bg-[#2a2e39] text-[#787b86] rounded">{note.anchor_type}</span>
                                        {note.tags.map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#2962ff]/20 text-[#2962ff] rounded flex items-center gap-0.5">
                                                <Tag size={8} /> {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="text-[10px] text-[#787b86] mt-1">{formatDate(note.created_at)}</div>
                                </div>
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    className="p-1 hover:bg-[#2a2e39] rounded text-[#787b86] hover:text-red-400"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
