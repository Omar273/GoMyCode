import { useState } from "react";

/**
 * One-question-at-a-time quiz view with a progress bar.
 * This component is PRESENTATIONAL: App owns the answers array and this
 * only reports clicks via onAnswer. Navigation state stays local.
 */
export default function QuizCard({ questions, userAnswers, onAnswer, onFinish }) {
  const [current, setCurrent] = useState(0);

  const question = questions[current];
  const selected = userAnswers[current];
  const total = questions.length;
  const isLast = current === total - 1;
  const answeredCount = userAnswers.filter((a) => a !== null).length;
  const firstUnanswered = userAnswers.findIndex((a) => a === null);

  function handleNext() {
    if (isLast) {
      // Guard: no finishing until every question has an answer.
      if (firstUnanswered !== -1) {
        setCurrent(firstUnanswered);
      } else {
        onFinish();
      }
    } else {
      setCurrent((c) => c + 1);
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>
            Question {current + 1} of {total}
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div
            className="h-2 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-5">{question.question}</h2>

      <div className="space-y-3">
        {question.options.map((option, index) => {
          const isSelected = selected === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onAnswer(current, index)}
              aria-pressed={isSelected}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="font-semibold mr-2">
                {String.fromCharCode(65 + index)}.
              </span>
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-0"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={selected === null}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {isLast ? "See results" : "Next →"}
        </button>
      </div>

      {isLast && firstUnanswered !== -1 && (
        <p className="mt-3 text-xs text-amber-400" role="alert">
          You still have {total - answeredCount} unanswered question(s) —
          we&apos;ll jump to the first one.
        </p>
      )}
    </div>
  );
}
