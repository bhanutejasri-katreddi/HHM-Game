import React, { useState, useRef } from 'react';
import { 
  X, Upload, Download, FileSpreadsheet, CheckCircle2, 
  AlertTriangle, AlertCircle, Info, FileText, Loader2, Sparkles
} from 'lucide-react';
import { Button } from './ui/Button';
import { 
  parseQuestionsFromCSV, 
  downloadSampleCSV, 
  type ParsedQuestionRow 
} from '../utils/csvHelper';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number, skipped: number) => void;
  getAuthHeaders: () => Record<string, string>;
}

export function CsvImportModal({ isOpen, onClose, onSuccess, getAuthHeaders }: CsvImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<{
    rows: ParsedQuestionRow[];
    validCount: number;
    invalidCount: number;
    total: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setErrorMessage(null);
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErrorMessage('Please select a valid .csv file.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      const result = parseQuestionsFromCSV(content);
      setParsedData(result);
      if (result.rows.length === 0) {
        setErrorMessage('The selected CSV file appears to be empty.');
      } else if (result.validCount === 0) {
        setErrorMessage('No valid question rows found. Please ensure required columns (Clue, Hero, Heroine, Movie) are present.');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setCsvContent('');
    setParsedData(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportSubmit = async () => {
    if (!csvContent || !parsedData || parsedData.validCount === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // Filter only valid questions to send
      const validQuestions = parsedData.rows
        .filter(r => r.isValid)
        .map(r => ({
          clue_letters: r.clue_letters,
          hero_name: r.hero_name,
          heroine_name: r.heroine_name,
          movie_name: r.movie_name,
          points: r.points
        }));

      const res = await fetch((import.meta.env.VITE_SERVER_URL || 'http://localhost:3001') + '/api/admin/questions/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          csvData: csvContent,
          questions: validQuestions
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import questions');
      }

      onSuccess(data.count || parsedData.validCount, parsedData.invalidCount);
      resetSelection();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Error occurred while importing questions to the server.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in overflow-y-auto">
      <div className="relative w-full max-w-4xl my-8 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand/20 text-brand border border-brand/30">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white">Import Questions from CSV</h2>
              <p className="text-xs text-slate-400">Bulk upload questions to the game bank in seconds</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* CSV Format Specifications Card */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                <Info size={18} className="text-indigo-400" />
                <span>Required CSV Columns & Format</span>
              </div>
              <Button 
                variant="secondary" 
                onClick={downloadSampleCSV}
                className="gap-2 text-xs py-1.5 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 text-indigo-200"
              >
                <Download size={14} /> Download Sample Template (.csv)
              </Button>
            </div>

            <p className="text-xs text-slate-300">
              Your CSV file should have a header row with the following column names (order is flexible):
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-white/10 rounded-lg overflow-hidden">
                <thead className="bg-black/40 text-slate-300 uppercase tracking-wider font-semibold border-b border-white/10">
                  <tr>
                    <th className="p-2.5">Column Header</th>
                    <th className="p-2.5">Requirement</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Sample Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-brand-light font-bold">Clue</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase">Required</span></td>
                    <td className="p-2.5">Initials or clue letters shown to students</td>
                    <td className="p-2.5 font-mono text-slate-400">MSD, BB, PK</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-brand-light font-bold">Hero</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase">Required</span></td>
                    <td className="p-2.5">Lead Actor name</td>
                    <td className="p-2.5 text-slate-400">Prabhas, Allu Arjun</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-brand-light font-bold">Heroine</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase">Required</span></td>
                    <td className="p-2.5">Lead Actress name</td>
                    <td className="p-2.5 text-slate-400">Anushka, Samantha</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-brand-light font-bold">Movie</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase">Required</span></td>
                    <td className="p-2.5">Movie Title</td>
                    <td className="p-2.5 text-slate-400">Baahubali, Dookudu</td>
                  </tr>
                  <tr className="hover:bg-white/5">
                    <td className="p-2.5 font-mono text-brand-light font-bold">Points</td>
                    <td className="p-2.5"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">Optional</span></td>
                    <td className="p-2.5">Points for question (Default is 1)</td>
                    <td className="p-2.5 font-mono text-slate-400">1, 2, 5</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400 shrink-0" />
              <span>
                <strong>Smart column aliases supported:</strong> <code>clue_letters</code>, <code>hero_name</code>, <code>heroine_name</code>, <code>movie_name</code>, <code>actor</code>, <code>actress</code>, <code>film</code>, <code>score</code>.
              </span>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div>
            <input 
              type="file" 
              accept=".csv,text/csv,text/plain" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }} 
            />

            {!selectedFile ? (
              <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-brand bg-brand/10 scale-[1.01]' 
                    : 'border-white/20 hover:border-brand/50 hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 rounded-full bg-brand/10 text-brand border border-brand/20">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">Click or drag & drop your CSV file here</p>
                    <p className="text-xs text-slate-400 mt-1">Supports UTF-8 CSV or TXT files</p>
                  </div>
                  <Button variant="secondary" type="button" className="mt-2 text-xs py-2 px-4 gap-2 pointer-events-none">
                    <FileText size={14} /> Choose CSV File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-brand/20 text-brand">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {parsedData?.total || 0} total rows found
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs py-1.5 px-3"
                  >
                    Change File
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={resetSelection}
                    className="text-xs py-1.5 px-3"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Import Notice</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Validation & Preview Section */}
          {parsedData && parsedData.rows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Preview & Validation
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <CheckCircle2 size={13} /> {parsedData.validCount} Valid Questions
                  </span>
                  {parsedData.invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">
                      <AlertTriangle size={13} /> {parsedData.invalidCount} Skipped (Missing Data)
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-black/50 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-white/10 backdrop-blur-md">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Clue</th>
                      <th className="p-3">Hero</th>
                      <th className="p-3">Heroine</th>
                      <th className="p-3">Movie</th>
                      <th className="p-3 text-center">Pts</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {parsedData.rows.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className={`transition-colors ${row.isValid ? 'hover:bg-white/5' : 'bg-red-500/5 hover:bg-red-500/10'}`}
                      >
                        <td className="p-3 text-center text-slate-500 font-mono">{row.rowNumber}</td>
                        <td className="p-3 font-mono font-bold text-brand-light">
                          {row.clue_letters || <span className="text-red-400 italic">Empty</span>}
                        </td>
                        <td className="p-3">
                          {row.hero_name || <span className="text-red-400 italic">Empty</span>}
                        </td>
                        <td className="p-3">
                          {row.heroine_name || <span className="text-red-400 italic">Empty</span>}
                        </td>
                        <td className="p-3">
                          {row.movie_name || <span className="text-red-400 italic">Empty</span>}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-400">{row.points}</td>
                        <td className="p-3 text-right">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Valid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold" title={row.validationError}>
                              {row.validationError}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>

          <Button 
            variant="primary" 
            onClick={handleImportSubmit} 
            disabled={!parsedData || parsedData.validCount === 0 || isUploading}
            className="gap-2 px-6"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Importing...
              </>
            ) : (
              <>
                <Upload size={18} /> 
                {parsedData && parsedData.validCount > 0 
                  ? `Import ${parsedData.validCount} Question${parsedData.validCount > 1 ? 's' : ''}` 
                  : 'Import Questions'}
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
