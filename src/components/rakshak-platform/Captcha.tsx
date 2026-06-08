import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Icon } from "@/components/ui/icon";

type Challenge = { a: number; b: number; op: "+" | "-" | "×"; answer: number; nonce: string };

function makeChallenge(): Challenge {
  const ops: Challenge["op"][] = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  if (op === "×") {
    a = 2 + Math.floor(Math.random() * 8); // 2..9
    b = 2 + Math.floor(Math.random() * 8);
    answer = a * b;
  } else if (op === "-") {
    a = 5 + Math.floor(Math.random() * 20); // 5..24
    b = 1 + Math.floor(Math.random() * (a - 1));
    answer = a - b;
  } else {
    a = 1 + Math.floor(Math.random() * 20);
    b = 1 + Math.floor(Math.random() * 20);
    answer = a + b;
  }
  return { a, b, op, answer, nonce: Math.random().toString(36).slice(2, 8) };
}

export interface CaptchaProps {
  /** Controlled answer string from parent so it can be cleared on submit. */
  value: string;
  onChange: (v: string) => void;
  /** Called whenever a new challenge is generated; parent stores the
   *  expected answer to verify on submit. */
  onChallenge: (expected: number) => void;
  error?: string | null;
}

export function Captcha({ value, onChange, onChallenge, error }: CaptchaProps) {
  const [challenge, setChallenge] = useState<Challenge>(() => makeChallenge());

  const refresh = useCallback(() => {
    const c = makeChallenge();
    setChallenge(c);
    onChange("");
    onChallenge(c.answer);
  }, [onChallenge, onChange]);

  // Push the initial expected value up on mount and on every page refresh.
  useEffect(() => {
    onChallenge(challenge.answer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className="block">
      <span className="block text-xs font-medium tracking-[0.2em] text-muted-foreground mb-2">
        SECURITY CHECK
      </span>
      <div className="flex items-stretch gap-2">
        <div
          aria-label={`Captcha challenge: what is ${challenge.a} ${challenge.op} ${challenge.b}?`}
          className="select-none flex-1 h-11 rounded-xl border border-border bg-muted/40 px-4 flex items-center justify-center font-mono text-base tracking-wider"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.04) 6px, rgba(0,0,0,0.04) 7px)",
            letterSpacing: "0.15em",
          }}
        >
          <span style={{ transform: "skewX(-8deg)" }}>
            {challenge.a} {challenge.op} {challenge.b} = ?
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh captcha challenge"
          title="Get a new challenge"
          className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-border hover:border-brand/40"
        >
          <Icon as={RefreshCw} size="sm" />
        </button>
      </div>
      <input
        required
        inputMode="numeric"
        pattern="-?[0-9]+"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter the answer"
        aria-invalid={!!error}
        aria-describedby={error ? "captcha-error" : undefined}
        className="mt-2 w-full h-11 rounded-xl border border-border bg-card px-4 text-sm focus:outline-none focus:border-brand"
      />
      {error && (
        <p id="captcha-error" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </label>
  );
}
