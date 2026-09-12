import { useRef, useState } from 'react';
import { IconDownload, IconUpload } from './Icons';
import { parseState, serializeForExport } from '../lib/store';
import type { UserState } from '../lib/types';

interface Props {
  state: UserState;
  onReplaceState: (next: UserState) => void;
}

function fileName(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `baseline-${ymd}.json`;
}

/**
 * 백업 내보내기/불러오기.
 * 인스타그램 인앱 브라우저 등에서는 <a download>가 동작하지 않는 경우가 있어
 * 공유(Web Share) → 다운로드 → 복사/붙여넣기 순으로 폴백을 둔다.
 */
export function ImportExport({ state, onReplaceState }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const total = state.adopted_principles.length;
  const exportText = () => serializeForExport(state);

  const handleDownload = () => {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg('다운로드를 시작했습니다. 안 되면 "텍스트 복사"를 쓰세요.');
  };

  const handleShare = async () => {
    const text = exportText();
    const name = fileName();
    try {
      if (typeof navigator.share === 'function') {
        const file = new File([text], name, { type: 'application/json' });
        if (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '나의 투자 헌법 백업' });
          setMsg('공유 창을 열었습니다.');
          return;
        }
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
    handleDownload();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      setMsg('클립보드에 복사했습니다. 메모 앱에 붙여넣어 보관하세요.');
    } catch {
      setPasteOpen(true);
      setPasteText(exportText());
      setMsg('아래 텍스트를 직접 복사하세요.');
    }
  };

  const applyImport = (text: string) => {
    try {
      const next = parseState(text);
      const n = next.adopted_principles.length;
      const ok = window.confirm(
        `백업 파일에 원칙 기록 ${n}개가 있습니다.\n지금 기기의 기록 ${total}개를 이 파일로 바꿉니다. 계속할까요?`,
      );
      if (!ok) return;
      onReplaceState(next);
      setPasteOpen(false);
      setPasteText('');
      setMsg(null);
    } catch (e) {
      setMsg(`불러오기 실패: ${(e as Error).message}`);
    }
  };

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => applyImport(String(reader.result ?? ''));
    reader.onerror = () => setMsg('파일을 읽지 못했습니다.');
    reader.readAsText(f);
  };

  return (
    <section className="section-block backup">
      <h2 className="h3">백업</h2>
      <p className="sub">기록은 이 브라우저에만 있습니다. 앱이나 기기를 바꾸면 사라지니, 가끔 내보내 두세요.</p>

      <div className="backup-row">
        <button type="button" className="btn-secondary" onClick={handleShare} disabled={total === 0}>
          <IconDownload width={16} height={16} /> JSON 내보내기
        </button>
        <button type="button" className="btn-secondary" onClick={handleCopy} disabled={total === 0}>
          텍스트 복사
        </button>
      </div>
      <div className="backup-row">
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          <IconUpload width={16} height={16} /> JSON 불러오기
        </button>
        <button type="button" className="btn-secondary" onClick={() => setPasteOpen((o) => !o)}>
          텍스트 붙여넣기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {pasteOpen && (
        <div className="paste-box">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder='{"schema":"invest-principles", ...}'
            spellCheck={false}
          />
          <div className="backup-row">
            <button type="button" className="btn-primary" onClick={() => applyImport(pasteText)} disabled={!pasteText.trim()}>
              이 텍스트로 불러오기
            </button>
            <button type="button" className="btn-ghost" onClick={() => setPasteOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {msg && <p className="backup-msg" role="status">{msg}</p>}
    </section>
  );
}
