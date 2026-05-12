import { PROGRESS_STEPS, STATUS } from '@/data/constants';
import type { StatusKey } from '@/types/rakshak';

export function ProgressSteps({ status }: { status: StatusKey }) {
  if (status === 'stalled') {
    return (
      <div className="prog-stall">
        ⚠️ Stalled — No response from responsible authorities. Escalation needed.
      </div>
    );
  }
  const cur = STATUS[status]?.s ?? 1;
  return (
    <div className="prog-steps">
      {PROGRESS_STEPS.map((s) => {
        const stepInfo = STATUS[s.k];
        const done = stepInfo.s <= cur;
        const current = s.k === status;
        return (
          <div key={s.k} className={`prog-step${done ? ' done' : ''}${current ? ' current' : ''}`}>
            <div className="prog-circ">
              {done && (
                <svg width="8" height="8" viewBox="0 0 10 10">
                  <polyline
                    points="1,5 4,8 9,2"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
            <div className="prog-lbl">{s.l}</div>
          </div>
        );
      })}
    </div>
  );
}
