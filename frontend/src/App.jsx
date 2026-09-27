import { useState } from "react";

import FileUpload from "./components/FileUpload.jsx";
import QuizCard from "./components/QuizCard.jsx";
import Results from "./components/Results.jsx";

// Base URL comes from the environment so the same build can talk to a
// local Flask dev server, a LAN IP, or a deployed backend without code edits.
// Falls back to "" so the Vite dev proxy (see vite.config.js) handles /api.
const API_BASE = import.meta.env.VITE_API_URL || "";

const STAGES = {
  UPLOAD: "upload",
  LOADING: "loading",
  QUIZ: "quiz",
  RESULTS: "results",
};

export default function App() {
  // One state machine drives the whole UI. Questions and answers are owned
  // HERE (single source of truth) and passed down as props.
  const [stage, setStage] = useState(STAGES.UPLOAD);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [error, setError] = useState(null);

  async function handleFileSelected(file, numQuestions) {
    setError(null);
    setStage(STAGES.LOADING);

    // FormData + fetch: the browser sets the multipart boundary for us.
    const formData = new FormData();
    formData.append("file", file);
    formData.append("num_questions", String(numQuestions));

    try {
      const response = await fetch(`${API_BASE}/api/generate-quiz`, {
        method: "POST",
        body: formData,
      });

      // Guard: a non-JSON body (proxy error page) shouldn't crash the app.
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Backend sends {"error": "human readable message"} — surface it.
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      setQuestions(data.quiz.questions);
      setUserAnswers(Array(data.quiz.questions.length).fill(null));
      setStage(STAGES.QUIZ);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setStage(STAGES.UPLOAD); // let the user retry with a different PDF
    }
  }

  function handleAnswer(questionIndex, optionIndex) {
    // Immutable update so React re-renders correctly.
    setUserAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  function handleQuizFinish() {
    setStage(STAGES.RESULTS);
  }

  function handleRetake() {
    setUserAnswers(Array(questions.length).fill(null));
    setStage(STAGES.QUIZ);
  }

  function handleNewQuiz() {
    setQuestions([]);
    setUserAnswers([]);
    setError(null);
    setStage(STAGES.UPLOAD);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">PDF &rarr; Quiz</h1>
        <p className="text-slate-400 mt-1">
          Upload a PDF, get an instant practice quiz 
        </p>
      </header>

      <main className="w-full max-w-2xl">
        {stage === STAGES.UPLOAD && (
          <FileUpload onFileSelected={handleFileSelected} error={error} />
        )}

        {stage === STAGES.LOADING && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center">
            <div
              className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500"
              role="status"
              aria-label="Loading"
            />
            <p className="text-slate-300">Generating your quiz&hellip;</p>
            <p className="text-slate-500 text-sm mt-1">This usually takes 5&ndash;15 seconds.</p>
          </div>
        )}

        {stage === STAGES.QUIZ && (
          <QuizCard
            questions={questions}
            userAnswers={userAnswers}
            onAnswer={handleAnswer}
            onFinish={handleQuizFinish}
          />
        )}

        {stage === STAGES.RESULTS && (
          <Results
            questions={questions}
            userAnswers={userAnswers}
            onRetake={handleRetake}
            onNewQuiz={handleNewQuiz}
          />
        )}
      </main>
    </div>
  );
}
