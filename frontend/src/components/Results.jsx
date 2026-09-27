/**
 * Final score screen with per-question review.
 * Purely derived from props — no state, no side effects.
 */
export default function Results({ questions, userAnswers, onRetake, onNewQuiz }) {
  const correct = questions.reduce(
    (count, q, i) => (userAnswers[i] === q.correctAnswer ? count + 1 : count),
    0
  );
  const percent = Math.round((correct / questions.length) * 100);
  const verdict =
    percent >= 80
      ? "Excellent work!"
      : percent >= 50
        ? "Good effort — review the misses below."
        : "Keep practicing — read the explanations below.";

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
      <div className="text-center mb-6">
        <p className="text-5xl font-bold text-indigo-400">{percent}%</p>
        <p className="mt-2 text-slate-300">
          You got {correct} out of {questions.length} correct.
        </p>
        <p className="text-slate-500 text-sm">{verdict}</p>
      </div>

      <ul className="space-y-4">
        {questions.map((q, i) => {
          const user = userAnswers[i];
          const wasRight = user === q.correctAnswer;
          return (
            <li
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-800/40 p-4"
            >
              <p className="font-medium">
                <span className={wasRight ? "text-emerald-400" : "text-red-400"}>
                  {wasRight ? "✓" : "✗"}
                </span>{" "}
                {q.question}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Your answer:{" "}
                <span className={wasRight ? "text-emerald-300" : "text-red-300"}>
                  {q.options[user]}
                </span>
                {!wasRight && (
                  <>
                    {" "}
                    &middot; Correct:{" "}
                    <span className="text-emerald-300">
                      {q.options[q.correctAnswer]}
                    </span>
                  </>
                )}
              </p>
              {q.explanation && (
                <p className="mt-2 text-sm text-slate-500 border-l-2 border-slate-700 pl-3">
                  {q.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700"
        >
          Retake quiz
        </button>
        <button
          type="button"
          onClick={onNewQuiz}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          New PDF
        </button>
      </div>
    </div>
  );
}
