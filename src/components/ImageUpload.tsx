import { useRef, useState } from 'react';

import { api, ApiError } from '../api/client';
import type { UploadedImage } from '../lib/types';
import { Button } from './ui';

/** Mirrors the API's banner rules so problems show before uploading. */
const RULES = { maxBytes: 2 * 1024 * 1024, minWidth: 720, minHeight: 300, minRatio: 1.6, maxRatio: 3.2 };
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error('This file is not a readable image'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

async function check(file: File): Promise<string | null> {
  if (!TYPES.includes(file.type)) return 'Use a JPG, PNG or WEBP image';
  if (file.size > RULES.maxBytes) return 'Image is larger than 2 MB';
  try {
    const { width, height } = await readSize(file);
    if (width < RULES.minWidth || height < RULES.minHeight) return `Image is ${width}×${height}px; at least ${RULES.minWidth}×${RULES.minHeight}px is needed`;
    const ratio = width / height;
    if (ratio < RULES.minRatio || ratio > RULES.maxRatio) return `Image shape is ${ratio.toFixed(2)}:1 — banners must be wide (${RULES.minRatio}:1 to ${RULES.maxRatio}:1, e.g. 1080×490)`;
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

/**
 * Banner image field: client-side checks, upload to the API's image storage,
 * preview at the app's banner shape. `value` is the stored key.
 */
export function ImageUpload({
  label,
  hint,
  value,
  url,
  missing,
  error,
  optional,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  url: string | null;
  missing?: boolean;
  error?: string;
  optional?: boolean;
  onChange: (image: { key: string; url: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    const issue = await check(file);
    if (issue) return setProblem(issue);
    setBusy(true);
    try {
      const res = await api.postFile<UploadedImage>('/admin/uploads/images', file, { purpose: 'banner' });
      onChange({ key: res.data.key, url: res.data.url });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'Upload failed — check your connection and try again');
    } finally {
      setBusy(false);
    }
  }

  const shown = problem ?? error;
  return (
    <div className={`field ${shown ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      <div className={`img-drop ${value ? 'has-image' : ''}`}>
        {value && url && !missing ? (
          <img src={url} alt={`${label} preview`} className="img-preview" />
        ) : (
          <div className="img-empty">
            {missing ? <span className="field-error">The stored image file is missing — upload it again.</span> : <span className="muted">No image yet</span>}
          </div>
        )}
      </div>
      <div className="row gap">
        <input ref={input} type="file" accept={TYPES.join(',')} hidden onChange={(e) => choose(e.target.files?.[0])} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          busy={busy}
          onClick={() => {
            if (input.current) {
              input.current.value = '';
              input.current.click();
            }
          }}
        >
          {value ? 'Replace image' : 'Upload image'}
        </Button>
        {optional && value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
        <span className="muted small">{hint ?? 'JPG, PNG or WEBP · max 2 MB · wide, e.g. 1080×490'}</span>
      </div>
      {shown && <span className="field-error">{shown}</span>}
    </div>
  );
}
