import { useRef, useState } from 'react';

import { api, ApiError } from '../api/client';
import type { UploadedVideo } from '../lib/types';
import { Button } from './ui';

/** Mirrors the API: MP4 (H.264) up to 20 MB — plays on every supported phone. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Banner video field: MP4 check, upload to the API's storage, inline preview. */
export function VideoUpload({
  label,
  value,
  url,
  missing,
  error,
  onChange,
}: {
  label: string;
  value: string | null;
  url: string | null;
  missing?: boolean;
  error?: string;
  onChange: (video: { key: string; url: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    if (file.type !== 'video/mp4' && !/\.mp4$/i.test(file.name)) return setProblem('Use an MP4 video (H.264)');
    if (file.size > MAX_BYTES) return setProblem('Video is larger than 20 MB — shorten or compress it');
    setBusy(true);
    try {
      const res = await api.postFile<UploadedVideo>('/admin/uploads/videos', file, { purpose: 'banner' });
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
          <video src={url} className="img-preview" muted loop autoPlay playsInline controls aria-label={`${label} preview`} />
        ) : (
          <div className="img-empty">
            {missing ? <span className="field-error">The stored video file is missing — upload it again.</span> : <span className="muted">No video yet</span>}
          </div>
        )}
      </div>
      <div className="row gap">
        <input ref={input} type="file" accept="video/mp4,.mp4" hidden onChange={(e) => choose(e.target.files?.[0])} />
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
          {value ? 'Replace video' : 'Upload video'}
        </Button>
        <span className="muted small">MP4 (H.264) · max 20 MB · wide, e.g. 1080×490 · plays muted on loop</span>
      </div>
      {shown && <span className="field-error">{shown}</span>}
    </div>
  );
}
