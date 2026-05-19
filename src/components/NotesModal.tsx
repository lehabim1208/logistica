import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface NotesModalProps {
  onClose: () => void;
}

export function NotesModal({ onClose }: NotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('logiruta_notes');
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) { }
    }
  }, []);

  const saveNotes = (updated: Note[]) => {
    setNotes(updated);
    localStorage.setItem('logiruta_notes', JSON.stringify(updated));
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Math.random().toString(36).substring(7),
      content: newNote.trim(),
      createdAt: new Date().toISOString()
    };
    saveNotes([note, ...notes]);
    setNewNote('');
    toast.success('Nota agregada');
  };

  const handleDelete = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    toast.success('Nota borrada');
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = (id: string) => {
    if (!editContent.trim()) {
      handleDelete(id);
      return;
    }
    const updated = notes.map(n => n.id === id ? { ...n, content: editContent.trim() } : n);
    saveNotes(updated);
    setEditingId(null);
    toast.success('Nota actualizada');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl flex flex-col h-[80vh] animate-in zoom-in-95">
        
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Notas Rápidas</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escribe una nueva nota..."
              className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-900 dark:text-white"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8 text-sm">No tienes notas rápidas guardadas.</p>
            ) : (
              notes.map(note => (
                <div key={note.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 group">
                  {editingId === note.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 p-2 text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg outline-none text-gray-900 dark:text-white"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(note.id); }}
                      />
                      <button onClick={() => saveEdit(note.id)} className="p-2 text-green-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg">
                        <Save className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(note)} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors">
                          <Edit2 className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                        <button onClick={() => handleDelete(note.id)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
