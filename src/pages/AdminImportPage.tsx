import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { runImporter } from '../services/catalogService';

type ImportProvider = 'openstax' | 'gutenberg' | 'federal';

const PROVIDERS: Array<{
  id: ImportProvider;
  label: string;
  description: string;
  samplePath: string;
}> = [
  {
    id: 'openstax',
    label: 'OpenStax mapping',
    description: 'Map modules to OpenStax chapter URLs (CC BY).',
    samplePath: 'mappings/openstax.json',
  },
  {
    id: 'gutenberg',
    label: 'Project Gutenberg mapping',
    description: 'Attach public-domain texts to humanities modules.',
    samplePath: 'mappings/gutenberg.json',
  },
  {
    id: 'federal',
    label: 'Federal Public Domain mapping',
    description: 'NASA, NOAA, NARA, and LOC curated media.',
    samplePath: 'mappings/federal_pd.json',
  },
];

const AdminImportPage: React.FC = () => {
  const [provider, setProvider] = useState<ImportProvider>('openstax');
  const [mappingData, setMappingData] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) {
      setMappingData(null);
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setMappingData(parsed);
      setStatus({
        message: `Loaded mapping with ${Object.keys(parsed).length} module entries.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to parse mapping', error);
      setMappingData(null);
      setStatus({
        message: 'Unable to parse file. Ensure it is valid JSON/YAML converted to JSON.',
        type: 'error',
      });
    }
  };

  const executeImport = async () => {
    if (!mappingData) {
      setStatus({ message: 'Upload a mapping file before running the import.', type: 'error' });
      return;
    }

    try {
      setIsRunning(true);
      const { inserted } = await runImporter(provider, mappingData);
      setStatus({
        message: `Imported ${inserted} assets successfully.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Import failed', error);
      setStatus({
        message:
          error instanceof Error ? error.message : 'Import failed. Check the mapping data and try again.',
        type: 'error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const selectedProvider = PROVIDERS.find((item) => item.id === provider)!;

  return (
    <div className="bg-slate-50 min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6 bg-white border border-slate-200 rounded-3xl shadow-xl p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Content import console</h1>
        <p className="text-sm text-slate-500 mb-8">
          Upload mapping files to ingest external assets. Files must be valid JSON matching the sample
          structures in the <code>mappings/</code> directory.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {PROVIDERS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                setProvider(item.id);
                setStatus(null);
              }}
              className={`border rounded-2xl p-4 text-left transition-all ${
                provider === item.id
                  ? 'border-brand-blue bg-brand-blue/5 shadow-md'
                  : 'border-slate-200 hover:border-brand-blue/50'
              }`}
            >
              <div className="font-semibold text-slate-900">{item.label}</div>
              <div className="text-xs text-slate-500 mt-2">{item.description}</div>
              <div className="text-[11px] text-brand-blue mt-4">Sample: {item.samplePath}</div>
            </button>
          ))}
        </div>

        <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <UploadCloud className="h-9 w-9 text-brand-blue mb-3" />
            <span className="font-medium text-slate-700">
              Click to upload {selectedProvider.label} JSON
            </span>
            <span className="text-xs text-slate-400 mt-1">
              We validate licenses before writing to Supabase.
            </span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={executeImport}
            disabled={isRunning}
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-brand-blue text-white font-semibold text-sm hover:bg-brand-blue/90 transition-colors disabled:opacity-60"
          >
            {isRunning ? 'Running importer…' : 'Run importer'}
          </button>
          <div className="text-xs text-slate-500">
            Tip: run <code>npm run audit:licenses</code> after importing to export a CSV report.
          </div>
        </div>

        {status && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 mt-0.5" />
            )}
            <div>{status.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminImportPage;
