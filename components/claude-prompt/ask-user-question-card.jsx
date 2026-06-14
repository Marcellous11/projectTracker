"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * Browser equivalent of Claude Code's terminal AskUserQuestion picker.
 * Renders the questions claude emitted in its `tool_use` input and writes
 * the user's answers back to claude as a stream-json `tool_result` via
 * `/api/claude/session/tool-result`.
 *
 * Answer format mirrors the terminal client (visible in past transcripts):
 *   'Your questions have been answered: "Question text"="Selected label", ...'
 *
 * Multi-select questions join their chosen labels with " · ".
 *
 * Props:
 *   questions   — array of { question, header, options:[{label,description}], multiSelect }
 *   onSubmit    — called with the formatted answer string AND structured answers map
 *   submitting  — disable buttons while POST is in flight
 */

function formatAnswers(questions, answers) {
  const parts = questions.map((q) => {
    const a = answers[q.question];
    const text = Array.isArray(a) ? a.join(" · ") : (a || "");
    return `"${q.question}"="${text}"`;
  });
  return `Your questions have been answered: ${parts.join(", ")}`;
}

export default function AskUserQuestionCard({ questions = [], onSubmit, submitting = false }) {
  const [answers, setAnswers] = useState({}); // { [question]: string | string[] }
  const [otherText, setOtherText] = useState({}); // for the "Other" custom field

  const allAnswered = useMemo(() => {
    return questions.every((q) => {
      const a = answers[q.question];
      if (q.multiSelect) return Array.isArray(a) && a.length > 0;
      return typeof a === "string" && a.length > 0;
    });
  }, [questions, answers]);

  const pickSingle = useCallback((qText, label) => {
    setAnswers((prev) => ({ ...prev, [qText]: label }));
  }, []);

  const toggleMulti = useCallback((qText, label) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[qText]) ? prev[qText] : [];
      const next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
      return { ...prev, [qText]: next };
    });
  }, []);

  const setOther = useCallback((qText, value, multi) => {
    setOtherText((prev) => ({ ...prev, [qText]: value }));
    if (!value) return;
    if (multi) {
      // keep selection; we'll append the freeform value when submitting
      return;
    }
    setAnswers((prev) => ({ ...prev, [qText]: `Other: ${value}` }));
  }, []);

  const submit = useCallback(() => {
    // Merge "Other" text into answers if present.
    const merged = { ...answers };
    for (const q of questions) {
      const ot = otherText[q.question]?.trim();
      if (!ot) continue;
      const tagged = `Other: ${ot}`;
      if (q.multiSelect) {
        const cur = Array.isArray(merged[q.question]) ? merged[q.question] : [];
        if (!cur.includes(tagged)) merged[q.question] = [...cur, tagged];
      } else {
        merged[q.question] = tagged;
      }
    }
    const formatted = formatAnswers(questions, merged);
    onSubmit?.(formatted, merged);
  }, [answers, otherText, questions, onSubmit]);

  return (
    <div className="flex flex-col gap-3 mt-2">
      {questions.map((q, qi) => {
        const isMulti = !!q.multiSelect;
        const cur = answers[q.question];
        return (
          <div key={qi} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              {q.header && (
                <span className="hud-mono text-[9px] uppercase tracking-[0.2em] text-warm border border-warm/40 px-1.5 py-0.5 rounded">
                  {q.header}
                </span>
              )}
              <span className="hud-mono text-xs text-foreground/85 leading-snug flex-1">
                {q.question}
              </span>
            </div>
            <div className="flex flex-col gap-1 pl-1">
              {(q.options || []).map((opt, oi) => {
                const isOn = isMulti
                  ? Array.isArray(cur) && cur.includes(opt.label)
                  : cur === opt.label;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={submitting}
                    onClick={() => isMulti ? toggleMulti(q.question, opt.label) : pickSingle(q.question, opt.label)}
                    className={`text-left rounded-md border px-2 py-1.5 transition-colors disabled:opacity-50 ${
                      isOn
                        ? "border-green/70 bg-green/10 text-green"
                        : "border-hud-ink-dim/30 hover:border-hud-ink-dim/60 hover:bg-foreground/5 text-foreground/85"
                    }`}
                  >
                    <div className="hud-mono text-[11px] leading-tight flex items-center gap-2">
                      <span className="inline-block size-3 shrink-0 text-center select-none">
                        {isOn ? (isMulti ? "☑" : "●") : (isMulti ? "☐" : "○")}
                      </span>
                      <span className="flex-1">{opt.label}</span>
                    </div>
                    {opt.description && (
                      <p className="hud-mono text-[10px] text-hud-ink-dim leading-snug mt-0.5 pl-5">
                        {opt.description}
                      </p>
                    )}
                  </button>
                );
              })}
              {/* "Other" freeform input — mirrors the terminal client */}
              <div className="flex items-center gap-2 mt-1">
                <span className="hud-mono text-[10px] text-hud-ink-dim w-16 shrink-0">other:</span>
                <input
                  type="text"
                  value={otherText[q.question] || ""}
                  onChange={(e) => setOther(q.question, e.target.value, isMulti)}
                  placeholder="custom answer…"
                  disabled={submitting}
                  className="h-7 flex-1 min-w-0 rounded-md border border-input bg-transparent px-2 hud-mono text-[11px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !allAnswered}
          className="h-7 rounded-lg border border-green/60 px-3 text-[10px] hud-mono uppercase tracking-[0.18em] text-green hover:bg-green/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {submitting ? "submitting…" : "▶ submit answers"}
        </button>
      </div>
    </div>
  );
}
